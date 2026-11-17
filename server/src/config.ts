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
  };
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
