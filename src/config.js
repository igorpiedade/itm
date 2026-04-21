const toNumber = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
};

const parsePresets = (value) => {
  const fallback = [
    { threshold: 0, speed: 10 },
    { threshold: 51, speed: 15 },
    { threshold: 60, speed: 25 },
    { threshold: 70, speed: 40 },
    { threshold: 75, speed: 60 },
    { threshold: 80, speed: 80 },
    { threshold: 85, speed: 100 }
  ];

  if (!value) {
    return fallback;
  }

  const parsed = String(value)
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [rawThreshold, rawSpeed] = pair.split(':').map((piece) => piece?.trim());
      const threshold = Number(rawThreshold);
      const speed = Number(rawSpeed);

      if (!Number.isFinite(threshold) || !Number.isFinite(speed)) {
        throw new Error(`Invalid FAN_PRESETS entry: ${pair}`);
      }

      if (speed < 0 || speed > 100) {
        throw new Error(`Preset speed must be between 0 and 100: ${pair}`);
      }

      return { threshold, speed };
    })
    .sort((a, b) => a.threshold - b.threshold);

  if (!parsed.length) {
    throw new Error('FAN_PRESETS has no valid presets');
  }

  return parsed;
};

const splitCommand = (commandValue) => {
  if (!commandValue) {
    return null;
  }

  return commandValue
    .split(/\s+/)
    .map((piece) => piece.trim())
    .filter(Boolean);
};

const toRegExp = (value, fallbackPattern, keyName) => {
  const pattern = value || fallbackPattern;

  try {
    return new RegExp(pattern, 'i');
  } catch (error) {
    throw new Error(`Invalid regex for ${keyName}: ${pattern}`);
  }
};

const loadConfig = () => {
  const required = ['IPMI_HOST', 'IPMI_USER', 'IPMI_PASSWORD'];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return {
    ipmi: {
      host: process.env.IPMI_HOST,
      user: process.env.IPMI_USER,
      password: process.env.IPMI_PASSWORD,
      interface: process.env.IPMI_INTERFACE || 'lanplus',
      setManualCommand: splitCommand(process.env.IPMI_SET_MANUAL_COMMAND) || ['raw', '0x30', '0x30', '0x01', '0x00'],
      setAutoCommand: splitCommand(process.env.IPMI_SET_AUTO_COMMAND) || ['raw', '0x30', '0x30', '0x01', '0x01'],
      setFanSpeedTemplate:
        splitCommand(process.env.IPMI_SET_FAN_SPEED_TEMPLATE) || ['raw', '0x30', '0x30', '0x02', '0xff', '{{HEX_SPEED}}'],
      sensorCommand: splitCommand(process.env.IPMI_SENSOR_COMMAND) || ['sdr', 'type', 'temperature']
    },
    pollIntervalMs: toNumber(process.env.POLL_INTERVAL_MS, 5000),
    maxCpuTempC: toNumber(process.env.MAX_CPU_TEMP_C, 85),
    recoveryCpuTempC: toNumber(process.env.RECOVERY_CPU_TEMP_C, 60),
    fanPresets: parsePresets(process.env.FAN_PRESETS),
    restoreAutoOnExit: toBoolean(process.env.RESTORE_AUTO_ON_EXIT, true),
    cpuSensorRegex: toRegExp(process.env.CPU_SENSOR_REGEX, '(^temp$|cpu)', 'CPU_SENSOR_REGEX'),
    systemSensorRegex: toRegExp(
      process.env.SYSTEM_SENSOR_REGEX,
      '(system|sys|inlet|ambient|exhaust)',
      'SYSTEM_SENSOR_REGEX'
    )
  };
};

module.exports = {
  loadConfig
};
