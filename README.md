# IPMI Fan Controller

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

## Configuration (`.env`)

- `IPMI_INTERFACE` default `open`
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

## Safety note

Manual fan control can damage hardware if misconfigured. Validate sensor names and commands on your specific platform before long-term use.
