import express, {type Router} from 'express';
import type {AuditSearchType} from '../db/audit-log-repository.js';
import type {PanelDependencies} from '../dependencies.js';
import {sendError} from '../http-errors.js';
import {admin} from '../middleware/auth.js';

interface Lookup {
  searchType: AuditSearchType;
  criteria: string;
  query: {tripId?: string; driverId?: string; passengerId?: string};
}

/**
 * Trip record lookups (US-36). Every lookup is personal data of a passenger and a driver, so it
 * needs the reference of the requirement that justifies it, and the line reaches the audit trail
 * before the answer reaches the screen: if the search itself fails, the lookup was still made
 * and stays recorded.
 */
export function tripRecordsRouter(deps: PanelDependencies): Router {
  const router = express.Router();

  router.get('/trip-records', async (req, res) => {
    const reference = text(req.query['reference']);
    if (!reference) {
      sendError(
        req,
        res,
        400,
        'Enter the reference of the requirement before searching',
      );
      return;
    }
    const lookup = readLookup(req.query);
    if (!lookup) {
      sendError(req, res, 400, 'Search by trip, by driver or by passenger');
      return;
    }
    record(deps, res, lookup.searchType, lookup.criteria, reference);
    const page = await deps.tripRecords.search(lookup.query, admin(res).token);
    res.json({...page, reference});
  });

  router.get('/trip-records/:id', async (req, res) => {
    const reference = text(req.query['reference']);
    if (!reference) {
      sendError(
        req,
        res,
        400,
        'Enter the reference of the requirement before searching',
      );
      return;
    }
    const id = req.params.id;
    record(deps, res, 'TRIP_DETAIL', id, reference);
    const {source, record: found} = await deps.tripRecords.byId(
      id,
      admin(res).token,
    );
    if (!found) {
      sendError(req, res, 404, 'There is no trip record with that identifier');
      return;
    }
    res.json({source, record: found, reference});
  });

  return router;
}

function record(
  deps: PanelDependencies,
  res: express.Response,
  searchType: AuditSearchType,
  criteria: string,
  reference: string,
): void {
  const user = admin(res);
  deps.auditLog.record({
    adminId: user.id,
    adminEmail: user.email ?? null,
    searchType,
    criteria,
    reference,
  });
}

function readLookup(query: unknown): Lookup | undefined {
  const values = query as Record<string, unknown>;
  const tripId = text(values['tripId']);
  if (tripId) {
    return {searchType: 'TRIP', criteria: tripId, query: {tripId}};
  }
  const driverId = text(values['driverId']);
  if (driverId) {
    return {searchType: 'DRIVER', criteria: driverId, query: {driverId}};
  }
  const passengerId = text(values['passengerId']);
  if (passengerId) {
    return {
      searchType: 'PASSENGER',
      criteria: passengerId,
      query: {passengerId},
    };
  }
  return undefined;
}

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
