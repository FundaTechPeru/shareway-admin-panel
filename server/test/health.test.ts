import request from 'supertest';
import {describe, expect, it} from 'vitest';
import {bearer, testPanel} from './helpers.js';

const gatewayHealth = {
  status: 'UP',
  services: {
    'driver-management': 'CLOSED',
    'trip-planning-matching': 'HALF_OPEN',
    'booking-pricing': 'OPEN',
    'payments-settlement': 'NOT_CONFIGURED',
    'trip-execution': 'CLOSED',
  },
};

describe('platform status', () => {
  it('translates the circuit of every service', async () => {
    const {app, calls} = testPanel({
      gateway: () => ({status: 200, body: gatewayHealth}),
    });

    const response = await request(app)
      .get('/panel-api/health')
      .set('authorization', bearer());

    expect(response.status).toBe(200);
    expect(response.body.gateway).toBe('OPERATIONAL');
    expect(response.body.services).toEqual([
      {name: 'driver-management', status: 'OPERATIONAL'},
      {name: 'trip-planning-matching', status: 'RECOVERING'},
      {name: 'booking-pricing', status: 'DOWN'},
      {name: 'payments-settlement', status: 'NOT_CONFIGURED'},
      {name: 'trip-execution', status: 'OPERATIONAL'},
    ]);
    expect(calls[0]).toMatchObject({method: 'GET', path: '/health'});
  });

  it('asks the gateway with the short budget of the screen', async () => {
    const {config} = testPanel();

    expect(config.healthTimeoutMs).toBe(3000);
  });

  it('reports the gateway down and the services unknown when it does not answer', async () => {
    const {app} = testPanel({gateway: () => new Error('connect ECONNREFUSED')});

    const response = await request(app)
      .get('/panel-api/health')
      .set('authorization', bearer());

    expect(response.status).toBe(200);
    expect(response.body.gateway).toBe('DOWN');
    expect(
      response.body.services.map((service: {status: string}) => service.status),
    ).toEqual(['UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN']);
  });

  it('reports the gateway down when it answers an error', async () => {
    const {app} = testPanel({gateway: () => ({status: 503, body: {}})});

    const response = await request(app)
      .get('/panel-api/health')
      .set('authorization', bearer());

    expect(response.body.gateway).toBe('DOWN');
  });

  it('keeps a service the gateway reports but the panel does not know', async () => {
    const {app} = testPanel({
      gateway: () => ({
        status: 200,
        body: {
          status: 'UP',
          services: {...gatewayHealth.services, chat: 'CLOSED'},
        },
      }),
    });

    const response = await request(app)
      .get('/panel-api/health')
      .set('authorization', bearer());

    expect(response.body.services).toHaveLength(6);
    expect(response.body.services[5]).toEqual({
      name: 'chat',
      status: 'OPERATIONAL',
    });
  });

  it('answers its own liveness without a token', async () => {
    const {app} = testPanel();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({status: 'UP'});
  });
});
