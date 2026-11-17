import type {ErrorRequestHandler} from 'express';
import {GatewayUnavailableError} from './gateway.js';
import {sendError} from './http-errors.js';
import type {Logger} from './logger.js';

/**
 * Last resort for a failure nothing else handled. Express 5 forwards rejected promises here, so
 * an unexpected error in a route answers with the usual body instead of hanging the request. A
 * gateway that does not answer is not a failure of the panel: it is reported as 502.
 */
export function handleErrors(logger: Logger): ErrorRequestHandler {
  return (error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    if (error instanceof GatewayUnavailableError) {
      logger.warn(
        {path: error.path, err: error.cause},
        'the gateway did not answer',
      );
      sendError(req, res, 502, 'The ShareWay gateway did not answer');
      return;
    }
    logger.error({err: error}, 'the panel could not complete the request');
    sendError(req, res, 500, 'The panel could not complete the request');
  };
}
