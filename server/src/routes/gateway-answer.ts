import type {Response} from 'express';
import type {GatewayAnswer} from '../gateway.js';

/**
 * Hands the answer of a service to the browser as it came, status code included. The panel does
 * not reshape a 409 or a validation error: the screens are written against the same codes the
 * services already use.
 */
export function answerFromGateway(res: Response, answer: GatewayAnswer): void {
  if (answer.body === undefined) {
    res.status(answer.status).end();
    return;
  }
  res.status(answer.status).json(answer.body);
}
