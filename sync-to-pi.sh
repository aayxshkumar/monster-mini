#!/bin/bash

# ============================================================
#  sync-to-pi.sh — Sync archivio-server to Raspberry Pi
#
#  Setup: Server runs on Pi only. Dashboard runs on this Mac and
#  talks to the Pi via NEXT_PUBLIC_PI_URL (default: monster-pi.local:5000).
#
#  SSH: Prefer key-based auth (run once: ssh-copy-id monster-pi@monster-pi.local).
#  If no key, the script uses sshpass with PI_PASSWORD (set below or in .pi_password).
#
#  Usage:
#    ./sync-to-pi.sh                 # Sync server files only
#    ./sync-to-pi.sh --restart       # Sync + restart server on Pi
#    ./sync-to-pi.sh --dashboard     # Build & sync dashboard to Pi
#    ./sync-to-pi.sh --watchdog      # Sync & install the watchdog service
#    ./sync-to-pi.sh --status       # Check server status on Pi
#    ./sync-to-pi.sh --fix-permissions  # Fix ownership on Pi (run if sync fails with Permission denied)
# ============================================================

# Configuration — adjust for your Pi
PI_USER="monster-pi"
PI_HOST="monster-pi.local"
# Password only used when SSH keys are not set up. Or create .pi_password (gitignored).
PI_PASSWORD="${PI_PASSWORD:-}"
if [ -z "$PI_PASSWORD" ] && [ -f "$(dirname "$0")/.pi_password" ]; then
  PI_PASSWORD="$(cat "$(dirname "$0")/.pi_password" | head -1)"
fi

# Paths: derive from script location so it works from any machine
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCAL_PATH="$SCRIPT_DIR/archivio-server/"
REMOTE_PATH="~/archivio-server"
DASHBOARD_LOCAL="$SCRIPT_DIR/archivio-dashboard"
DASHBOARD_REMOTE="~/archivio-dashboard"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Detect auth: try SSH key first (no password)
USE_SSH_KEY=0
if ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$PI_USER@$PI_HOST" "true" 2>/dev/null; then
  USE_SSH_KEY=1
fi

if [ "$USE_SSH_KEY" -eq 1 ]; then
  SSH_CMD="ssh -o StrictHostKeyChecking=no $PI_USER@$PI_HOST"
  RSYNC_RSH="ssh -o StrictHostKeyChecking=no"
else
  if [ -z "$PI_PASSWORD" ]; then
    echo -e "${RED}SSH key auth failed and PI_PASSWORD is not set.${NC}"
    echo "Either:"
    echo "  1. Set up SSH keys: ssh-copy-id $PI_USER@$PI_HOST"
    echo "  2. Or set password: export PI_PASSWORD=yourpass"
    echo "  3. Or create file:  $(dirname "$0")/.pi_password  (one line: password)"
    exit 1
  fi
  if ! command -v sshpass &>/dev/null; then
    echo -e "${RED}sshpass is required for password auth. Install: brew install hudochenkov/sshpass/sshpass${NC}"
    exit 1
  fi
  # sshpass in -e so the SSH that rsync spawns gets the password
  RSYNC_RSH="sshpass -p $PI_PASSWORD ssh -o StrictHostKeyChecking=no"
  SSH_CMD="sshpass -p $PI_PASSWORD ssh -o StrictHostKeyChecking=no $PI_USER@$PI_HOST"
fi

# Handle --status flag
if [ "$1" = "--status" ]; then
  echo "Checking server status on Pi..."
  if $SSH_CMD "systemctl is-enabled archivio-server 2>/dev/null" | grep -q "enabled"; then
    $SSH_CMD "sudo systemctl status archivio-server --no-pager -l 2>&1 | head -15"
  else
    $SSH_CMD "pgrep -f 'python3.*server.py' && echo 'Server is running' || echo 'Server is NOT running'"
  fi
  exit 0
fi

# Fix permissions on Pi so monster-pi can write to ~/archivio-server (stickers/, uploads/, etc.)
# Run this once if you see "Permission denied" during sync (e.g. if server was run with sudo)
fix_permissions_on_pi() {
  echo -e "${YELLOW}Fixing ownership on Pi (~/archivio-server)...${NC}"
  $SSH_CMD "mkdir -p $REMOTE_PATH && sudo chown -R $PI_USER:$PI_USER $REMOTE_PATH"
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Ownership fixed. You can run sync again.${NC}"
  else
    echo -e "${RED}Could not fix (sudo may need a password).${NC}"
    echo "SSH to the Pi and run: sudo chown -R $PI_USER:$PI_USER ~/archivio-server"
    return 1
  fi
}

if [ "$1" = "--fix-permissions" ]; then
  fix_permissions_on_pi
  exit $?
fi

# Ensure Pi user owns the destination so rsync can write (e.g. into stickers/, uploads/)
echo -e "${YELLOW}Ensuring Pi user owns ~/archivio-server...${NC}"
$SSH_CMD "mkdir -p $REMOTE_PATH && sudo chown -R $PI_USER:$PI_USER $REMOTE_PATH 2>/dev/null" || true

echo -e "${YELLOW}Syncing archivio-server to Raspberry Pi...${NC}"

# Rsync: -e "$RSYNC_RSH" so password is passed when not using keys
rsync -avz --delete \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='server.log' \
  --exclude='server.py.bak' \
  --exclude='previews/' \
  --exclude='.DS_Store' \
  --exclude='font_cache/' \
  -e "$RSYNC_RSH" \
  "$LOCAL_PATH" "$PI_USER@$PI_HOST:$REMOTE_PATH/"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}Sync completed successfully!${NC}"
else
  echo -e "${RED}Sync failed!${NC}"
  echo ""
  echo "If you saw 'Permission denied' in stickers/ or uploads/, fix ownership on the Pi:"
  echo "  ./sync-to-pi.sh --fix-permissions"
  echo "  (You may need to enter the Pi's sudo password, or run the chown once via SSH.)"
  echo "Then run ./sync-to-pi.sh --restart again."
  exit 1
fi

# Handle --restart flag
if [ "$1" = "--restart" ]; then
  echo -e "${YELLOW}Restarting server on Pi...${NC}"
  # Prefer systemd if the service is installed
  if $SSH_CMD "systemctl is-enabled archivio-server 2>/dev/null" | grep -q "enabled"; then
    $SSH_CMD "sudo systemctl restart archivio-server"
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}Server restarted via systemd (gunicorn).${NC}"
      sleep 3
      $SSH_CMD "sudo systemctl is-active archivio-server --quiet && echo 'Server is running on port 5000' || echo 'WARNING: Server may not have started'"
    else
      echo -e "${RED}Failed to restart server via systemd${NC}"
      exit 1
    fi
  else
    # Fallback: nohup (for first-time setup before systemd is installed)
    $SSH_CMD "sudo pkill -9 -f 'python3.*server.py' 2>/dev/null; pkill -9 -f 'python3.*server.py' 2>/dev/null; sleep 2"
    $SSH_CMD "cd $REMOTE_PATH && nohup python3 server.py > server.log 2>&1 &"
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}Server restarted on Pi (nohup).${NC}"
      sleep 2
      $SSH_CMD "pgrep -f 'python3.*server.py' > /dev/null && echo 'Server is running on port 5000' || echo 'WARNING: Server may not have started'"
    else
      echo -e "${RED}Failed to restart server${NC}"
      exit 1
    fi
  fi
fi

# Handle --dashboard flag: build and sync the Next.js dashboard to Pi
if [ "$1" = "--dashboard" ]; then
  echo -e "${YELLOW}Building dashboard for production...${NC}"
  (cd "$DASHBOARD_LOCAL" && npm run build) || { echo -e "${RED}Dashboard build failed${NC}"; exit 1; }
  echo -e "${GREEN}Build complete${NC}"

  echo -e "${YELLOW}Syncing dashboard to Pi...${NC}"
  $SSH_CMD "mkdir -p $DASHBOARD_REMOTE/.next/static $DASHBOARD_REMOTE/public"

  rsync -avz --delete \
    --exclude='node_modules' \
    --exclude='.env.local' \
    -e "$RSYNC_RSH" \
    "$DASHBOARD_LOCAL/.next/standalone/" "$PI_USER@$PI_HOST:$DASHBOARD_REMOTE/"

  rsync -avz --delete \
    -e "$RSYNC_RSH" \
    "$DASHBOARD_LOCAL/.next/static/" "$PI_USER@$PI_HOST:$DASHBOARD_REMOTE/.next/static/"

  rsync -avz --delete \
    -e "$RSYNC_RSH" \
    "$DASHBOARD_LOCAL/public/" "$PI_USER@$PI_HOST:$DASHBOARD_REMOTE/public/"

  # Copy systemd service if not yet installed
  rsync -avz \
    -e "$RSYNC_RSH" \
    "$DASHBOARD_LOCAL/archivio-dashboard.service" "$PI_USER@$PI_HOST:~/archivio-dashboard.service"

  echo -e "${GREEN}Dashboard synced to Pi${NC}"

  # Restart dashboard service if installed
  if $SSH_CMD "systemctl is-enabled archivio-dashboard 2>/dev/null" | grep -q "enabled"; then
    $SSH_CMD "sudo systemctl restart archivio-dashboard"
    echo -e "${GREEN}Dashboard service restarted${NC}"
  else
    echo -e "${YELLOW}Dashboard service not installed yet. To install:${NC}"
    echo "  ssh $PI_USER@$PI_HOST"
    echo "  sudo cp ~/archivio-dashboard.service /etc/systemd/system/"
    echo "  sudo systemctl daemon-reload && sudo systemctl enable --now archivio-dashboard"
  fi
fi

# Handle --watchdog flag: sync and install the watchdog service
if [ "$1" = "--watchdog" ]; then
  echo -e "${YELLOW}Syncing watchdog to Pi...${NC}"
  rsync -avz \
    -e "$RSYNC_RSH" \
    "$SCRIPT_DIR/archivio-watchdog.sh" "$PI_USER@$PI_HOST:~/archivio-watchdog.sh"

  $SSH_CMD "chmod +x ~/archivio-watchdog.sh"
  echo -e "${GREEN}Watchdog synced${NC}"

  echo -e "${YELLOW}Installing watchdog service...${NC}"
  $SSH_CMD "sudo bash ~/archivio-watchdog.sh --install"
  echo -e "${GREEN}Watchdog service installed and running${NC}"
  echo ""
  echo "  View logs: ssh $PI_USER@$PI_HOST 'journalctl -u archivio-watchdog -f'"
  echo "  Status:    ssh $PI_USER@$PI_HOST 'bash ~/archivio-watchdog.sh --status'"
fi

echo -e "${GREEN}Done!${NC}"
