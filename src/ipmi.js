const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

class IpmiClient {
  constructor(config) {
    this.config = config;
  }

  async runCommand(commandParts) {
    const baseArgs = [
      '-I',
      this.config.interface,
      '-H',
      this.config.host,
      '-U',
      this.config.user,
      '-P',
      this.config.password
    ];

    const args = [...baseArgs, ...commandParts];

    try {
      const { stdout } = await execFileAsync('ipmitool', args);
      return (stdout || '').trim();
    } catch (error) {
      const details = error.stderr || error.message || 'unknown error';
      throw new Error(`ipmitool failed: ${details}`);
    }
  }

  async setManualMode() {
    await this.runCommand(this.config.setManualCommand);
  }

  async setAutoMode() {
    await this.runCommand(this.config.setAutoCommand);
  }

  async setFanSpeedPercent(percent) {
    const bounded = Math.max(0, Math.min(100, Math.round(percent)));
    const hexSpeed = `0x${bounded.toString(16).padStart(2, '0')}`;
    const command = this.config.setFanSpeedTemplate.map((part) =>
      part === '{{HEX_SPEED}}' ? hexSpeed : part
    );

    await this.runCommand(command);
  }

  async readTemperatureSensors() {
    const output = await this.runCommand(this.config.sensorCommand);

    const lines = output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const sensors = [];

    for (const line of lines) {
      const pieces = line.split('|').map((piece) => piece.trim());
      if (pieces.length < 2) {
        continue;
      }

      const name = pieces[0];
      const reading = pieces[1];
      const match = reading.match(/(-?\d+(?:\.\d+)?)\s*degrees\s*C/i);
      if (!match) {
        continue;
      }

      sensors.push({
        name,
        tempC: Number(match[1])
      });
    }

    return sensors;
  }
}

module.exports = {
  IpmiClient
};
