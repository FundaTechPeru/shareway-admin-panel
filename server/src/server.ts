import {createApp} from './app.js';
import {loadConfig} from './config.js';
import {createDependencies} from './dependencies.js';
import {createLogger} from './logger.js';

const config = loadConfig();
const logger = createLogger(config.logLevel);

createApp(createDependencies(config), logger).listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      gatewayUrl: config.gatewayUrl,
      features: config.features,
    },
    'ShareWay admin panel listening',
  );
});
