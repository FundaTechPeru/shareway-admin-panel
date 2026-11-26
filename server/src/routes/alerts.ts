import express, {type Router} from 'express';
import type {AlertQuery, AlertStatus} from '../adapters/alerts.js';
import type {PanelDependencies} from '../dependencies.js';
import {sendError} from '../http-errors.js';
import {admin} from '../middleware/auth.js';

const MAX_SIZE = 100;
const DEFAULT_SIZE = 20;

/**
 * Emergency alerts (US-Alertas). The list comes from Trip Execution's admin endpoint through the
 * gateway; attending one is a write, so it goes straight to the real service and the panel records
 * who attended which alert in the audit trail first — the action was taken even if the gateway then
 * fails. Both routes sit behind requireAdmin and carry the admin's own token.
 */
export function alertsRouter(deps: PanelDependencies): Router {
  const router = express.Router();

  router.get('/alerts', async (req, res) => {
    const status = req.query['status'];
    if (status !== undefined && status !== '' && !isStatus(status)) {
      sendError(req, res, 400, 'Filtra por OPEN o ATTENDED');
      return;
    }
    const query: AlertQuery = {
      status: isStatus(status) ? status : undefined,
      page: toPage(req.query['page']),
      size: toSize(req.query['size']),
    };
    const page = await deps.alerts.list(query, admin(res).token);
    res.json(page);
  });

  router.patch('/alerts/:id/attend', async (req, res) => {
    const id = req.params.id;
    const user = admin(res);
    deps.auditLog.record({
      adminId: user.id,
      adminEmail: user.email ?? null,
      searchType: 'ALERT_ATTEND',
      criteria: id,
      reference: 'Atención de alerta de emergencia',
    });
    const status = await deps.alerts.attend(id, user.token);
    if (status === 204 || status === 200) {
      res.status(204).end();
      return;
    }
    if (status === 404) {
      sendError(req, res, 404, 'La alerta ya no existe');
      return;
    }
    if (status === 400 || status === 409) {
      sendError(req, res, status, 'La alerta ya fue atendida');
      return;
    }
    sendError(req, res, 502, 'Trip Execution no pudo atender la alerta');
  });

  return router;
}

function isStatus(value: unknown): value is AlertStatus {
  return value === 'OPEN' || value === 'ATTENDED';
}

function toPage(value: unknown): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function toSize(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_SIZE;
  }
  return Math.min(parsed, MAX_SIZE);
}
