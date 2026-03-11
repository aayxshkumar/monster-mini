#!/bin/bash

# ============================================================
#  pipeline.sh — Deploy + Start all Archivio services
#
#  Usage:
#    ./pipeline.sh                   # Deploy all + start local servers
#    ./pipeline.sh --deploy-only     # Deploy only (no local servers)
#    ./pipeline.sh --start-only      # Start local servers only (no deploy)
#    ./pipeline.sh --skip-pi         # Deploy Vercel services + start servers, skip Pi sync
#    ./pipeline.sh --status          # Check status of all services
#    ./pipeline.sh --stop            # Kill all local dev servers
#
#  The deploy phase pushes the latest code to Vercel (share, platform)
#  and optionally syncs archivio-server to the Raspberry Pi.
#  The start phase launches local Next.js dev servers for all three
#  frontend services (dashboard :3000, platform :3001, share :3002).
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Colors
G='\033[0;32m'   # green
R='\033[0;31m'   # red
Y='\033[1;33m'   # yellow
C='\033[0;36m'   # cyan
B='\033[1m'      # bold
NC='\033[0m'     # reset

# Ports
DASHBOARD_PORT=3000
PLATFORM_PORT=3001
SHARE_PORT=3002

step()  { echo -e "\n${C}${B}▶ $1${NC}"; }
ok()    { echo -e "  ${G}✔ $1${NC}"; }
warn()  { echo -e "  ${Y}⚠ $1${NC}"; }
fail()  { echo -e "  ${R}✖ $1${NC}"; }
info()  { echo -e "  ${B}$1${NC}"; }

# ── Parse flags ──────────────────────────────────────────────

DEPLOY=true
START=true
SKIP_PI=false

for arg in "$@"; do
  case "$arg" in
    --deploy-only) START=false ;;
    --start-only)  DEPLOY=false ;;
    --skip-pi)     SKIP_PI=true ;;
    --status)      exec "$0" _status ;;
    --stop)        exec "$0" _stop ;;
    _status)       ;; # handled below
    _stop)         ;; # handled below
  esac
done

# ── Status command ───────────────────────────────────────────

if [[ "${1:-}" == "_status" ]]; then
  echo -e "${B}Archivio Service Status${NC}"
  echo "─────────────────────────────────"

  for pair in "dashboard:$DASHBOARD_PORT" "platform:$PLATFORM_PORT" "share:$SHARE_PORT"; do
    name="${pair%%:*}"
    port="${pair##*:}"
    pid=$(lsof -ti :"$port" 2>/dev/null | head -1 || true)
    if [[ -n "$pid" ]]; then
      ok "$name (port $port) — PID $pid"
    else
      fail "$name (port $port) — not running"
    fi
  done

  echo ""
  if command -v curl &>/dev/null; then
    for pair in "Share health:http://localhost:$SHARE_PORT/api/health" "Pi health:http://monster-pi.local:5000/api/health"; do
      label="${pair%%:http*}"
      url="http${pair#*:http}"
      resp=$(curl -s --max-time 3 "$url" 2>/dev/null || echo "unreachable")
      if echo "$resp" | grep -q '"ok"\|"status":"ok"'; then
        ok "$label — $resp"
      else
        warn "$label — $resp"
      fi
    done
  fi
  exit 0
fi

# ── Stop command ─────────────────────────────────────────────

if [[ "${1:-}" == "_stop" ]]; then
  step "Stopping all local dev servers"
  for pair in "dashboard:$DASHBOARD_PORT" "platform:$PLATFORM_PORT" "share:$SHARE_PORT"; do
    name="${pair%%:*}"
    port="${pair##*:}"
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      echo "$pids" | xargs kill -9 2>/dev/null || true
      ok "Killed $name (port $port)"
    else
      info "$name (port $port) was not running"
    fi
  done
  exit 0
fi

# ── Banner ───────────────────────────────────────────────────

echo -e "${B}"
echo "╔══════════════════════════════════════════╗"
echo "║       Archivio Deployment Pipeline       ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"
echo "  Deploy: $DEPLOY  |  Start: $START  |  Skip Pi: $SKIP_PI"
echo ""

# ── Pre-flight checks ───────────────────────────────────────

step "Pre-flight checks"

if ! command -v node &>/dev/null; then
  fail "Node.js not found"; exit 1
fi
ok "Node.js $(node -v)"

if ! command -v npx &>/dev/null; then
  fail "npx not found"; exit 1
fi
ok "npx available"

if $DEPLOY; then
  if ! npx vercel --version &>/dev/null 2>&1; then
    warn "Vercel CLI not found globally — will use npx"
  else
    ok "Vercel CLI $(npx vercel --version 2>/dev/null)"
  fi
fi

for svc in archivio-dashboard archivio-platform archivio-share; do
  if [[ ! -d "$SCRIPT_DIR/$svc" ]]; then
    fail "Missing directory: $svc"; exit 1
  fi
  if [[ ! -d "$SCRIPT_DIR/$svc/node_modules" ]]; then
    warn "$svc/node_modules missing — running npm install"
    (cd "$SCRIPT_DIR/$svc" && npm install --silent)
    ok "$svc dependencies installed"
  else
    ok "$svc — deps OK"
  fi
done

# ── Deploy Phase ─────────────────────────────────────────────

if $DEPLOY; then

  # ── 1. Deploy archivio-share to Vercel ───────────────────
  step "Deploying archivio-share to Vercel"
  (
    cd "$SCRIPT_DIR/archivio-share"
    npx vercel pull --yes --environment=production 2>&1 | tail -3
    npx vercel build --prod 2>&1 | tail -5
    DEPLOY_URL=$(npx vercel deploy --prebuilt --prod 2>&1 | tail -1)
    ok "archivio-share deployed → $DEPLOY_URL"
  ) || { fail "archivio-share deploy failed"; }

  # ── 2. Deploy archivio-platform to Vercel ────────────────
  step "Deploying archivio-platform to Vercel"
  (
    cd "$SCRIPT_DIR/archivio-platform"
    npx vercel pull --yes --environment=production 2>&1 | tail -3
    npx vercel build --prod 2>&1 | tail -5
    DEPLOY_URL=$(npx vercel deploy --prebuilt --prod 2>&1 | tail -1)
    ok "archivio-platform deployed → $DEPLOY_URL"
  ) || { fail "archivio-platform deploy failed"; }

  # ── 3. Sync archivio-server to Raspberry Pi ──────────────
  if $SKIP_PI; then
    warn "Skipping Pi sync (--skip-pi)"
  else
    step "Syncing archivio-server to Raspberry Pi"
    if [[ -f "$SCRIPT_DIR/sync-to-pi.sh" ]]; then
      bash "$SCRIPT_DIR/sync-to-pi.sh" --restart 2>&1 | while IFS= read -r line; do
        echo "  $line"
      done
      ok "Pi server synced and restarted"
    else
      warn "sync-to-pi.sh not found — skipping Pi sync"
    fi

    # ── 4. Build & sync dashboard to Pi ───────────────────
    step "Building and syncing dashboard to Raspberry Pi"
    if [[ -f "$SCRIPT_DIR/sync-to-pi.sh" ]]; then
      bash "$SCRIPT_DIR/sync-to-pi.sh" --dashboard 2>&1 | while IFS= read -r line; do
        echo "  $line"
      done
      ok "Dashboard deployed to Pi"
    fi
  fi

  echo ""
  echo -e "${G}${B}Deploy phase complete!${NC}"
fi

# ── Start Phase ──────────────────────────────────────────────

if $START; then
  step "Starting local dev servers"

  # Kill any existing processes on our ports first
  for pair in "dashboard:$DASHBOARD_PORT" "platform:$PLATFORM_PORT" "share:$SHARE_PORT"; do
    name="${pair%%:*}"
    port="${pair##*:}"
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      echo "$pids" | xargs kill -9 2>/dev/null || true
      warn "Killed existing process on port $port ($name)"
      sleep 1
    fi
  done

  LOG_DIR="$SCRIPT_DIR/.logs"
  mkdir -p "$LOG_DIR"

  # Start each service in the background
  step "Starting archivio-dashboard on port $DASHBOARD_PORT"
  (cd "$SCRIPT_DIR/archivio-dashboard" && PORT=$DASHBOARD_PORT npm run dev > "$LOG_DIR/dashboard.log" 2>&1) &
  DASH_PID=$!
  ok "PID $DASH_PID — log: .logs/dashboard.log"

  step "Starting archivio-platform on port $PLATFORM_PORT"
  (cd "$SCRIPT_DIR/archivio-platform" && PORT=$PLATFORM_PORT npm run dev > "$LOG_DIR/platform.log" 2>&1) &
  PLAT_PID=$!
  ok "PID $PLAT_PID — log: .logs/platform.log"

  step "Starting archivio-share on port $SHARE_PORT"
  (cd "$SCRIPT_DIR/archivio-share" && PORT=$SHARE_PORT npm run dev > "$LOG_DIR/share.log" 2>&1) &
  SHARE_PID=$!
  ok "PID $SHARE_PID — log: .logs/share.log"

  # Wait for servers to be ready
  step "Waiting for servers to start"
  MAX_WAIT=30
  for pair in "dashboard:$DASHBOARD_PORT" "platform:$PLATFORM_PORT" "share:$SHARE_PORT"; do
    name="${pair%%:*}"
    port="${pair##*:}"
    elapsed=0
    while ! curl -s --max-time 1 "http://localhost:$port" >/dev/null 2>&1; do
      sleep 2
      elapsed=$((elapsed + 2))
      if [[ $elapsed -ge $MAX_WAIT ]]; then
        warn "$name (port $port) didn't respond in ${MAX_WAIT}s — check .logs/$name.log"
        break
      fi
    done
    if [[ $elapsed -lt $MAX_WAIT ]]; then
      ok "$name ready on http://localhost:$port (${elapsed}s)"
    fi
  done

  # ── Summary ────────────────────────────────────────────────

  echo ""
  echo -e "${B}╔══════════════════════════════════════════╗${NC}"
  echo -e "${B}║          All Services Running            ║${NC}"
  echo -e "${B}╠══════════════════════════════════════════╣${NC}"
  echo -e "${B}║${NC}  Dashboard   ${G}http://localhost:$DASHBOARD_PORT${NC}        ${B}║${NC}"
  echo -e "${B}║${NC}  Platform    ${G}http://localhost:$PLATFORM_PORT${NC}        ${B}║${NC}"
  echo -e "${B}║${NC}  Share       ${G}http://localhost:$SHARE_PORT${NC}        ${B}║${NC}"
  echo -e "${B}║${NC}  Pi Server   ${Y}http://monster-pi.local:5000${NC}  ${B}║${NC}"
  echo -e "${B}╠══════════════════════════════════════════╣${NC}"
  echo -e "${B}║${NC}  Logs: ${C}.logs/{dashboard,platform,share}.log${NC}${B}║${NC}"
  echo -e "${B}║${NC}  Stop: ${C}./pipeline.sh --stop${NC}               ${B}║${NC}"
  echo -e "${B}║${NC}  Status: ${C}./pipeline.sh --status${NC}           ${B}║${NC}"
  echo -e "${B}╚══════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  Press ${B}Ctrl+C${NC} to stop all servers"

  # Keep script alive so Ctrl+C kills all children
  trap "echo '' && echo -e '${Y}Shutting down...${NC}' && kill $DASH_PID $PLAT_PID $SHARE_PID 2>/dev/null; exit 0" INT TERM
  wait
fi
