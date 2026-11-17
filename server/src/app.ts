import express, {type Express} from 'express';
import helmet from 'helmet';
import type {PanelConfig} from './config.js';
import {handleErrors} from './error-handler.js';
import {sendError} from './http-errors.js';
import {createLogger, logRequests, type Logger} from './logger.js';
import {spaRouter} from './web.js';

/**
 * Builds the panel application; the server and the tests share it. The browser only ever talks
 * to this process: it serves the SPA and the /panel-api routes, and those routes are the ones
 * that call the gateway.
 */
export function createApp(
  config: PanelConfig,
  logger: Logger = createLogger(config.logLevel),
): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({contentSecurityPolicy: false}));
  app.use(express.json({limit: '64kb'}));
  app.use(logRequests(logger));
  const spa = spaRouter(config.webRoot, logger);
  if (spa) {
    app.use(spa);
  }
  app.use((req, res) => sendError(req, res, 404, 'Resource not found'));
  app.use(handleErrors(logger));
  return app;
}
