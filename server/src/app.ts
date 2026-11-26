import express, {type Express} from 'express';
import helmet from 'helmet';
import type {PanelDependencies} from './dependencies.js';
import {handleErrors} from './error-handler.js';
import {sendError} from './http-errors.js';
import {createLogger, logRequests, type Logger} from './logger.js';
import {requireAdmin} from './middleware/auth.js';
import {loginRouter} from './routes/auth.js';
import {auditLogRouter} from './routes/audit-log.js';
import {driverDocumentsRouter} from './routes/driver-documents.js';
import {healthRouter, livenessRouter} from './routes/health.js';
import {settlementsRouter} from './routes/settlements.js';
import {tripRecordsRouter} from './routes/trip-records.js';
import {usersRouter} from './routes/users.js';
import {spaRouter} from './web.js';

/**
 * Builds the panel application; the server and the tests share it. The browser only ever talks
 * to this process: it serves the SPA and the /panel-api routes, and those routes are the ones
 * that call the gateway. Everything under /panel-api but the sign in needs a staff token.
 */
export function createApp(
  deps: PanelDependencies,
  logger: Logger = createLogger(deps.config.logLevel),
): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({contentSecurityPolicy: false}));
  app.use(express.json({limit: '64kb'}));
  app.use(logRequests(logger));
  app.use(livenessRouter());
  app.use('/panel-api', loginRouter(deps));
  app.use('/panel-api', requireAdmin());
  app.use('/panel-api', healthRouter(deps));
  app.use('/panel-api', driverDocumentsRouter(deps));
  app.use('/panel-api', tripRecordsRouter(deps));
  app.use('/panel-api', auditLogRouter(deps));
  app.use('/panel-api', settlementsRouter(deps));
  app.use('/panel-api', usersRouter(deps));
  const spa = spaRouter(deps.config.webRoot, logger);
  if (spa) {
    app.use(spa);
  }
  app.use((req, res) => sendError(req, res, 404, 'Resource not found'));
  app.use(handleErrors(logger));
  return app;
}
