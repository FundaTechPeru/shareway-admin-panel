import request from 'supertest';
import {describe, expect, it} from 'vitest';
import {bearer, testPanel} from './helpers.js';

const documentId = '3f9a1c52-5b47-4d8e-9a10-6c2d4e8f1a01';

describe('pending documents', () => {
  it('serves the seed while the real listing does not exist', async () => {
    const {app, calls} = testPanel();

    const response = await request(app)
      .get('/panel-api/pending-documents')
      .set('authorization', bearer());

    expect(response.status).toBe(200);
    expect(response.body.source).toBe('mock');
    expect(response.body.documents).toHaveLength(4);
    expect(response.body.documents[0]).toMatchObject({
      id: documentId,
      type: 'DRIVERS_LICENSE',
      driver: {name: 'Luis Alberto Quispe Mamani'},
    });
    expect(calls).toEqual([]);
  });

  it('reads the real listing once its flag is on', async () => {
    const {app, calls} = testPanel({
      env: {FEATURE_REAL_PENDING_DOCS: 'true'},
      gateway: () => ({
        status: 200,
        body: {
          content: [
            {
              id: 'aa11',
              documentType: 'NATIONAL_ID',
              originalFileName: 'dni.pdf',
              uploadedAt: '2026-11-16T12:00:00.000Z',
              driver: {
                id: 'bb22',
                fullName: 'Ana Torres',
                email: 'ana.torres@upc.edu.pe',
              },
            },
          ],
        },
      }),
    });

    const response = await request(app)
      .get('/panel-api/pending-documents')
      .set('authorization', bearer());

    expect(response.body).toEqual({
      source: 'gateway',
      documents: [
        {
          id: 'aa11',
          type: 'NATIONAL_ID',
          fileName: 'dni.pdf',
          submittedAt: '2026-11-16T12:00:00.000Z',
          driver: {
            id: 'bb22',
            name: 'Ana Torres',
            email: 'ana.torres@upc.edu.pe',
          },
        },
      ],
    });
    expect(calls[0]).toMatchObject({
      method: 'GET',
      path: '/api/v1/driver-documents?status=PENDING',
    });
  });

  it('parses the real Driver Management response, including the nested driver', async () => {
    // The exact shape GET /api/v1/driver-documents?status=PENDING now returns: a plain array with
    // the primary field names (type, fileName, submittedAt) and the driver's phone and license.
    const {app} = testPanel({
      env: {FEATURE_REAL_PENDING_DOCS: 'true'},
      gateway: () => ({
        status: 200,
        body: [
          {
            id: '3f9a1c52-5b47-4d8e-9a10-6c2d4e8f1a01',
            type: 'DRIVERS_LICENSE',
            status: 'PENDING',
            fileName: 'licencia-q1247853.pdf',
            submittedAt: '2026-11-14T13:42:00.000Z',
            reviewedAt: null,
            driver: {
              id: 'b7c1d2e3-4f50-4a61-8b72-9c0d1e2f3a40',
              fullName: 'Luis Alberto Quispe Mamani',
              email: 'luis.quispe@upc.edu.pe',
              phone: '+51987654321',
              licenseNumber: 'Q1247853',
            },
          },
        ],
      }),
    });

    const response = await request(app)
      .get('/panel-api/pending-documents')
      .set('authorization', bearer());

    expect(response.body).toEqual({
      source: 'gateway',
      documents: [
        {
          id: '3f9a1c52-5b47-4d8e-9a10-6c2d4e8f1a01',
          type: 'DRIVERS_LICENSE',
          fileName: 'licencia-q1247853.pdf',
          submittedAt: '2026-11-14T13:42:00.000Z',
          driver: {
            id: 'b7c1d2e3-4f50-4a61-8b72-9c0d1e2f3a40',
            name: 'Luis Alberto Quispe Mamani',
            email: 'luis.quispe@upc.edu.pe',
            phone: '+51987654321',
            licenseNumber: 'Q1247853',
          },
        },
      ],
    });
  });
});

describe('document review', () => {
  it('approves through the real endpoint with the token of the admin', async () => {
    const {app, calls} = testPanel({
      gateway: () => ({
        status: 200,
        body: {id: documentId, status: 'APPROVED'},
      }),
    });

    const response = await request(app)
      .patch(`/panel-api/driver-documents/${documentId}/review`)
      .set('authorization', bearer())
      .send({decision: 'APPROVED'});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({id: documentId, status: 'APPROVED'});
    expect(calls).toEqual([
      {
        method: 'PATCH',
        path: `/api/v1/driver-documents/${documentId}/review`,
        token: expect.stringContaining('.'),
        body: {decision: 'APPROVED'},
      },
    ]);
  });

  it('sends the reason of a rejection', async () => {
    const {app, calls} = testPanel({
      gateway: () => ({status: 200, body: {status: 'REJECTED'}}),
    });

    await request(app)
      .patch(`/panel-api/driver-documents/${documentId}/review`)
      .set('authorization', bearer())
      .send({
        decision: 'REJECTED',
        reason: 'La foto del documento esta borrosa',
      });

    expect(calls[0]?.body).toEqual({
      decision: 'REJECTED',
      reason: 'La foto del documento esta borrosa',
    });
  });

  it('does not reject without a reason', async () => {
    const {app, calls} = testPanel();

    const response = await request(app)
      .patch(`/panel-api/driver-documents/${documentId}/review`)
      .set('authorization', bearer())
      .send({decision: 'REJECTED'});

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/reason/);
    expect(calls).toEqual([]);
  });

  it('refuses a decision it does not know', async () => {
    const {app, calls} = testPanel();

    const response = await request(app)
      .patch(`/panel-api/driver-documents/${documentId}/review`)
      .set('authorization', bearer())
      .send({decision: 'MAYBE'});

    expect(response.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it('passes a document that was already reviewed through as 409', async () => {
    const {app} = testPanel({
      gateway: () => ({
        status: 409,
        body: {status: 409, message: 'The document was already reviewed'},
      }),
    });

    const response = await request(app)
      .patch(`/panel-api/driver-documents/${documentId}/review`)
      .set('authorization', bearer())
      .send({decision: 'APPROVED'});

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/already reviewed/);
  });
});
