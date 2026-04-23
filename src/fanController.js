class FanController {
  constructor({ ipmiClient, config, logger = console }) {
    this.ipmiClient = ipmiClient;
    this.config = config;
    this.logger = logger;

    this.isRunning = false;
    this.intervalHandle = null;
    this.mode = 'manual';
    this.forceAutoMode = false;
    this.lastAppliedSpeed = null;
    this.isCycleInProgress = false;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      mode: this.mode,
      forceAutoMode: this.forceAutoMode,
      lastAppliedSpeed: this.lastAppliedSpeed
    };
  }

  async setControlMode(mode) {
    const normalizedMode = String(mode || '').trim().toLowerCase();

    if (!['auto', 'manual'].includes(normalizedMode)) {
      throw new Error(`Unsupported mode: ${mode}`);
    }

    if (normalizedMode === 'auto') {
      this.forceAutoMode = true;
      if (this.mode !== 'auto') {
        await this.ipmiClient.setAutoMode();
        this.mode = 'auto';
        this.lastAppliedSpeed = null;
      }
      this.logger.info('External control set mode to AUTO.');
      return this.getStatus();
    }

    this.forceAutoMode = false;
    if (this.mode !== 'manual') {
      await this.ipmiClient.setManualMode();
      this.mode = 'manual';
    }
    this.logger.info('External control set mode to MANUAL.');
    return this.getStatus();
  }

  getCpuTemps(sensors) {
    return sensors
      .filter((sensor) => this.config.cpuSensorRegex.test(sensor.name))
      .map((sensor) => sensor.tempC);
  }

  getSystemTemps(sensors) {
    return sensors
      .filter((sensor) => this.config.systemSensorRegex.test(sensor.name))
      .map((sensor) => sensor.tempC);
  }

  getInletTemps(sensors) {
    return sensors
      .filter((sensor) => /inlet/i.test(sensor.name))
      .map((sensor) => sensor.tempC);
  }

  maxOrNull(values) {
    if (!values.length) {
      return null;
    }

    return Math.max(...values);
  }

  getPresetSpeedForTemp(tempC) {
    let selectedSpeed = this.config.fanPresets[0].speed;

    for (const preset of this.config.fanPresets) {
      if (tempC >= preset.threshold) {
        selectedSpeed = preset.speed;
      } else {
        break;
      }
    }

    return selectedSpeed;
  }

  async start() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.logger.info('Setting fan mode to manual...');
    await this.ipmiClient.setManualMode();
    this.mode = 'manual';

    this.logger.info(`Starting monitor loop (${this.config.pollIntervalMs}ms interval)...`);

    await this.cycle();
    this.intervalHandle = setInterval(() => {
      this.cycle().catch((error) => {
        this.logger.error(`Monitor cycle failed: ${error.message}`);
      });
    }, this.config.pollIntervalMs);
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    if (this.config.restoreAutoOnExit) {
      this.logger.info('Restoring fan mode to auto...');
      await this.ipmiClient.setAutoMode();
      this.mode = 'auto';
    }
  }

  async cycle() {
    if (this.isCycleInProgress) {
      this.logger.warn('Previous cycle still running; skipping this iteration.');
      return;
    }

    this.isCycleInProgress = true;

    try {
      const sensors = await this.ipmiClient.readTemperatureSensors();

      if (this.forceAutoMode) {
        if (this.mode !== 'auto') {
          await this.ipmiClient.setAutoMode();
          this.mode = 'auto';
          this.lastAppliedSpeed = null;
        }
        return;
      }

      const cpuTemps = this.getCpuTemps(sensors);
      const systemTemps = this.getSystemTemps(sensors);
      const inletTemps = this.getInletTemps(sensors);
      const maxCpuTemp = this.maxOrNull(cpuTemps);
      const maxSystemTemp = this.maxOrNull(systemTemps);
      const maxInletTemp = this.maxOrNull(inletTemps);
      const referenceTemp = this.maxOrNull([maxCpuTemp, maxSystemTemp].filter((v) => v !== null));

      if (maxCpuTemp !== null && maxCpuTemp >= this.config.maxCpuTempC) {
        if (this.mode !== 'auto') {
          this.logger.warn(
            `CPU reached ${maxCpuTemp}°C (>= ${this.config.maxCpuTempC}°C). Switching control to AUTO for safety.`
          );
          await this.ipmiClient.setAutoMode();
          this.mode = 'auto';
          this.lastAppliedSpeed = null;
        }

        return;
      }

      if (this.mode === 'auto') {
        if (maxCpuTemp !== null && maxCpuTemp < this.config.recoveryCpuTempC) {
          this.logger.info(
            `CPU recovered to ${maxCpuTemp}°C (< ${this.config.recoveryCpuTempC}°C). Returning to MANUAL fan control.`
          );
          await this.ipmiClient.setManualMode();
          this.mode = 'manual';
        } else {
          return;
        }
      }

      if (referenceTemp === null) {
        const sensorMeta = this.ipmiClient.lastSensorReadMeta;
        const details = sensorMeta
          ? ` (raw lines: ${sensorMeta.lineCount}, parsed: ${sensorMeta.parsedCount}${
              sensorMeta.sampleLine ? `, sample: "${sensorMeta.sampleLine}"` : ''
            })`
          : '';
        this.logger.warn(`No temperature readings found; keeping current fan speed.${details}`);
        return;
      }

      const targetSpeed = this.getPresetSpeedForTemp(referenceTemp);
      if (targetSpeed !== this.lastAppliedSpeed) {
        const now = new Date();
        const date = now.toLocaleDateString();
        const time = now.toLocaleTimeString();

        this.logger.info(
          `Date: ${date} | Time: ${time} | max CPU: ${maxCpuTemp ?? 'n/a'}°C | max System: ${maxSystemTemp ?? 'n/a'}°C | inlet: ${maxInletTemp ?? 'n/a'}°C | fan speed: ${targetSpeed}% | mode: ${this.mode}`
        );
        await this.ipmiClient.setFanSpeedPercent(targetSpeed);
        this.lastAppliedSpeed = targetSpeed;
      }
    } finally {
      this.isCycleInProgress = false;
    }
  }
}

module.exports = {
  FanController
};
