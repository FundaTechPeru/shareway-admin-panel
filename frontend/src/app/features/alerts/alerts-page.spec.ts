import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {AlertsPage} from './alerts-page';

const openAlert = {
  id: 'c0ffee00-1111-2222-3333-444455556666',
  tripId: 'd41f9a70-18c6-4a2b-9f31-5c7e8a9b0c01',
  reporterId: 'b7c1d2e3-4f50-4a61-8b72-9c0d1e2f3a41',
  reporterRole: 'DRIVER',
  reporterName: 'Rosa Maria Chavez Flores',
  type: 'ACCIDENTE',
  description: 'Choque en Panamericana Sur',
  status: 'OPEN',
  createdAt: '2026-11-25T12:00:00.000Z',
};

function page(items: unknown[]) {
  return {
    items,
    page: 0,
    size: 20,
    total: items.length,
    totalPages: 1,
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'content-type': 'application/json'},
  });
}

function noContent(): Response {
  return new Response(null, {status: 204});
}

async function mount(fetchStub: unknown) {
  vi.stubGlobal('fetch', fetchStub);
  await TestBed.configureTestingModule({
    imports: [AlertsPage],
    providers: [provideRouter([])],
  }).compileComponents();
  const fixture = TestBed.createComponent(AlertsPage);
  await settle(fixture);
  return fixture;
}

async function settle(fixture: {detectChanges(): void}): Promise<void> {
  for (let round = 0; round < 5; round += 1) {
    await new Promise(resolve => setTimeout(resolve, 0));
    fixture.detectChanges();
  }
}

function text(fixture: {nativeElement: HTMLElement}): string {
  return fixture.nativeElement.textContent ?? '';
}

interface PageApi {
  select(alert: unknown): void;
  askConfirm(): void;
  cancelConfirm(): void;
  attend(): Promise<void>;
  changeFilter(filter: string): Promise<void>;
  alerts(): {status: string}[];
  error(): string | null;
  notice(): string | null;
}

describe('AlertsPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists the open alerts newest first', async () => {
    const fixture = await mount(vi.fn(async () => json(200, page([openAlert]))));

    expect(text(fixture)).toContain('ACCIDENTE');
    expect(text(fixture)).toContain('Choque en Panamericana Sur');
    expect(text(fixture)).toContain('Rosa Maria Chavez Flores');
  });

  it('shows the empty message when there are no open alerts', async () => {
    const fixture = await mount(vi.fn(async () => json(200, page([]))));

    expect(text(fixture)).toContain('No hay alertas abiertas');
  });

  it('asks the gateway for the attended alerts when the filter changes', async () => {
    const calls: string[] = [];
    const fixture = await mount(
      vi.fn(async (url: string) => {
        calls.push(url);
        return json(200, page([]));
      }),
    );
    const api = fixture.componentInstance as unknown as PageApi;

    await api.changeFilter('ATTENDED');

    expect(calls.some(url => url.includes('status=ATTENDED'))).toBe(true);
  });

  it('attends an open alert after the in-page confirmation', async () => {
    const calls: string[] = [];
    const fixture = await mount(
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? 'GET'} ${url}`);
        return init?.method === 'PATCH'
          ? noContent()
          : json(200, page([openAlert]));
      }),
    );
    const api = fixture.componentInstance as unknown as PageApi;

    api.select(openAlert);
    api.askConfirm();
    await api.attend();

    expect(calls).toContain(
      `PATCH /panel-api/alerts/${openAlert.id}/attend`,
    );
    expect(api.alerts()[0].status).toBe('ATTENDED');
    expect(api.notice()).toContain('atendida');
  });

  it('explains when the alert was already attended elsewhere', async () => {
    const fixture = await mount(
      vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === 'PATCH'
          ? json(409, {message: 'already attended'})
          : json(200, page([openAlert])),
      ),
    );
    const api = fixture.componentInstance as unknown as PageApi;

    api.select(openAlert);
    api.askConfirm();
    await api.attend();

    expect(api.error()).toContain('ya había sido atendida');
  });

  it('shows an error with a retry when the list cannot be read', async () => {
    const fixture = await mount(vi.fn(async () => json(502, {message: 'down'})));

    expect(text(fixture)).toContain('Reintentar');
  });
});
