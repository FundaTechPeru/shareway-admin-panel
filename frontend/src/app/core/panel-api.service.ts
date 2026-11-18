import {inject, Injectable} from '@angular/core';
import {Router} from '@angular/router';
import {AuthService} from './auth.service';
import {PanelError} from './panel-error';

type Query = Record<string, string | undefined>;

/**
 * The only way the screens reach ShareWay: the BFF, with the token of the session attached. A 401
 * means the token is gone or expired, so the session is closed and the browser goes back to the
 * sign in.
 */
@Injectable({providedIn: 'root'})
export class PanelApiService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  get<T>(path: string, query: Query = {}): Promise<T> {
    return this.request<T>('GET', path, query);
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, {}, body);
  }

  /** Reads a file the panel offers for download, such as the CSV of the audit trail. */
  async blob(path: string, query: Query = {}): Promise<Blob> {
    const response = await this.send('GET', path, query);
    await this.check(response);
    return response.blob();
  }

  private async request<T>(
    method: string,
    path: string,
    query: Query,
    body?: unknown,
  ): Promise<T> {
    const response = await this.send(method, path, query, body);
    await this.check(response);
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  private async send(
    method: string,
    path: string,
    query: Query,
    body?: unknown,
  ): Promise<Response> {
    const search = new URLSearchParams();
    for (const [name, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        search.set(name, value);
      }
    }
    const headers: Record<string, string> = {accept: 'application/json'};
    const token = this.auth.token();
    if (token) {
      headers['authorization'] = `Bearer ${token}`;
    }
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    const url = search.size > 0 ? `${path}?${search.toString()}` : path;
    try {
      return await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new PanelError(0, 'The panel is not reachable');
    }
  }

  private async check(response: Response): Promise<void> {
    if (response.ok) {
      return;
    }
    if (response.status === 401) {
      this.auth.signOut();
      await this.router.navigate(['/login']);
    }
    throw new PanelError(response.status, await readMessage(response));
  }
}

async function readMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {message?: unknown};
    return typeof body.message === 'string'
      ? body.message
      : response.statusText;
  } catch {
    return response.statusText;
  }
}
