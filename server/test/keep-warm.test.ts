import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {loadConfig} from '../src/config.js';
import {createLogger} from '../src/logger.js';
import {
  KEEP_WARM_INTERVAL_MS,
  keepWarmTargets,
  startKeepWarm,
} from '../src/jobs/keep-warm.js';

const logger = createLogger('silent');

function configWith(env: Record<string, string>) {
  return loadConfig({GATEWAY_URL: 'https://gateway.test', ...env});
}

function okFetch() {
  return vi.fn<typeof fetch>(async () => new Response(null, {status: 200}));
}

/** The fetch calls are issued synchronously inside the ping, before the first await. */
function urlsOf(fetchMock: ReturnType<typeof okFetch>): string[] {
  return fetchMock.mock.calls.map(call => String(call[0]));
}

describe('keepWarmTargets', () => {
  it('maps Spring services to /actuator/health and Trip Execution to /health', () => {
    const targets = keepWarmTargets({
      driverManagement: 'https://dm.onrender.com',
      tripExecution: 'https://te.onrender.com',
      apiGateway: 'https://gw.onrender.com',
    });

    expect(targets).toEqual([
      {
        name: 'driver-management',
        url: 'https://dm.onrender.com/actuator/health',
      },
      {name: 'trip-execution', url: 'https://te.onrender.com/health'},
      {name: 'api-gateway', url: 'https://gw.onrender.com/health'},
    ]);
  });

  it('leaves out the services with no URL', () => {
    expect(keepWarmTargets({})).toEqual([]);
  });
});

describe('startKeepWarm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when no service URL is configured', () => {
    const fetchMock = okFetch();
    const job = startKeepWarm(configWith({}), logger, fetchMock);

    expect(fetchMock).not.toHaveBeenCalled();
    job.stop();
  });

  it('pings each configured health endpoint on start and strips a trailing slash', () => {
    const fetchMock = okFetch();
    const job = startKeepWarm(
      configWith({
        HEALTH_PING_DRIVER_MANAGEMENT_URL: 'https://dm.onrender.com',
        HEALTH_PING_TRIP_EXECUTION_URL: 'https://te.onrender.com/',
      }),
      logger,
      fetchMock,
    );

    const urls = urlsOf(fetchMock);
    expect(urls).toContain('https://dm.onrender.com/actuator/health');
    expect(urls).toContain('https://te.onrender.com/health');
    job.stop();
  });

  it('pings again after the interval and stops when told to', () => {
    const fetchMock = okFetch();
    const job = startKeepWarm(
      configWith({HEALTH_PING_TRIP_EXECUTION_URL: 'https://te.onrender.com'}),
      logger,
      fetchMock,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(KEEP_WARM_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    job.stop();
    vi.advanceTimersByTime(KEEP_WARM_INTERVAL_MS * 2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps running when a ping fails', () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      throw new Error('ECONNRESET');
    });
    const job = startKeepWarm(
      configWith({HEALTH_PING_BOOKING_PRICING_URL: 'https://bp.onrender.com'}),
      logger,
      fetchMock,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(() => vi.advanceTimersByTime(KEEP_WARM_INTERVAL_MS)).not.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    job.stop();
  });
});
