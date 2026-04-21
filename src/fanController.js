class FanController {
  constructor({ ipmiClient, config, logger = console }) {
    this.ipmiClient = ipmiClient;
    this.config = config;
    this.logger = logger;

    this.isRunning = false;
    this.intervalHandle = null;
    this.mode = 'manual';
    this.lastAppliedSpeed = null;
    this.isCycleInProgress = false;
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
      const cpuTemps = this.getCpuTemps(sensors);
      const systemTemps = this.getSystemTemps(sensors);
      const maxCpuTemp = this.maxOrNull(cpuTemps);
      const maxSystemTemp = this.maxOrNull(systemTemps);
      const referenceTemp = this.maxOrNull([maxCpuTemp, maxSystemTemp].filter((v) => v !== null));
      const fanStatus = this.mode === 'auto' ? 'auto' : `${this.lastAppliedSpeed ?? 'n/a'}%`;

      this.logger.info(
        `Temps | max CPU: ${maxCpuTemp ?? 'n/a'}°C | max System: ${maxSystemTemp ?? 'n/a'}°C | fan: ${fanStatus} | mode: ${this.mode}`
      );

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
        this.logger.info(`Applying fan speed ${targetSpeed}% for reference temp ${referenceTemp}°C.`);
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
