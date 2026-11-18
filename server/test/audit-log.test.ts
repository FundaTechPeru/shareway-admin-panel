import request from 'supertest';
import {describe, expect, it} from 'vitest';
import {
  ADMIN_EMAIL,
  ADMIN_ID,
  bearer,
  testPanel,
  type TestPanel,
} from './helpers.js';

function withLookups(): TestPanel {
  const panel = testPanel();
  panel.auditLog.record({
    adminId: ADMIN_ID,
    adminEmail: ADMIN_EMAIL,
    searchType: 'TRIP',
    criteria: 'd41f9a70-18c6-4a2b-9f31-5c7e8a9b0c01',
    reference: 'TICKET-1042',
  });
  panel.auditLog.record({
    adminId: ADMIN_ID,
    adminEmail: ADMIN_EMAIL,
    searchType: 'PASSENGER',
    criteria: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c01',
    reference: 'RECLAMO 7, "urgente"',
  });
  return panel;
}

describe('audit trail', () => {
  it('lists the lookups, the newest first', async () => {
    const {app} = withLookups();

    const response = await request(app)
      .get('/panel-api/audit-log')
      .set('authorization', bearer());

    expect(response.status).toBe(200);
    expect(response.body.lines).toHaveLength(2);
    expect(response.body.lines[0]).toMatchObject({
      searchType: 'PASSENGER',
      reference: 'RECLAMO 7, "urgente"',
      adminEmail: ADMIN_EMAIL,
    });
  });

  it('keeps only the lines of the period', async () => {
    const {app} = withLookups();

    const response = await request(app)
      .get('/panel-api/audit-log')
      .query({from: '2020-01-01', to: '2020-01-02'})
      .set('authorization', bearer());

    expect(response.body.lines).toEqual([]);
  });

  it('exports a CSV with its header and the quotes escaped', async () => {
    const {app} = withLookups();

    const response = await request(app)
      .get('/panel-api/audit-log.csv')
      .set('authorization', bearer());

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/csv/);
    expect(response.headers['content-disposition']).toMatch(/bitacora-/);
    const rows = response.text
      .replace(String.fromCharCode(0xfeff), '')
      .trim()
      .split('\r\n');
    expect(rows[0]).toBe(
      'fecha,administrador,correo,busqueda,criterio,referencia',
    );
    expect(rows).toHaveLength(3);
    expect(rows[1]).toContain('"RECLAMO 7, ""urgente"""');
  });

  it('has no way to erase a line', async () => {
    const {app} = withLookups();

    const response = await request(app)
      .delete('/panel-api/audit-log')
      .set('authorization', bearer());

    expect(response.status).toBe(404);
  });
});
