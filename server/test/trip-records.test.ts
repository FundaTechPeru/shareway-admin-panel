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
      path: `/api/v1/admin/trip-records?tripId=${tripId}`,
    });
  });
});

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
