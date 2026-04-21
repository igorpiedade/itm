# IPMI Temperature Monitor

Node.js daemon that uses `ipmitool` to control server fan speed based on CPU/system temperatures.

## What it does

- On startup, sets fan mode to **manual**.
- Polls IPMI temperature sensors every few seconds.
- Applies fan speed presets based on the hottest CPU/system reading.
- If any CPU reaches the critical threshold (default **85°C**), switches to **auto** fan mode for safety.
- Returns to **manual** mode only after CPU temperature drops below the recovery threshold (default **60°C**).

## Requirements

- Node.js 18+
- `ipmitool` installed and available in `PATH`
- Local IPMI device access on the server where this app runs

## Tested Hardware

- Dell PowerEdge R620

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy env template:

   ```bash
   cp .env.example .env
   ```

3. Edit `.env` if needed (defaults are local-only).

## Run

```bash
npm start
```

### Run from anywhere (global command)

From the project directory, install the command globally:

```bash
npm install -g .
```

Then start from any path on the server with:

```bash
itm
```

## Run as a `systemd` service

This repository includes a unit template at `deploy/systemd/itm.service`.

### Quick install (recommended)

From the project root:

```bash
sudo ./bin/install-systemd.sh
```

Optional flags:

```bash
sudo ./bin/install-systemd.sh --install-dir /srv/itm --service-name itm
```

This script will:

- copy/update the app files to the install directory
- create `.env` from `.env.example` if missing
- run `npm install --omit=dev`
- install/update `/etc/systemd/system/<service>.service`
- run `systemctl daemon-reload`
- run `systemctl enable --now <service>.service`

### Uninstall helper

Disable/remove the service unit:

```bash
sudo ./bin/uninstall-systemd.sh
```

Also remove the installed app directory:

```bash
sudo ./bin/uninstall-systemd.sh --remove-app-dir
```

Custom service and install path:

```bash
sudo ./bin/uninstall-systemd.sh --service-name itm --install-dir /srv/itm --remove-app-dir
```

### Manual install

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

If your project path is not `/opt/itm`, update both `WorkingDirectory`, `EnvironmentFile`, and `ExecStart` in `/etc/systemd/system/itm.service`, then run:

```bash
sudo systemctl daemon-reload
sudo systemctl restart itm.service
```

## Configuration (`.env`)

- `IPMI_INTERFACE` default `open` (do not use `lan`/`lanplus` in local-only mode)
- `POLL_INTERVAL_MS` default `5000`
- `MAX_CPU_TEMP_C` default `85`
- `RECOVERY_CPU_TEMP_C` default `60`
- `CPU_SENSOR_REGEX` default `(^temp$|cpu)`
- `SYSTEM_SENSOR_REGEX` default `(system|sys|inlet|ambient|exhaust)`
- `FAN_PRESETS` default `0:10,51:15,60:25,70:40,75:60,80:80,85:100`
- `RESTORE_AUTO_ON_EXIT` default `true`

For platforms where CPU sensors are exposed as plain `Temp`, keep the default `CPU_SENSOR_REGEX`.

### Preset table example

| Temperature (°C) | Fan Speed (%) |
|---|---:|
| `< 51` | 10 |
| `>= 51` | 15 |
| `>= 60` | 25 |
| `>= 70` | 40 |
| `>= 75` | 60 |
| `>= 80` | 80 |
| `>= 85` | 100 |

## Vendor-specific IPMI commands

Different vendors expose fan control differently. Default raw commands are common for Supermicro boards.

If needed, override these values in `.env`:

- `IPMI_SET_MANUAL_COMMAND`
- `IPMI_SET_AUTO_COMMAND`
- `IPMI_SET_FAN_SPEED_TEMPLATE` (must include `{{HEX_SPEED}}` token)
- `IPMI_SENSOR_COMMAND`

Example:

```env
IPMI_SET_MANUAL_COMMAND=raw 0x30 0x30 0x01 0x00
IPMI_SET_AUTO_COMMAND=raw 0x30 0x30 0x01 0x01
IPMI_SET_FAN_SPEED_TEMPLATE=raw 0x30 0x30 0x02 0xff {{HEX_SPEED}}
IPMI_SENSOR_COMMAND=sdr type temperature
```

## Roadmap (Future Implementations)

- Separate how CPU and system temperatures affect fan speeds:
   - Add independent preset curves (for example, `CPU_FAN_PRESETS` and `SYSTEM_FAN_PRESETS`).
   - Keep CPU safety fallback thresholds while allowing system-specific ramp behavior.
- Add webhook/API controls for external automations:
   - Enable external systems to force **auto** or **manual** mode.
   - Optionally expose temporary fan-speed overrides for exceptional conditions not visible to IPMI sensors.
   - Add a status endpoint to report current mode, temperatures, and override state.

## Safety note

Manual fan control can damage hardware if misconfigured. Validate sensor names and commands on your specific platform before long-term use.
