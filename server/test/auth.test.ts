import request from 'supertest';
import {describe, expect, it} from 'vitest';
import {ADMIN_EMAIL, ADMIN_ID, bearer, testPanel, token} from './helpers.js';

describe('sign in', () => {
  it('asks the gateway and answers the token of the admin', async () => {
    const issued = token();
    const {app, calls} = testPanel({
      gateway: () => ({status: 200, body: {token: issued}}),
    });

    const response = await request(app)
      .post('/panel-api/login')
      .send({email: ADMIN_EMAIL, password: 'Admin12345'});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      token: issued,
      admin: {id: ADMIN_ID, email: ADMIN_EMAIL, role: 'ADMIN'},
    });
    expect(calls).toEqual([
      {
        method: 'POST',
        path: '/api/v1/auth/login',
        token: undefined,
        body: {email: ADMIN_EMAIL, password: 'Admin12345'},
      },
    ]);
  });

  it('reads the token of the older builds of Driver Management', async () => {
    const issued = token();
    const {app} = testPanel({
      gateway: () => ({status: 200, body: {accessToken: issued}}),
    });

    const response = await request(app)
      .post('/panel-api/login')
      .send({email: ADMIN_EMAIL, password: 'Admin12345'});

    expect(response.body.token).toBe(issued);
  });

  it('closes the panel to someone who is not staff', async () => {
    const {app} = testPanel({
      gateway: () => ({
        status: 200,
        body: {token: token({role: 'PASSENGER'})},
      }),
    });

    const response = await request(app)
      .post('/panel-api/login')
      .send({email: 'ana@upc.edu.pe', password: 'Pasajera123'});

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/staff/);
  });

  it('passes the answer of the gateway through when the credentials are wrong', async () => {
    const {app} = testPanel({
      gateway: () => ({status: 401, body: {message: 'Invalid credentials'}}),
    });

    const response = await request(app)
      .post('/panel-api/login')
      .send({email: ADMIN_EMAIL, password: 'wrong'});

    expect(response.status).toBe(401);
    expect(response.body).toEqual({message: 'Invalid credentials'});
  });

  it('does not call the gateway without both credentials', async () => {
    const {app, calls} = testPanel();

    const response = await request(app)
      .post('/panel-api/login')
      .send({email: ADMIN_EMAIL});

    expect(response.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it('answers 502 when the gateway does not answer', async () => {
    const {app} = testPanel({
      gateway: () => new Error('connect ECONNREFUSED'),
    });

    const response = await request(app)
      .post('/panel-api/login')
      .send({email: ADMIN_EMAIL, password: 'Admin12345'});

    expect(response.status).toBe(502);
    expect(response.body.message).toMatch(/gateway/);
  });
});

describe('panel API guard', () => {
  it('needs a token', async () => {
    const {app} = testPanel();

    const response = await request(app).get('/panel-api/settlements');

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/Authentication is required/);
  });

  it('refuses a token that is not readable', async () => {
    const {app} = testPanel();

    const response = await request(app)
      .get('/panel-api/settlements')
      .set('authorization', 'Bearer not-a-token');

    expect(response.status).toBe(401);
  });

  it('refuses the token of a driver', async () => {
    const {app} = testPanel();

    const response = await request(app)
      .get('/panel-api/settlements')
      .set('authorization', bearer(token({role: 'DRIVER'})));

    expect(response.status).toBe(403);
  });

  it('lets a staff token reach the panel API', async () => {
    const {app} = testPanel();

    const response = await request(app)
      .get('/panel-api/settlements')
      .set('authorization', bearer());

    expect(response.status).toBe(404);
  });
});
