require('dotenv').config();

const { loadConfig } = require('./config');
const { IpmiClient } = require('./ipmi');
const { FanController } = require('./fanController');

const logger = {
  info: (message) => console.log(`[INFO] ${new Date().toISOString()} ${message}`),
  warn: (message) => console.warn(`[WARN] ${new Date().toISOString()} ${message}`),
  error: (message) => console.error(`[ERROR] ${new Date().toISOString()} ${message}`)
};

const run = async () => {
  const config = loadConfig();
  const ipmiClient = new IpmiClient(config.ipmi);
  const fanController = new FanController({ ipmiClient, config, logger });

  const shutdown = async (signal) => {
    logger.info(`Received ${signal}; shutting down.`);
    try {
      await fanController.stop();
      process.exit(0);
    } catch (error) {
      logger.error(`Shutdown failed: ${error.message}`);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => {
    shutdown('SIGINT').catch((error) => {
      logger.error(`Unexpected shutdown error: ${error.message}`);
      process.exit(1);
    });
  });

  process.on('SIGTERM', () => {
    shutdown('SIGTERM').catch((error) => {
      logger.error(`Unexpected shutdown error: ${error.message}`);
      process.exit(1);
    });
  });

  await fanController.start();
};

run().catch((error) => {
  logger.error(error.message);
  process.exit(1);
});
