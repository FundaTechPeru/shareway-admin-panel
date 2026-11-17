import request from 'supertest';
import {describe, expect, it} from 'vitest';
import {loadConfig} from '../src/config.js';
import {testPanel} from './helpers.js';

describe('configuration', () => {
  it('reads the defaults of a local run', () => {
    const config = loadConfig({GATEWAY_URL: 'http://localhost:8000/'});

    expect(config).toMatchObject({
      port: 8090,
      gatewayUrl: 'http://localhost:8000',
      gatewayTimeoutMs: 10_000,
      healthTimeoutMs: 3_000,
      dbFile: './data/panel.db',
      features: {realPendingDocuments: false, realTripRecords: false},
    });
  });

  it('refuses to start without the gateway URL', () => {
    expect(() => loadConfig({})).toThrow(/GATEWAY_URL/);
  });

  it('turns a mock adapter into the real one with its flag', () => {
    const config = loadConfig({
      GATEWAY_URL: 'http://localhost:8000',
      FEATURE_REAL_PENDING_DOCS: 'true',
    });

    expect(config.features).toEqual({
      realPendingDocuments: true,
      realTripRecords: false,
    });
  });
});

describe('application', () => {
  it('answers an unknown path with the error body of the platform', async () => {
    const {app} = testPanel();

    const response = await request(app).get('/unknown');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      status: 404,
      error: 'Not Found',
      message: 'Resource not found',
      path: '/unknown',
      fieldErrors: [],
    });
  });
});
