import {createApp} from './app.js';
import {loadConfig} from './config.js';
import {createDependencies} from './dependencies.js';
import {startKeepWarm} from './jobs/keep-warm.js';
import {createLogger} from './logger.js';

const config = loadConfig();
const logger = createLogger(config.logLevel);

const server = createApp(createDependencies(config), logger).listen(
  config.port,
  () => {
    logger.info(
      {
        port: config.port,
        gatewayUrl: config.gatewayUrl,
        features: config.features,
      },
      'ShareWay admin panel listening',
    );
  },
);

// Keep the free-tier Render services awake while the panel is up on the VPS.
const keepWarm = startKeepWarm(config, logger);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down');
  keepWarm.stop();
  server.close(() => process.exit(0));
});
