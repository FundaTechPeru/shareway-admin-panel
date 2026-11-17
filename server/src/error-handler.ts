import type {ErrorRequestHandler} from 'express';
import {sendError} from './http-errors.js';
import type {Logger} from './logger.js';

/**
 * Last resort for a failure nothing else handled. Express 5 forwards rejected promises here, so
 * an unexpected error in a route answers 500 with the usual body instead of hanging the request.
 */
export function handleErrors(logger: Logger): ErrorRequestHandler {
  return (error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    logger.error({err: error}, 'the panel could not complete the request');
    sendError(req, res, 500, 'The panel could not complete the request');
  };
}
