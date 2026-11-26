import type {HealthPingConfig, PanelConfig} from '../config.js';
import type {Logger} from '../logger.js';

/** Thirteen minutes: under Render's free-tier sleep window of fifteen. */
export const KEEP_WARM_INTERVAL_MS = 13 * 60 * 1000;

/** A ping must be quick; a sleeping instance answers late or not at all, and that is fine. */
const PING_TIMEOUT_MS = 8_000;

const SPRING_HEALTH = '/actuator/health';
/** Plain /health: Trip Execution (.NET) and the gateway (Express) both answer this path. */
const PLAIN_HEALTH = '/health';

interface PingTarget {
  name: string;
  url: string;
}

export interface KeepWarmJob {
  stop(): void;
}

/**
 * Keeps the free-tier Render services awake. The panel lives on a VPS that is always on, so every
 * thirteen minutes it hits the real health endpoint of each configured service. A ping that fails
 * is logged and ignored: this job must never bring the panel down, and a service that is briefly
 * unreachable is exactly what it is trying to wake up.
 */
export function startKeepWarm(
  config: PanelConfig,
  logger: Logger,
  fetchImpl: typeof fetch = fetch,
): KeepWarmJob {
  const targets = keepWarmTargets(config.healthPing);
  if (targets.length === 0) {
    logger.info('keep-warm disabled: no HEALTH_PING_* URLs configured');
    return {stop() {}};
  }

  logger.info(
    {
      services: targets.map(target => target.name),
      everyMs: KEEP_WARM_INTERVAL_MS,
    },
    'keep-warm started',
  );

  const pingAll = async (): Promise<void> => {
    await Promise.all(targets.map(target => ping(target, logger, fetchImpl)));
  };

  void pingAll();
  const timer = setInterval(() => void pingAll(), KEEP_WARM_INTERVAL_MS);
  // Never let this timer keep the process alive on its own.
  timer.unref?.();

  return {
    stop() {
      clearInterval(timer);
      logger.info('keep-warm stopped');
    },
  };
}

/** The configured services with their real health path; services with no URL are left out. */
export function keepWarmTargets(ping: HealthPingConfig): PingTarget[] {
  const entries: Array<{name: string; base?: string; path: string}> = [
    {
      name: 'driver-management',
      base: ping.driverManagement,
      path: SPRING_HEALTH,
    },
    {
      name: 'trip-planning-matching',
      base: ping.tripPlanningMatching,
      path: SPRING_HEALTH,
    },
    {name: 'booking-pricing', base: ping.bookingPricing, path: SPRING_HEALTH},
    {
      name: 'payments-settlement',
      base: ping.paymentsSettlement,
      path: SPRING_HEALTH,
    },
    // Trip Execution is the .NET service; its liveness lives at /health, not /actuator/health.
    {name: 'trip-execution', base: ping.tripExecution, path: PLAIN_HEALTH},
    // The gateway is Express, same liveness path as this panel's own GET /health.
    {name: 'api-gateway', base: ping.apiGateway, path: PLAIN_HEALTH},
  ];
  return entries
    .filter((entry): entry is {name: string; base: string; path: string} =>
      Boolean(entry.base),
    )
    .map(entry => ({name: entry.name, url: `${entry.base}${entry.path}`}));
}

async function ping(
  target: PingTarget,
  logger: Logger,
  fetchImpl: typeof fetch,
): Promise<void> {
  try {
    const response = await fetchImpl(target.url, {
      method: 'GET',
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
    logger.debug(
      {service: target.name, status: response.status},
      'keep-warm ping',
    );
  } catch (error) {
    logger.warn(
      {service: target.name, err: messageOf(error)},
      'keep-warm ping failed',
    );
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
