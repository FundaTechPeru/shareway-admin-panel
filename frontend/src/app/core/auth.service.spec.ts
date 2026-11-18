import {TestBed} from '@angular/core/testing';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {AuthService} from './auth.service';
import {PanelError} from './panel-error';

const admin = {
  id: '8f14e45f-ea1b-4c3f-9d2a-7b6c5d4e3f20',
  email: 'admin@shareway.pe',
  role: 'ADMIN',
};

function answer(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'content-type': 'application/json'},
  });
}

describe('AuthService', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the session after a successful sign in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => answer(200, {token: 'a.b.c', admin})),
    );
    const auth = TestBed.inject(AuthService);

    await auth.signIn('admin@shareway.pe', 'Admin12345');

    expect(auth.isSignedIn()).toBe(true);
    expect(auth.admin()).toEqual(admin);
    expect(sessionStorage.getItem('shareway.panel.token')).toBe('a.b.c');
  });

  it('does not open the panel for someone who is not staff', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        answer(403, {
          message: 'Only ShareWay staff can use the administration panel',
        }),
      ),
    );
    const auth = TestBed.inject(AuthService);

    await expect(auth.signIn('ana@upc.edu.pe', 'Pasajera123')).rejects.toThrow(
      PanelError,
    );
    expect(auth.isSignedIn()).toBe(false);
  });

  it('forgets the session when the admin signs out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => answer(200, {token: 'a.b.c', admin})),
    );
    const auth = TestBed.inject(AuthService);
    await auth.signIn('admin@shareway.pe', 'Admin12345');

    auth.signOut();

    expect(auth.isSignedIn()).toBe(false);
    expect(sessionStorage.getItem('shareway.panel.token')).toBeNull();
  });
});
