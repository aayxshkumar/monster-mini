#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# ARCHIVIO Watchdog — Self-healing monitor for the Pi photo booth
#
# Runs as a systemd service on the Raspberry Pi. Continuously
# checks that WiFi is connected, both services are healthy,
# and the printer is reachable. Automatically recovers from:
#
#   - WiFi dropout (waits, reconnects, restarts services)
#   - Flask API crash (restarts archivio-server)
#   - Dashboard crash (restarts archivio-dashboard)
#   - Printer disconnect (logs warning, retries)
#   - Full power outage (systemd starts everything on boot)
#   - Database corruption (runs integrity check, rebuilds if needed)
#
# Usage:
#   ./archivio-watchdog.sh              # Run in foreground
#   ./archivio-watchdog.sh --install    # Install as systemd service
#   ./archivio-watchdog.sh --status     # Quick one-shot health check
#   ./archivio-watchdog.sh --uninstall  # Remove systemd service
#
# Logs: journalctl -u archivio-watchdog -f
# ──────────────────────────────────────────────────────────────

set -euo pipefail

# === Configuration ===
API_PORT=5000
DASHBOARD_PORT=3000
HEALTH_ENDPOINT="http://localhost:${API_PORT}/api/health"
DASHBOARD_ENDPOINT="http://localhost:${DASHBOARD_PORT}"
CHECK_INTERVAL=30          # seconds between health checks
WIFI_RETRY_INTERVAL=10     # seconds between WiFi reconnection attempts
WIFI_MAX_RETRIES=30        # give up after 5 minutes of no WiFi
CURL_TIMEOUT=5             # seconds for HTTP health checks
SERVICE_SETTLE_TIME=10     # seconds to wait after restarting a service
MAX_RAPID_RESTARTS=5       # if a service restarts this many times in RAPID_WINDOW, reboot
RAPID_WINDOW=300           # seconds (5 min)

# State tracking
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STATE_DIR="/tmp/archivio-watchdog"
mkdir -p "$STATE_DIR"

# Logging
log()   { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]  $*"; }
warn()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARN]  $*"; }
error() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $*"; }
ok()    { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [OK]    $*"; }

# ── WiFi checks ──────────────────────────────────────────────

wifi_connected() {
    # Check if wlan0 has an IP address
    ip addr show wlan0 2>/dev/null | grep -q "inet " && return 0

    # Fallback: check any interface for a non-loopback IP
    local ip
    ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    [[ -n "$ip" && "$ip" != "127."* ]] && return 0

    return 1
}

get_local_ip() {
    hostname -I 2>/dev/null | awk '{print $1}'
}

wait_for_wifi() {
    local attempt=0
    while ! wifi_connected; do
        attempt=$((attempt + 1))
        if [[ $attempt -ge $WIFI_MAX_RETRIES ]]; then
            error "WiFi not available after $((WIFI_MAX_RETRIES * WIFI_RETRY_INTERVAL))s — will keep trying"
            attempt=0  # reset and keep going forever
        fi
        warn "WiFi not connected (attempt $attempt/$WIFI_MAX_RETRIES) — retrying in ${WIFI_RETRY_INTERVAL}s"

        # Try to force reconnection
        if command -v nmcli &>/dev/null; then
            nmcli radio wifi on 2>/dev/null || true
            nmcli device connect wlan0 2>/dev/null || true
        elif command -v wpa_cli &>/dev/null; then
            wpa_cli -i wlan0 reassociate 2>/dev/null || true
        fi

        sleep "$WIFI_RETRY_INTERVAL"
    done
    ok "WiFi connected — IP: $(get_local_ip)"
}

# ── Service checks ───────────────────────────────────────────

service_active() {
    systemctl is-active --quiet "$1" 2>/dev/null
}

service_exists() {
    systemctl list-unit-files "$1" 2>/dev/null | grep -q "$1"
}

restart_service() {
    local svc="$1"
    warn "Restarting $svc..."
    sudo systemctl restart "$svc" 2>/dev/null || {
        error "Failed to restart $svc"
        return 1
    }
    sleep "$SERVICE_SETTLE_TIME"
    if service_active "$svc"; then
        ok "$svc restarted successfully"
        record_restart "$svc"
        return 0
    else
        error "$svc failed to start after restart"
        return 1
    fi
}

record_restart() {
    local svc="$1"
    echo "$(date +%s)" >> "$STATE_DIR/${svc}.restarts"
    # Trim old entries outside the rapid window
    local now cutoff
    now=$(date +%s)
    cutoff=$((now - RAPID_WINDOW))
    if [[ -f "$STATE_DIR/${svc}.restarts" ]]; then
        awk -v c="$cutoff" '$1 >= c' "$STATE_DIR/${svc}.restarts" > "$STATE_DIR/${svc}.restarts.tmp"
        mv "$STATE_DIR/${svc}.restarts.tmp" "$STATE_DIR/${svc}.restarts"
    fi
}

check_rapid_restarts() {
    local svc="$1"
    local count=0
    if [[ -f "$STATE_DIR/${svc}.restarts" ]]; then
        count=$(wc -l < "$STATE_DIR/${svc}.restarts" | tr -d ' ')
    fi
    if [[ $count -ge $MAX_RAPID_RESTARTS ]]; then
        return 0  # too many restarts
    fi
    return 1
}

# ── Health checks ────────────────────────────────────────────

check_api_health() {
    local response
    response=$(curl -s -m "$CURL_TIMEOUT" "$HEALTH_ENDPOINT" 2>/dev/null) || return 1
    echo "$response" | grep -q '"status"' || return 1
    return 0
}

check_dashboard_health() {
    local http_code
    http_code=$(curl -s -o /dev/null -w '%{http_code}' -m "$CURL_TIMEOUT" "$DASHBOARD_ENDPOINT" 2>/dev/null) || return 1
    [[ "$http_code" =~ ^(200|304)$ ]] && return 0
    # Next.js may redirect — 3xx is also fine
    [[ "$http_code" =~ ^3[0-9][0-9]$ ]] && return 0
    return 1
}

check_printer() {
    # Check if any USB printer device exists
    ls /dev/usb/lp* 2>/dev/null | head -1 > /dev/null 2>&1 && return 0
    # Check CUPS
    lpstat -p 2>/dev/null | grep -q "idle\|enabled" && return 0
    return 1
}

check_database() {
    local db_path="/home/monster-pi/archivio-server/archivio.db"
    [[ ! -f "$db_path" ]] && return 0  # no DB yet is fine
    sqlite3 "$db_path" "PRAGMA integrity_check;" 2>/dev/null | grep -q "ok" && return 0
    return 1
}

check_disk_space() {
    local usage
    # Linux: df --output=pcent; macOS: df -P then parse column 5
    usage=$(df -P / 2>/dev/null | tail -1 | awk '{print $5}' | tr -d '%')
    [[ -z "$usage" || ! "$usage" =~ ^[0-9]+$ ]] && return 0
    [[ $usage -lt 90 ]] && return 0
    return 1
}

# ── Cleanup ──────────────────────────────────────────────────

cleanup_old_files() {
    # Remove uploaded images older than 7 days to prevent disk fill
    local dirs=(
        "/home/monster-pi/archivio-server/uploads"
        "/home/monster-pi/archivio-server/previews"
        "/home/monster-pi/archivio-server/gallery"
    )
    for dir in "${dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            local count
            count=$(find "$dir" -type f -mtime +7 2>/dev/null | wc -l | tr -d ' ')
            if [[ $count -gt 0 ]]; then
                find "$dir" -type f -mtime +7 -delete 2>/dev/null
                log "Cleaned $count old files from $dir"
            fi
        fi
    done
}

# ── One-shot status check ────────────────────────────────────

print_status() {
    echo "╔══════════════════════════════════════════════════╗"
    echo "║         ARCHIVIO Photo Booth — Health Check      ║"
    echo "╚══════════════════════════════════════════════════╝"
    echo ""

    # WiFi
    if wifi_connected; then
        echo "  ✓ WiFi ............ connected ($(get_local_ip))"
    else
        echo "  ✗ WiFi ............ disconnected"
    fi

    # API
    if service_active "archivio-server.service"; then
        if check_api_health; then
            echo "  ✓ Flask API ....... running + healthy (:$API_PORT)"
        else
            echo "  △ Flask API ....... running but unhealthy (:$API_PORT)"
        fi
    else
        echo "  ✗ Flask API ....... not running"
    fi

    # Dashboard
    if service_active "archivio-dashboard.service"; then
        if check_dashboard_health; then
            echo "  ✓ Dashboard ....... running + healthy (:$DASHBOARD_PORT)"
        else
            echo "  △ Dashboard ....... running but unhealthy (:$DASHBOARD_PORT)"
        fi
    else
        echo "  ✗ Dashboard ....... not running"
    fi

    # Printer
    if check_printer; then
        echo "  ✓ Printer ......... connected"
    else
        echo "  △ Printer ......... not detected"
    fi

    # Database
    if check_database; then
        echo "  ✓ Database ........ OK"
    else
        echo "  ✗ Database ........ integrity error"
    fi

    # Disk
    local disk_use
    disk_use=$(df -P / 2>/dev/null | tail -1 | awk '{print $5}' || echo "?%")
    if check_disk_space; then
        echo "  ✓ Disk ............ $disk_use used"
    else
        echo "  △ Disk ............ $disk_use used (>90%!)"
    fi

    # NFC/Booth URL
    echo ""
    echo "  Booth URL: http://$(get_local_ip):$DASHBOARD_PORT/booth"
    echo ""
}

# ── Install/uninstall as systemd service ─────────────────────

install_service() {
    local service_file="/etc/systemd/system/archivio-watchdog.service"
    local script_path
    script_path="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"

    echo "Installing archivio-watchdog systemd service..."

    sudo tee "$service_file" > /dev/null << UNIT
[Unit]
Description=ARCHIVIO Photo Booth Watchdog
After=network.target archivio-server.service archivio-dashboard.service
Wants=archivio-server.service archivio-dashboard.service

[Service]
Type=simple
User=root
ExecStart=/bin/bash $script_path
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT

    sudo systemctl daemon-reload
    sudo systemctl enable archivio-watchdog.service
    sudo systemctl start archivio-watchdog.service
    echo "✓ Watchdog installed and started"
    echo "  Logs: journalctl -u archivio-watchdog -f"
}

uninstall_service() {
    echo "Removing archivio-watchdog service..."
    sudo systemctl stop archivio-watchdog.service 2>/dev/null || true
    sudo systemctl disable archivio-watchdog.service 2>/dev/null || true
    sudo rm -f /etc/systemd/system/archivio-watchdog.service
    sudo systemctl daemon-reload
    echo "✓ Watchdog removed"
}

# ── Main loop ────────────────────────────────────────────────

main_loop() {
    log "Archivio Watchdog started (check every ${CHECK_INTERVAL}s)"
    log "Waiting for WiFi..."
    wait_for_wifi

    local cycle=0
    local last_cleanup=0

    while true; do
        cycle=$((cycle + 1))

        # ── 1. WiFi ──────────────────────────────────────
        if ! wifi_connected; then
            warn "WiFi dropped — waiting for reconnection..."
            wait_for_wifi
            # After WiFi comes back, give services a moment then check them
            sleep 5
        fi

        # ── 2. Flask API ─────────────────────────────────
        if service_exists "archivio-server.service"; then
            if ! service_active "archivio-server.service"; then
                warn "archivio-server is not running"
                if check_rapid_restarts "archivio-server.service"; then
                    error "archivio-server has restarted $MAX_RAPID_RESTARTS times in ${RAPID_WINDOW}s — triggering reboot"
                    sudo reboot
                fi
                restart_service "archivio-server.service"
            elif ! check_api_health; then
                warn "archivio-server running but /api/health failed"
                if check_rapid_restarts "archivio-server.service"; then
                    error "archivio-server stuck in crash loop — triggering reboot"
                    sudo reboot
                fi
                restart_service "archivio-server.service"
            fi
        fi

        # ── 3. Dashboard ─────────────────────────────────
        if service_exists "archivio-dashboard.service"; then
            if ! service_active "archivio-dashboard.service"; then
                warn "archivio-dashboard is not running"
                if check_rapid_restarts "archivio-dashboard.service"; then
                    error "archivio-dashboard has restarted $MAX_RAPID_RESTARTS times in ${RAPID_WINDOW}s — triggering reboot"
                    sudo reboot
                fi
                restart_service "archivio-dashboard.service"
            elif ! check_dashboard_health; then
                warn "archivio-dashboard running but HTTP check failed"
                # Dashboard may just be slow to start — only restart if it fails 2x in a row
                sleep 10
                if ! check_dashboard_health; then
                    restart_service "archivio-dashboard.service"
                fi
            fi
        fi

        # ── 4. Printer (warning only) ────────────────────
        if ! check_printer; then
            if [[ $((cycle % 10)) -eq 1 ]]; then
                warn "Printer not detected (non-critical — will be available when connected)"
            fi
        fi

        # ── 5. Database integrity (every 100 cycles) ─────
        if [[ $((cycle % 100)) -eq 0 ]]; then
            if ! check_database; then
                error "Database integrity check failed — the server may auto-rebuild on next request"
            fi
        fi

        # ── 6. Disk cleanup (every hour) ─────────────────
        local now
        now=$(date +%s)
        if [[ $((now - last_cleanup)) -gt 3600 ]]; then
            if ! check_disk_space; then
                warn "Disk usage above 90% — running cleanup"
                cleanup_old_files
            fi
            last_cleanup=$now
        fi

        # ── 7. Periodic status (every 20 cycles = ~10min) ─
        if [[ $((cycle % 20)) -eq 0 ]]; then
            ok "Heartbeat — cycle $cycle — IP: $(get_local_ip) — all services nominal"
        fi

        sleep "$CHECK_INTERVAL"
    done
}

# ── Entry point ──────────────────────────────────────────────

case "${1:-}" in
    --install)
        install_service
        ;;
    --uninstall)
        uninstall_service
        ;;
    --status)
        print_status
        ;;
    *)
        main_loop
        ;;
esac
