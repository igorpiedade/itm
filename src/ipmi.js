const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

class IpmiClient {
  constructor(config) {
    this.config = config;
    this.lastSensorReadMeta = null;
  }

  async runCommand(commandParts) {
    const baseArgs = ['-I', this.config.interface];

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

  parseTempCFromReading(reading) {
    const normalized = String(reading || '').trim();
    if (!normalized) {
      return null;
    }

    if (/^na$/i.test(normalized)) {
      return null;
    }

    const explicitTempMatch = normalized.match(/(-?\d+(?:\.\d+)?)\s*(?:degrees?\s*)?\s*\u00b0?\s*c\b/i);
    if (explicitTempMatch) {
      return Number(explicitTempMatch[1]);
    }

    const numericOnlyMatch = normalized.match(/(-?\d+(?:\.\d+)?)/);
    if (numericOnlyMatch && /c\b/i.test(normalized)) {
      return Number(numericOnlyMatch[1]);
    }

    return null;
  }

  parseSensorLine(line) {
    const trimmedLine = String(line || '').trim();
    if (!trimmedLine) {
      return null;
    }

    let pieces = trimmedLine
      .split('|')
      .map((piece) => piece.trim())
      .filter(Boolean);

    if (pieces.length < 2) {
      pieces = trimmedLine
        .split(',')
        .map((piece) => piece.trim())
        .filter(Boolean);
    }

    if (pieces.length < 2) {
      return null;
    }

    const name = pieces[0];
    const readingCandidates = pieces.slice(1);
    const tempC = readingCandidates
      .map((candidate) => this.parseTempCFromReading(candidate))
      .find((value) => value !== null);
    if (tempC === null) {
      return null;
    }

    return { name, tempC };
  }

  async readTemperatureSensors() {
    const output = await this.runCommand(this.config.sensorCommand);

    const lines = output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const sensors = lines.map((line) => this.parseSensorLine(line)).filter(Boolean);

    this.lastSensorReadMeta = {
      lineCount: lines.length,
      parsedCount: sensors.length,
      sampleLine: lines[0] || null
    };

    return sensors;
  }
}

module.exports = {
  IpmiClient
};
