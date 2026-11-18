import type {RequestHandler, Response} from 'express';
import {pino, type Logger} from 'pino';
import {pinoHttp} from 'pino-http';

export type {Logger};

interface SerializedRequest {
  id: string | number;
  method: string;
  url: string;
}

interface SerializedResponse {
  statusCode: number;
}

/** JSON logger of the panel. Tokens and cookies never reach the logs. */
export function createLogger(level: string): Logger {
  return pino({
    level,
    base: {service: 'shareway-admin-panel'},
    redact: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'res.headers["set-cookie"]',
    ],
  });
}

/**
 * Logs one line per request with its method, path, status code and duration, plus the admin the
 * token belongs to once the guard has read it.
 */
export function logRequests(logger: Logger): RequestHandler {
  return pinoHttp({
    logger,
    customLogLevel: (_req, res, error) => {
      if (error || res.statusCode >= 500) {
        return 'error';
      }
      return res.statusCode >= 400 ? 'warn' : 'info';
    },
    customProps: (_req, res) => ({
      adminId: (res as Response).locals?.admin?.id,
    }),
    serializers: {
      req: (req: SerializedRequest) => ({
        id: req.id,
        method: req.method,
        url: req.url,
      }),
      res: (res: SerializedResponse) => ({statusCode: res.statusCode}),
    },
  });
}
