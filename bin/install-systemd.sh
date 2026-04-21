#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="itm"
INSTALL_DIR="/opt/itm"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT_SOURCE="$ROOT_DIR/deploy/systemd/itm.service"
UNIT_TARGET="/etc/systemd/system/${SERVICE_NAME}.service"

usage() {
  cat <<EOF
Usage: sudo ./bin/install-systemd.sh [--install-dir <path>] [--service-name <name>]

Options:
  --install-dir <path>   Target app directory (default: /opt/itm)
  --service-name <name>  systemd service name (default: itm)
  -h, --help             Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    --service-name)
      SERVICE_NAME="$2"
      shift 2
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
  echo "Run as root (example: sudo ./bin/install-systemd.sh)" >&2
  exit 1
fi

if [[ ! -f "$UNIT_SOURCE" ]]; then
  echo "Missing unit template: $UNIT_SOURCE" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but was not found in PATH" >&2
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl is required but was not found in PATH" >&2
  exit 1
fi

echo "[1/6] Installing project to $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
cp -R "$ROOT_DIR/." "$INSTALL_DIR/"

if [[ ! -f "$INSTALL_DIR/.env" && -f "$INSTALL_DIR/.env.example" ]]; then
  echo "[2/6] Creating .env from .env.example"
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
else
  echo "[2/6] Keeping existing .env"
fi

echo "[3/6] Installing production dependencies"
cd "$INSTALL_DIR"
npm install --omit=dev

echo "[4/6] Installing systemd unit"
cp "$UNIT_SOURCE" "$UNIT_TARGET"
sed -i.bak \
  -e "s|^WorkingDirectory=.*$|WorkingDirectory=$INSTALL_DIR|" \
  -e "s|^EnvironmentFile=.*$|EnvironmentFile=-$INSTALL_DIR/.env|" \
  -e "s|^ExecStart=.*$|ExecStart=/usr/bin/env node $INSTALL_DIR/src/index.js|" \
  "$UNIT_TARGET"
rm -f "${UNIT_TARGET}.bak"

echo "[5/6] Reloading systemd and enabling service"
systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}.service"

echo "[6/6] Service status"
systemctl --no-pager --full status "${SERVICE_NAME}.service" || true

echo
echo "Done. Useful commands:"
echo "  sudo systemctl restart ${SERVICE_NAME}.service"
echo "  sudo systemctl status ${SERVICE_NAME}.service"
echo "  sudo journalctl -u ${SERVICE_NAME}.service -f"
