import {computed, Injectable, signal} from '@angular/core';
import type {AdminIdentity, SignInAnswer} from './models';
import {PanelError} from './panel-error';

const TOKEN_KEY = 'shareway.panel.token';
const ADMIN_KEY = 'shareway.panel.admin';

/**
 * Session of the panel. The token comes from the BFF, lives in memory and is mirrored in
 * sessionStorage so a reload does not sign the admin out; closing the tab does. The role is read
 * from the answer of the BFF, which already refused anyone who is not staff.
 */
@Injectable({providedIn: 'root'})
export class AuthService {
  private readonly tokenValue = signal<string | null>(read(TOKEN_KEY));
  private readonly adminValue = signal<AdminIdentity | null>(
    readAdmin(),
  );

  readonly token = this.tokenValue.asReadonly();
  readonly admin = this.adminValue.asReadonly();
  readonly isSignedIn = computed(() => this.tokenValue() !== null);

  async signIn(email: string, password: string): Promise<void> {
    let response: Response;
    try {
      response = await fetch('/panel-api/login', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({email, password}),
      });
    } catch {
      throw new PanelError(0, 'The panel is not reachable');
    }
    if (!response.ok) {
      throw new PanelError(response.status, await readMessage(response));
    }
    const answer = (await response.json()) as SignInAnswer;
    this.tokenValue.set(answer.token);
    this.adminValue.set(answer.admin);
    write(TOKEN_KEY, answer.token);
    write(ADMIN_KEY, JSON.stringify(answer.admin));
  }

  signOut(): void {
    this.tokenValue.set(null);
    this.adminValue.set(null);
    write(TOKEN_KEY, null);
    write(ADMIN_KEY, null);
  }
}

async function readMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {message?: unknown};
    return typeof body.message === 'string' ? body.message : response.statusText;
  } catch {
    return response.statusText;
  }
}

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function readAdmin(): AdminIdentity | null {
  const stored = read(ADMIN_KEY);
  if (!stored) {
    return null;
  }
  try {
    return JSON.parse(stored) as AdminIdentity;
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) {
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
    }
  } catch {
    // A browser with storage blocked keeps the session in memory only.
  }
}
