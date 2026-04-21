#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="itm"
INSTALL_DIR="/opt/itm"
REMOVE_APP_DIR="false"
UNIT_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

usage() {
  cat <<EOF
Usage: sudo ./bin/uninstall-systemd.sh [--service-name <name>] [--install-dir <path>] [--remove-app-dir]

Options:
  --service-name <name>  systemd service name (default: itm)
  --install-dir <path>   App install directory (default: /opt/itm)
  --remove-app-dir       Also delete the install directory
  -h, --help             Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --service-name)
      SERVICE_NAME="$2"
      shift 2
      ;;
    --install-dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    --remove-app-dir)
      REMOVE_APP_DIR="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "$EUID" -ne 0 ]]; then
  echo "Run as root (example: sudo ./bin/uninstall-systemd.sh)" >&2
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl is required but was not found in PATH" >&2
  exit 1
fi

UNIT_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "[1/4] Stopping and disabling ${SERVICE_NAME}.service"
systemctl stop "${SERVICE_NAME}.service" 2>/dev/null || true
systemctl disable "${SERVICE_NAME}.service" 2>/dev/null || true

echo "[2/4] Removing systemd unit file"
if [[ -f "$UNIT_FILE" ]]; then
  rm -f "$UNIT_FILE"
else
  echo "Unit file not found: $UNIT_FILE"
fi

echo "[3/4] Reloading systemd"
systemctl daemon-reload
systemctl reset-failed

echo "[4/4] Optional app directory cleanup"
if [[ "$REMOVE_APP_DIR" == "true" ]]; then
  if [[ -d "$INSTALL_DIR" ]]; then
    rm -rf "$INSTALL_DIR"
    echo "Removed app directory: $INSTALL_DIR"
  else
    echo "App directory not found: $INSTALL_DIR"
  fi
else
  echo "Skipped app directory removal (use --remove-app-dir to enable)"
fi

echo
echo "Done."
