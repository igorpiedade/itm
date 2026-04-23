# IPMI Temperature Monitor

Node.js daemon that uses `ipmitool` to control server fan speed based on CPU/system temperatures.

## What it does

- On startup, sets fan mode to **manual**.
- Polls IPMI temperature sensors every few seconds.
- Applies fan speed presets based on the hottest CPU/system reading.
- Logs status only when fan speed changes (date, time, max CPU, max system, inlet, fan speed, mode).
- If any CPU reaches the critical threshold (default **85°C**), switches to **auto** fan mode for safety.
- Returns to **manual** mode only after CPU temperature drops below the recovery threshold (default **60°C**).

## Requirements

- Node.js 18+
- `ipmitool` installed and available in `PATH`
- Local IPMI device access on the server where this app runs

## Tested Hardware

- Dell PowerEdge R620

## Install

### From npm (recommended)

```bash
npm install -g itm
```

## Run

Start the monitor in foreground:

```bash
itm
```

## Run as a `systemd` service

The CLI includes service helpers (`itm service-install` / `itm service-uninstall`).

### Quick install (recommended)

Install/enable the service:

```bash
sudo itm service-install
```

Optional flags:

```bash
sudo itm service-install --install-dir /srv/itm --service-name itm
```

Short alias also available:

```bash
sudo itm-service-install --install-dir /srv/itm --service-name itm
```

### Uninstall helper

Disable/remove the service unit:

```bash
sudo itm service-uninstall
```

Also remove the installed app directory:

```bash
sudo itm service-uninstall --remove-app-dir
```

Custom service and install path:

```bash
sudo itm service-uninstall --service-name itm --install-dir /srv/itm --remove-app-dir
```

Short alias also available:

```bash
sudo itm-service-uninstall --service-name itm --install-dir /srv/itm --remove-app-dir
```

## Configuration (`.env`)

- `IPMI_INTERFACE` default `open` (do not use `lan`/`lanplus` in local-only mode)
- `POLL_INTERVAL_MS` default `30000`
- `MAX_CPU_TEMP_C` default `85`
- `RECOVERY_CPU_TEMP_C` default `60`
- `CPU_SENSOR_REGEX` default `(^temp$|cpu)`
- `SYSTEM_SENSOR_REGEX` default `(system|sys|inlet|ambient|exhaust)`
- `FAN_PRESETS` default `0:10,51:15,60:25,70:40,75:60,80:80,85:100`
- `RESTORE_AUTO_ON_EXIT` default `true`
- `API_ENABLED` default `false`
- `API_HOST` default `127.0.0.1`
- `API_PORT` default `7001`
- `API_AUTH_TOKEN` required when `API_ENABLED=true`

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

## External Control API

Enable API in `.env`:

```env
API_ENABLED=true
API_HOST=127.0.0.1
API_PORT=7001
API_AUTH_TOKEN=super-secret-token
```

Authentication uses bearer token in `Authorization` header.

Get current status:

```bash
curl -s \
	-H "Authorization: Bearer super-secret-token" \
	http://127.0.0.1:7001/api/v1/status
```

Switch to auto mode:

```bash
curl -s -X POST \
	-H "Authorization: Bearer super-secret-token" \
	-H "Content-Type: application/json" \
	-d '{"mode":"auto"}' \
	http://127.0.0.1:7001/api/v1/mode
```

Switch to manual mode:

```bash
curl -s -X POST \
	-H "Authorization: Bearer super-secret-token" \
	-H "Content-Type: application/json" \
	-d '{"mode":"manual"}' \
	http://127.0.0.1:7001/api/v1/mode
```

## Roadmap (Future Implementations)

- Separate how CPU and system temperatures affect fan speeds:
	- Add independent preset curves (for example, `CPU_FAN_PRESETS` and `SYSTEM_FAN_PRESETS`).
	- Keep CPU safety fallback thresholds while allowing system-specific ramp behavior.
- Add webhook/API controls for external automations:
	- Enable external systems to force **auto** or **manual** mode.
	- Optionally expose temporary fan-speed overrides for exceptional conditions not visible to IPMI sensors.
	- Add a status endpoint to report current mode, temperatures, and override state.

## Maintainers

Development and maintenance instructions are in [`docs/MAINTAINERS.md`](docs/MAINTAINERS.md).

## Safety note

Manual fan control can damage hardware if misconfigured. Validate sensor names and commands on your specific platform before long-term use.
