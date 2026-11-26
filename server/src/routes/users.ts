import express, {type Router} from 'express';
import type {UserQuery} from '../adapters/users.js';
import type {PanelDependencies} from '../dependencies.js';
import {sendError} from '../http-errors.js';
import {admin} from '../middleware/auth.js';

const ROLES = ['PASSENGER', 'DRIVER', 'ADMIN'] as const;
const MAX_SIZE = 100;
const DEFAULT_SIZE = 20;

/**
 * User directory for the "Usuarios" screen (US admin). Driver Management owns the users and
 * applies its own ADMIN check, so the panel only forwards the filters with the token of the
 * admin and hands the page back. The role filter is validated here so a typo is a clear 400
 * instead of a round trip to the gateway.
 */
export function usersRouter(deps: PanelDependencies): Router {
  const router = express.Router();

  router.get('/users', async (req, res) => {
    const role = req.query['role'];
    if (role !== undefined && role !== '' && !isRole(role)) {
      sendError(req, res, 400, 'Filtra por PASSENGER, DRIVER o ADMIN');
      return;
    }
    const query: UserQuery = {
      role: text(role),
      email: text(req.query['email']),
      fullName: text(req.query['fullName']),
      page: toPage(req.query['page']),
      size: toSize(req.query['size']),
    };
    const page = await deps.users.search(query, admin(res).token);
    res.json(page);
  });

  return router;
}

function isRole(value: unknown): value is (typeof ROLES)[number] {
  return (
    typeof value === 'string' && ROLES.includes(value as (typeof ROLES)[number])
  );
}

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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
