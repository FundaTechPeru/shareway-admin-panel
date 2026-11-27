import request from 'supertest';
import {describe, expect, it} from 'vitest';
import {
  ADMIN_EMAIL,
  ADMIN_ID,
  bearer,
  testPanel,
  token,
  type GatewayHandler,
} from './helpers.js';

const alertId = 'c0ffee00-1111-2222-3333-444455556666';
const tripId = 'd41f9a70-18c6-4a2b-9f31-5c7e8a9b0c01';
const driverId = 'b7c1d2e3-4f50-4a61-8b72-9c0d1e2f3a41';

function alertRow(overrides: Record<string, unknown> = {}) {
  return {
    id: alertId,
    viajeId: tripId,
    reportanteId: driverId,
    rolReportante: 'DRIVER',
    tipo: 'ACCIDENTE',
    descripcion: 'Choque en Panamericana Sur',
    estado: 'Abierta',
    creadaEn: '2026-11-25T12:00:00.000Z',
    atendidaEn: null,
    atendidaPor: null,
    ...overrides,
  };
}

/** A gateway that lists one open alert and resolves the driver's public profile. */
const listOneOpen: GatewayHandler = call => {
  if (call.path.startsWith('/api/v1/trips/alertas')) {
    return {
      status: 200,
      body: {
        items: [alertRow()],
        pagina: 0,
        tamano: 20,
        total: 1,
        totalPaginas: 1,
      },
    };
  }
  if (call.path.includes('/public-profile')) {
    return {status: 200, body: {fullName: 'Rosa Maria Chavez Flores'}};
  }
  return {status: 404, body: {message: 'not stubbed'}};
};

describe('alerts listing', () => {
  it('lists the open alerts and fills the driver reporter name', async () => {
    const {app, calls} = testPanel({gateway: listOneOpen});

    const response = await request(app)
      .get('/panel-api/alerts')
      .query({status: 'OPEN'})
      .set('authorization', bearer());

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.items[0]).toMatchObject({
      id: alertId,
      tripId,
      reporterRole: 'DRIVER',
      reporterName: 'Rosa Maria Chavez Flores',
      type: 'ACCIDENTE',
      status: 'OPEN',
    });
    // OPEN was translated to the Spanish enum the service understands.
    const listCall = calls.find(c =>
      c.path.startsWith('/api/v1/trips/alertas'),
    );
    expect(listCall?.path).toContain('estado=Abierta');
  });

  it('forwards the status filter and the paging', async () => {
    const {app, calls} = testPanel({gateway: listOneOpen});

    await request(app)
      .get('/panel-api/alerts')
      .query({status: 'ATTENDED', page: '2', size: '5'})
      .set('authorization', bearer());

    const listCall = calls.find(c =>
      c.path.startsWith('/api/v1/trips/alertas'),
    );
    expect(listCall?.path).toContain('estado=Atendida');
    expect(listCall?.path).toContain('pagina=2');
    expect(listCall?.path).toContain('tamano=5');
  });

  it('rejects an unknown status with a 400 before calling the gateway', async () => {
    const {app, calls} = testPanel({gateway: listOneOpen});

    const response = await request(app)
      .get('/panel-api/alerts')
      .query({status: 'Abierta'})
      .set('authorization', bearer());

    expect(response.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('leaves the reporter name unset when the profile lookup fails', async () => {
    const {app} = testPanel({
      gateway: call =>
        call.path.startsWith('/api/v1/trips/alertas')
          ? {status: 200, body: {items: [alertRow()], total: 1}}
          : {status: 503, body: {message: 'down'}},
    });

    const response = await request(app)
      .get('/panel-api/alerts')
      .set('authorization', bearer());

    expect(response.status).toBe(200);
    expect(response.body.items[0].reporterName).toBeUndefined();
  });

  it('answers an empty page when the service sends no items', async () => {
    const {app} = testPanel({
      gateway: () => ({status: 200, body: {}}),
    });

    const response = await request(app)
      .get('/panel-api/alerts')
      .set('authorization', bearer());

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
  });

  it('answers 502 when the gateway does not respond', async () => {
    const {app} = testPanel({
      gateway: () => new Error('ECONNREFUSED'),
    });

    const response = await request(app)
      .get('/panel-api/alerts')
      .set('authorization', bearer());

    expect(response.status).toBe(502);
  });

  it('needs a token', async () => {
    const {app} = testPanel({gateway: listOneOpen});

    const response = await request(app).get('/panel-api/alerts');

    expect(response.status).toBe(401);
  });

  it('refuses a non-admin token', async () => {
    const {app} = testPanel({gateway: listOneOpen});

    const response = await request(app)
      .get('/panel-api/alerts')
      .set('authorization', bearer(token({role: 'DRIVER'})));

    expect(response.status).toBe(403);
  });
});

describe('attending an alert', () => {
  it('attends it, answers 204 and records who did it', async () => {
    const {app, auditLog, calls} = testPanel({
      gateway: call =>
        call.method === 'PATCH' ? {status: 204} : {status: 404},
    });

    const response = await request(app)
      .patch(`/panel-api/alerts/${alertId}/attend`)
      .set('authorization', bearer());

    expect(response.status).toBe(204);
    expect(calls.at(-1)).toMatchObject({
      method: 'PATCH',
      path: `/api/v1/trips/alertas/${alertId}/atender`,
    });
    expect(auditLog.list()).toMatchObject([
      {
        adminId: ADMIN_ID,
        adminEmail: ADMIN_EMAIL,
        searchType: 'ALERT_ATTEND',
        criteria: alertId,
      },
    ]);
  });

  it('maps a 404 from the service and still has recorded the attempt', async () => {
    const {app, auditLog} = testPanel({
      gateway: () => ({status: 404, body: {message: 'gone'}}),
    });

    const response = await request(app)
      .patch(`/panel-api/alerts/${alertId}/attend`)
      .set('authorization', bearer());

    expect(response.status).toBe(404);
    expect(auditLog.list()).toHaveLength(1);
  });

  it('maps a 409 when the alert was already attended', async () => {
    const {app} = testPanel({
      gateway: () => ({status: 409, body: {message: 'already attended'}}),
    });

    const response = await request(app)
      .patch(`/panel-api/alerts/${alertId}/attend`)
      .set('authorization', bearer());

    expect(response.status).toBe(409);
  });

  it('refuses a non-admin token', async () => {
    const {app, calls} = testPanel({gateway: () => ({status: 204})});

    const response = await request(app)
      .patch(`/panel-api/alerts/${alertId}/attend`)
      .set('authorization', bearer(token({role: 'PASSENGER'})));

    expect(response.status).toBe(403);
    expect(calls).toHaveLength(0);
  });
});
