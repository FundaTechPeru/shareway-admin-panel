import request from 'supertest';
import {describe, expect, it} from 'vitest';
import {bearer, testPanel} from './helpers.js';

const settlementId = '9b2e7c10-4d3f-4a5b-8c6d-7e8f9a0b1c02';

describe('settlements', () => {
  it('asks Payments & Settlement for the pending ones', async () => {
    const {app, calls} = testPanel({
      gateway: () => ({
        status: 200,
        body: [{id: settlementId, status: 'PENDING', amount: 48.5}],
      }),
    });

    const response = await request(app)
      .get('/panel-api/settlements')
      .query({status: 'PENDING'})
      .set('authorization', bearer());

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {id: settlementId, status: 'PENDING', amount: 48.5},
    ]);
    expect(calls[0]).toMatchObject({
      method: 'GET',
      path: '/api/v1/admin/settlements?status=PENDING',
      token: expect.stringContaining('.'),
    });
  });

  it('asks for every settlement when no tab is chosen', async () => {
    const {app, calls} = testPanel({gateway: () => ({status: 200, body: []})});

    await request(app)
      .get('/panel-api/settlements')
      .set('authorization', bearer());

    expect(calls[0]?.path).toBe('/api/v1/admin/settlements');
  });

  it('refuses a status it does not know', async () => {
    const {app, calls} = testPanel();

    const response = await request(app)
      .get('/panel-api/settlements')
      .query({status: 'CANCELLED'})
      .set('authorization', bearer());

    expect(response.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it('marks a settlement as paid', async () => {
    const {app, calls} = testPanel({
      gateway: () => ({
        status: 200,
        body: {
          id: settlementId,
          status: 'PAID',
          paidAt: '2026-11-17T01:05:00.000Z',
        },
      }),
    });

    const response = await request(app)
      .patch(`/panel-api/settlements/${settlementId}/mark-paid`)
      .set('authorization', bearer());

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('PAID');
    expect(calls[0]).toMatchObject({
      method: 'PATCH',
      path: `/api/v1/admin/settlements/${settlementId}/mark-paid`,
    });
  });

  it('passes a settlement that was already paid through as 409', async () => {
    const {app} = testPanel({
      gateway: () => ({
        status: 409,
        body: {status: 409, message: 'The settlement was already paid'},
      }),
    });

    const response = await request(app)
      .patch(`/panel-api/settlements/${settlementId}/mark-paid`)
      .set('authorization', bearer());

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/already paid/);
  });

  it('answers 502 when the gateway does not answer', async () => {
    const {app} = testPanel({gateway: () => new Error('socket hang up')});

    const response = await request(app)
      .get('/panel-api/settlements')
      .set('authorization', bearer());

    expect(response.status).toBe(502);
  });
});
