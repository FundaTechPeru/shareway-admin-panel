import express, {type Router} from 'express';
import type {PanelDependencies} from '../dependencies.js';
import {GatewayUnavailableError} from '../gateway.js';
import {admin} from '../middleware/auth.js';

/** Services behind the gateway, in the order the status screen shows them. */
export const PANEL_SERVICES = [
  'driver-management',
  'trip-planning-matching',
  'booking-pricing',
  'payments-settlement',
  'trip-execution',
] as const;

/**
 * What the screen paints for each service. The gateway reports the state of its circuit breaker;
 * UNKNOWN is the panel saying it could not find out, which happens while the gateway is down.
 */
export type ServiceStatus =
  'OPERATIONAL' | 'RECOVERING' | 'DOWN' | 'NOT_CONFIGURED' | 'UNKNOWN';

export interface ServiceReport {
  name: string;
  status: ServiceStatus;
}

export interface PlatformReport {
  checkedAt: string;
  gateway: ServiceStatus;
  services: ServiceReport[];
}

interface GatewayHealth {
  status?: unknown;
  services?: Record<string, unknown>;
}

/** Liveness of the panel itself, for the container probe. It needs no token. */
export function livenessRouter(): Router {
  const router = express.Router();
  router.get('/health', (_req, res) => {
    res.json({status: 'UP'});
  });
  return router;
}

/**
 * Status of the platform for the services screen (US-34). The gateway is asked with a short
 * budget and its answer is translated into the five states the screen knows. A gateway that does
 * not answer is reported as down with every service unknown, so the screen always paints.
 */
export function healthRouter(deps: PanelDependencies): Router {
  const router = express.Router();
  router.get('/health', async (_req, res) => {
    res.json(await readPlatform(deps, admin(res).token));
  });
  return router;
}

async function readPlatform(
  deps: PanelDependencies,
  token: string,
): Promise<PlatformReport> {
  const checkedAt = new Date().toISOString();
  try {
    const answer = await deps.gateway.call<GatewayHealth>({
      path: '/health',
      token,
      timeoutMs: deps.config.healthTimeoutMs,
    });
    if (answer.status !== 200 || typeof answer.body !== 'object') {
      return unreachable(checkedAt);
    }
    const reported = answer.body?.services ?? {};
    const names = [
      ...PANEL_SERVICES,
      ...Object.keys(reported).filter(
        name =>
          !PANEL_SERVICES.includes(name as (typeof PANEL_SERVICES)[number]),
      ),
    ];
    return {
      checkedAt,
      gateway: answer.body?.status === 'UP' ? 'OPERATIONAL' : 'DOWN',
      services: names.map(name => ({
        name,
        status: toServiceStatus(reported[name]),
      })),
    };
  } catch (error) {
    if (error instanceof GatewayUnavailableError) {
      return unreachable(checkedAt);
    }
    throw error;
  }
}

/** The gateway is the only way in: without it the panel knows nothing about the services. */
function unreachable(checkedAt: string): PlatformReport {
  return {
    checkedAt,
    gateway: 'DOWN',
    services: PANEL_SERVICES.map(name => ({name, status: 'UNKNOWN'})),
  };
}

function toServiceStatus(circuit: unknown): ServiceStatus {
  switch (circuit) {
    case 'CLOSED':
      return 'OPERATIONAL';
    case 'HALF_OPEN':
      return 'RECOVERING';
    case 'OPEN':
      return 'DOWN';
    case 'NOT_CONFIGURED':
      return 'NOT_CONFIGURED';
    default:
      return 'UNKNOWN';
  }
}
