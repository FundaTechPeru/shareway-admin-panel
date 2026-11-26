/** Settings of the panel BFF, read from environment variables. */
export interface PanelConfig {
  port: number;
  /** Base URL of the ShareWay API gateway: every call to a service goes through it. */
  gatewayUrl: string;
  /** Time without an answer from the gateway before the panel gives up. */
  gatewayTimeoutMs: number;
  /** Shorter budget for the status screen, so one slow service never blocks it. */
  healthTimeoutMs: number;
  /** SQLite file with the audit trail; the tests use ':memory:'. */
  dbFile: string;
  features: PanelFeatures;
  /** Folder with the built SPA, served by this process in production. */
  webRoot: string;
  /** Pino level: fatal, error, warn, info, debug, trace or silent. */
  logLevel: string;
  /** Base URLs of the Render services the keep-warm job pings; any left unset is skipped. */
  healthPing: HealthPingConfig;
}

/**
 * Base URL of each service on Render for the keep-warm job. They are optional: the panel runs on
 * a VPS that is always on, so it pings the free-tier services every 13 minutes to stop them from
 * sleeping. A service with no URL is simply not pinged.
 */
export interface HealthPingConfig {
  driverManagement?: string;
  tripPlanningMatching?: string;
  bookingPricing?: string;
  paymentsSettlement?: string;
  tripExecution?: string;
}

/**
 * Endpoints that the services do not expose yet are answered from a mock while its flag is off,
 * and from the gateway once the service ships them.
 */
export interface PanelFeatures {
  realPendingDocuments: boolean;
  realTripRecords: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): PanelConfig {
  return {
    port: Number(env.PORT ?? 8090),
    gatewayUrl: withoutTrailingSlash(required(env, 'GATEWAY_URL')),
    gatewayTimeoutMs: Number(env.GATEWAY_TIMEOUT_MS ?? 10_000),
    healthTimeoutMs: Number(env.HEALTH_TIMEOUT_MS ?? 3_000),
    dbFile: env.DB_FILE ?? './data/panel.db',
    features: {
      realPendingDocuments: isEnabled(env.FEATURE_REAL_PENDING_DOCS),
      realTripRecords: isEnabled(env.FEATURE_REAL_TRIP_RECORDS),
    },
    webRoot: env.WEB_ROOT ?? './public',
    logLevel: env.LOG_LEVEL ?? 'info',
    healthPing: {
      driverManagement: optionalUrl(env.HEALTH_PING_DRIVER_MANAGEMENT_URL),
      tripPlanningMatching: optionalUrl(
        env.HEALTH_PING_TRIP_PLANNING_MATCHING_URL,
      ),
      bookingPricing: optionalUrl(env.HEALTH_PING_BOOKING_PRICING_URL),
      paymentsSettlement: optionalUrl(env.HEALTH_PING_PAYMENTS_SETTLEMENT_URL),
      tripExecution: optionalUrl(env.HEALTH_PING_TRIP_EXECUTION_URL),
    },
  };
}

/** A keep-warm URL is optional; an empty or blank value is treated as unset. */
function optionalUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? withoutTrailingSlash(trimmed) : undefined;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function isEnabled(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

function withoutTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
