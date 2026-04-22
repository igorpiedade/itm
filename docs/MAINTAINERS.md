# Maintainer Notes

This document contains development and maintenance instructions intentionally kept out of the public-facing `README.md`.

## Install from source

1. Clone the repository and enter it.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy env template:

   ```bash
   cp .env.example .env
   ```

4. Edit `.env` if needed.

## Local run from source

```bash
npm start
```

## Manual `systemd` installation

1. Place the project in `/opt/itm` (or edit paths in the unit file):

   ```bash
   sudo mkdir -p /opt
   sudo cp -R "$PWD" /opt/itm
   cd /opt/itm
   npm install --omit=dev
   cp .env.example .env
   ```

2. Install and enable the service:

   ```bash
   sudo cp deploy/systemd/itm.service /etc/systemd/system/itm.service
   sudo systemctl daemon-reload
   sudo systemctl enable --now itm.service
   ```

3. Common operations:

   ```bash
   sudo systemctl status itm.service
   sudo systemctl restart itm.service
   sudo systemctl stop itm.service
   sudo journalctl -u itm.service -f
   ```

If your project path is not `/opt/itm`, update `WorkingDirectory`, `EnvironmentFile`, and `ExecStart` in `/etc/systemd/system/itm.service`, then run:

```bash
sudo systemctl daemon-reload
sudo systemctl restart itm.service
```

## Roadmap (Future Implementations)

- Separate how CPU and system temperatures affect fan speeds:
  - Add independent preset curves (for example, `CPU_FAN_PRESETS` and `SYSTEM_FAN_PRESETS`).
  - Keep CPU safety fallback thresholds while allowing system-specific ramp behavior.
- Add webhook/API controls for external automations:
  - Enable external systems to force **auto** or **manual** mode.
  - Optionally expose temporary fan-speed overrides for exceptional conditions not visible to IPMI sensors.
  - Add a status endpoint to report current mode, temperatures, and override state.
