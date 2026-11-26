import request from 'supertest';
import {describe, expect, it} from 'vitest';
import {bearer, testPanel} from './helpers.js';

const user = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c01',
  email: 'ana.torres@upc.edu.pe',
  fullName: 'Ana Lucia Torres Vega',
  phone: '+51987654321',
  role: 'PASSENGER',
  driverStatus: null,
  createdAt: '2026-11-14T12:00:00.000Z',
};

function pageBody(users: unknown[], extra: Record<string, unknown> = {}) {
  return {
    content: users,
    page: 0,
    size: 20,
    totalElements: users.length,
    totalPages: 1,
    ...extra,
  };
}

describe('users', () => {
  it('asks Driver Management for the directory and forwards the filters', async () => {
    const {app, calls} = testPanel({
      gateway: () => ({status: 200, body: pageBody([user])}),
    });

    const response = await request(app)
      .get('/panel-api/users')
      .query({role: 'PASSENGER', fullName: 'ana'})
      .set('authorization', bearer());

    expect(response.status).toBe(200);
    expect(response.body.content).toHaveLength(1);
    expect(response.body.totalElements).toBe(1);
    expect(calls[0]).toMatchObject({
      method: 'GET',
      path: '/api/v1/users?role=PASSENGER&fullName=ana&page=0&size=20',
      token: expect.stringContaining('.'),
    });
  });

  it('refuses a role it does not know without calling the gateway', async () => {
    const {app, calls} = testPanel();

    const response = await request(app)
      .get('/panel-api/users')
      .query({role: 'SUPERADMIN'})
      .set('authorization', bearer());

    expect(response.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it('caps the page size at 100', async () => {
    const {app, calls} = testPanel({
      gateway: () => ({status: 200, body: pageBody([])}),
    });

    await request(app)
      .get('/panel-api/users')
      .query({size: '500'})
      .set('authorization', bearer());

    expect(calls[0]?.path).toBe('/api/v1/users?page=0&size=100');
  });

  it('tolerates a plain array from the service as a single page', async () => {
    const {app} = testPanel({
      gateway: () => ({status: 200, body: [user]}),
    });

    const response = await request(app)
      .get('/panel-api/users')
      .set('authorization', bearer());

    expect(response.status).toBe(200);
    expect(response.body.content).toHaveLength(1);
    expect(response.body.totalPages).toBe(1);
  });

  it('answers 502 when the gateway does not answer', async () => {
    const {app} = testPanel({gateway: () => new Error('socket hang up')});

    const response = await request(app)
      .get('/panel-api/users')
      .set('authorization', bearer());

    expect(response.status).toBe(502);
  });
});
