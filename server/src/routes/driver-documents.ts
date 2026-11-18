import express, {type Router} from 'express';
import type {PanelDependencies} from '../dependencies.js';
import {sendError} from '../http-errors.js';
import {admin} from '../middleware/auth.js';
import {answerFromGateway} from './gateway-answer.js';

interface ReviewBody {
  decision?: unknown;
  reason?: unknown;
}

const MINIMUM_REASON_LENGTH = 5;

/**
 * Driver verification (US-35). The queue comes from the pending documents adapter, which is a
 * seed until Driver Management lists them, while the decision always goes to the real endpoint:
 * the panel never writes a verification of its own.
 */
export function driverDocumentsRouter(deps: PanelDependencies): Router {
  const router = express.Router();

  router.get('/pending-documents', async (_req, res) => {
    res.json(await deps.pendingDocuments.list(admin(res).token));
  });

  router.patch('/driver-documents/:id/review', async (req, res) => {
    const {decision, reason} = (req.body ?? {}) as ReviewBody;
    if (decision !== 'APPROVED' && decision !== 'REJECTED') {
      sendError(
        req,
        res,
        400,
        'Review the document as APPROVED or as REJECTED',
      );
      return;
    }
    const trimmed = typeof reason === 'string' ? reason.trim() : '';
    if (decision === 'REJECTED' && trimmed.length < MINIMUM_REASON_LENGTH) {
      sendError(req, res, 400, 'A rejected document needs a reason');
      return;
    }
    const answer = await deps.gateway.call({
      method: 'PATCH',
      path: `/api/v1/driver-documents/${encodeURIComponent(req.params.id)}/review`,
      token: admin(res).token,
      body: trimmed.length > 0 ? {decision, reason: trimmed} : {decision},
    });
    answerFromGateway(res, answer);
  });

  return router;
}
