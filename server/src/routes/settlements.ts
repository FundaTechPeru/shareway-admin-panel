import express, {type Router} from 'express';
import type {PanelDependencies} from '../dependencies.js';
import {sendError} from '../http-errors.js';
import {admin} from '../middleware/auth.js';
import {answerFromGateway} from './gateway-answer.js';

const STATUSES = ['PENDING', 'PAID'] as const;

/**
 * Driver settlements (US-25). Both routes exist in Payments & Settlement already, so the panel
 * only forwards them with the token of the admin and hands the answer back as it came: the 409
 * of a settlement that was already paid included.
 */
export function settlementsRouter(deps: PanelDependencies): Router {
  const router = express.Router();

  router.get('/settlements', async (req, res) => {
    const status = req.query['status'];
    if (status !== undefined && !isStatus(status)) {
      sendError(req, res, 400, 'Filter the settlements by PENDING or by PAID');
      return;
    }
    const path = isStatus(status)
      ? `/api/v1/admin/settlements?status=${status}`
      : '/api/v1/admin/settlements';
    answerFromGateway(
      res,
      await deps.gateway.call({path, token: admin(res).token}),
    );
  });

  router.patch('/settlements/:id/mark-paid', async (req, res) => {
    answerFromGateway(
      res,
      await deps.gateway.call({
        method: 'PATCH',
        path: `/api/v1/admin/settlements/${encodeURIComponent(req.params.id)}/mark-paid`,
        token: admin(res).token,
      }),
    );
  });

  return router;
}

function isStatus(value: unknown): value is (typeof STATUSES)[number] {
  return (
    typeof value === 'string' &&
    STATUSES.includes(value as (typeof STATUSES)[number])
  );
}
