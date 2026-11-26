import request from 'supertest';
import {describe, expect, it} from 'vitest';
import {ADMIN_EMAIL, ADMIN_ID, bearer, testPanel} from './helpers.js';

const tripId = 'd41f9a70-18c6-4a2b-9f31-5c7e8a9b0c01';
const driverId = 'b7c1d2e3-4f50-4a61-8b72-9c0d1e2f3a41';
const passengerId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c01';
const recordId = '5c8d1e2f-3a4b-4c5d-8e9f-0a1b2c3d4e01';

describe('trip record search', () => {
  it('finds the trip and records who looked it up', async () => {
    const {app, auditLog} = testPanel();

    const response = await request(app)
      .get('/panel-api/trip-records')
      .query({tripId, reference: 'TICKET-1042'})
      .set('authorization', bearer());

    expect(response.status).toBe(200);
    expect(response.body.source).toBe('mock');
    expect(response.body.records).toHaveLength(1);
    expect(response.body.records[0]).toMatchObject({
      tripId,
      vehicle: {plate: 'ABC-123'},
      passengers: [{validation: 'PIN'}, {validation: 'QR'}],
    });
    expect(auditLog.list()).toMatchObject([
      {
        adminId: ADMIN_ID,
        adminEmail: ADMIN_EMAIL,
        searchType: 'TRIP',
        criteria: tripId,
        reference: 'TICKET-1042',
      },
    ]);
  });

  it('searches by driver and by passenger', async () => {
    const {app, auditLog} = testPanel();

    const byDriver = await request(app)
      .get('/panel-api/trip-records')
      .query({driverId, reference: 'TICKET-1043'})
      .set('authorization', bearer());
    const byPassenger = await request(app)
      .get('/panel-api/trip-records')
      .query({passengerId, reference: 'TICKET-1044'})
      .set('authorization', bearer());

    expect(byDriver.body.records).toHaveLength(1);
    expect(byPassenger.body.records).toHaveLength(2);
    expect(auditLog.list().map(line => line.searchType)).toEqual([
      'PASSENGER',
      'DRIVER',
    ]);
  });

  it('answers an empty list when nothing matches, and still records it', async () => {
    const {app, auditLog} = testPanel();

    const response = await request(app)
      .get('/panel-api/trip-records')
      .query({tripId: 'unknown', reference: 'TICKET-1045'})
      .set('authorization', bearer());

    expect(response.status).toBe(200);
    expect(response.body.records).toEqual([]);
    expect(auditLog.list()).toHaveLength(1);
  });

  it('does not search without the reference of the requirement', async () => {
    const {app, auditLog} = testPanel();

    const response = await request(app)
      .get('/panel-api/trip-records')
      .query({tripId})
      .set('authorization', bearer());

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/reference/);
    expect(auditLog.list()).toEqual([]);
  });

  it('does not search without a criterion', async () => {
    const {app, auditLog} = testPanel();

    const response = await request(app)
      .get('/panel-api/trip-records')
      .query({reference: 'TICKET-1046'})
      .set('authorization', bearer());

    expect(response.status).toBe(400);
    expect(auditLog.list()).toEqual([]);
  });

  it('asks Trip Execution once the flag is on', async () => {
    const {app, calls} = testPanel({
      env: {FEATURE_REAL_TRIP_RECORDS: 'true'},
      gateway: () => ({status: 200, body: []}),
    });

    const response = await request(app)
      .get('/panel-api/trip-records')
      .query({tripId, reference: 'TICKET-1047'})
      .set('authorization', bearer());

    expect(response.body.source).toBe('gateway');
    expect(calls[0]).toMatchObject({
      method: 'GET',
      path: `/api/v1/trips/admin?tripId=${tripId}`,
    });
  });

  it('maps the panel filters to the names the admin endpoint expects', async () => {
    const {app, calls} = testPanel({
      env: {FEATURE_REAL_TRIP_RECORDS: 'true'},
      gateway: () => ({status: 200, body: []}),
    });

    await request(app)
      .get('/panel-api/trip-records')
      .query({driverId, reference: 'TICKET-1050'})
      .set('authorization', bearer());

    expect(calls[0]?.path).toBe(`/api/v1/trips/admin?conductorId=${driverId}`);
  });

  it('composes the driver, vehicle, route and passengers from the real endpoints', async () => {
    const {app, calls} = testPanel({
      env: {FEATURE_REAL_TRIP_RECORDS: 'true'},
      gateway: call => {
        if (call.path.startsWith('/api/v1/trips/admin')) {
          return {status: 200, body: [realAdminRow]};
        }
        if (call.path === `/api/v1/drivers/${driverId}/public-profile`) {
          return {
            status: 200,
            body: {
              fullName: 'Rosa Maria Chavez Flores',
              driverStatus: 'VERIFIED',
              licenseNumber: 'C8841207',
            },
          };
        }
        if (call.path === `/api/v1/drivers/${driverId}/vehicle`) {
          return {
            status: 200,
            body: {
              plate: 'XYZ-789',
              brand: 'Kia',
              model: 'Rio',
              color: 'Gris',
              seats: 4,
            },
          };
        }
        return {status: 404, body: {}};
      },
    });

    const response = await request(app)
      .get('/panel-api/trip-records')
      .query({driverId, reference: 'TICKET-1051'})
      .set('authorization', bearer());

    expect(response.status).toBe(200);
    expect(response.body.source).toBe('gateway');
    const [record] = response.body.records;
    expect(record).toMatchObject({
      id: tripId,
      tripId,
      status: 'Finalizado',
      driver: {
        id: driverId,
        name: 'Rosa Maria Chavez Flores',
        licenseNumber: 'C8841207',
      },
      vehicle: {
        plate: 'XYZ-789',
        brand: 'Kia',
        model: 'Rio',
        color: 'Gris',
        seats: 4,
      },
      route: {
        origin: 'UPC San Isidro',
        destination: 'UPC Villa',
        departedAt: '2026-11-15T22:40:00.000Z',
        arrivedAt: '2026-11-15T23:45:00.000Z',
      },
    });
    expect(record.stops).toEqual([
      {name: 'UPC San Isidro', scheduledAt: '', arrivedAt: undefined},
      {name: 'Plaza Lima Sur', scheduledAt: '', arrivedAt: undefined},
      {name: 'UPC Villa', scheduledAt: '', arrivedAt: undefined},
    ]);
    expect(record.passengers).toEqual([
      {
        passengerId,
        name: '',
        stop: '',
        boardedAt: '2026-11-15T22:43:00.000Z',
        validation: 'QR',
      },
    ]);
    // The driver is fetched once (profile + vehicle), not per passenger.
    expect(calls.filter(c => c.path.includes('/public-profile'))).toHaveLength(
      1,
    );
  });

  it('degrades to empty driver and vehicle when Driver Management does not answer them', async () => {
    const {app} = testPanel({
      env: {FEATURE_REAL_TRIP_RECORDS: 'true'},
      gateway: call =>
        call.path.startsWith('/api/v1/trips/admin')
          ? {status: 200, body: [realAdminRow]}
          : {status: 404, body: {}},
    });

    const response = await request(app)
      .get('/panel-api/trip-records')
      .query({driverId, reference: 'TICKET-1052'})
      .set('authorization', bearer());

    expect(response.status).toBe(200);
    const [record] = response.body.records;
    expect(record.driver.name).toBe('');
    expect(record.vehicle).toEqual({
      plate: '',
      brand: '',
      model: '',
      color: '',
      seats: 0,
    });
    // The route still maps, so the record is usable even without Driver Management.
    expect(record.route.origin).toBe('UPC San Isidro');
  });
});

/** A row shaped like GET /api/viajes/admin: ids plus the raw route and boardings, no names. */
const realAdminRow = {
  id: tripId,
  grupoId: 'e3f4a5b6-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
  conductorId: driverId,
  estado: 'Finalizado',
  inicioReal: '2026-11-15T22:40:00.000Z',
  finReal: '2026-11-15T23:45:00.000Z',
  ruta: {
    origen: {
      etiqueta: 'UPC San Isidro',
      latitud: -12.1,
      longitud: -77.0,
      tipo: 'ORIGEN',
    },
    destino: {
      etiqueta: 'UPC Villa',
      latitud: -12.2,
      longitud: -76.9,
      tipo: 'DESTINO',
    },
    puntos: [
      {
        etiqueta: 'UPC San Isidro',
        latitud: -12.1,
        longitud: -77.0,
        tipo: 'ORIGEN',
      },
      {
        etiqueta: 'Plaza Lima Sur',
        latitud: -12.15,
        longitud: -76.95,
        tipo: 'PARADA',
      },
      {etiqueta: 'UPC Villa', latitud: -12.2, longitud: -76.9, tipo: 'DESTINO'},
    ],
  },
  abordajes: [
    {
      reservaId: 'f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c',
      pasajeroId: passengerId,
      abordo: true,
      abordadoEn: '2026-11-15T22:43:00.000Z',
      intentosFallidos: 0,
      bloqueado: false,
      metodo: 'Qr',
    },
  ],
};

describe('trip record detail', () => {
  it('returns the record and records the lookup', async () => {
    const {app, auditLog} = testPanel();

    const response = await request(app)
      .get(`/panel-api/trip-records/${recordId}`)
      .query({reference: 'TICKET-1048'})
      .set('authorization', bearer());

    expect(response.status).toBe(200);
    expect(response.body.record.tripId).toBe(tripId);
    expect(auditLog.list()[0]).toMatchObject({
      searchType: 'TRIP_DETAIL',
      criteria: recordId,
      reference: 'TICKET-1048',
    });
  });

  it('answers 404 for a record that does not exist', async () => {
    const {app} = testPanel();

    const response = await request(app)
      .get('/panel-api/trip-records/does-not-exist')
      .query({reference: 'TICKET-1049'})
      .set('authorization', bearer());

    expect(response.status).toBe(404);
  });
});
