import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {SettlementsPage} from './settlements-page';

const settlement = {
  id: 'a71c3d90-4b2e-4a67-8f31-0c5d6e7f8a01',
  driverId: '9b2d7c41-3e5a-4f80-9c12-6d7e8f901b02',
  driverName: 'Luis Alberto Quispe Mamani',
  status: 'PENDING',
  amount: 412.5,
  currency: 'PEN',
  periodStart: '2026-02-16',
  periodEnd: '2026-02-28',
  trips: 11,
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'content-type': 'application/json'},
  });
}

interface Page {
  ask(settlement: unknown): void;
  markPaid(): Promise<void>;
  show(tab: string): Promise<void>;
  settlements: () => unknown[];
  error: () => string | null;
  notice: () => string | null;
}

async function mount(fetchStub: unknown) {
  vi.stubGlobal('fetch', fetchStub);
  await TestBed.configureTestingModule({
    imports: [SettlementsPage],
    providers: [provideRouter([])],
  }).compileComponents();
  const fixture = TestBed.createComponent(SettlementsPage);
  for (let round = 0; round < 5; round += 1) {
    await new Promise(resolve => setTimeout(resolve, 0));
    fixture.detectChanges();
  }
  return fixture;
}

describe('SettlementsPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens on the pending settlements and reads a page or a plain list', async () => {
    const urls: string[] = [];
    const fixture = await mount(
      vi.fn(async (url: string) => {
        urls.push(url);
        return json(200, {content: [settlement]});
      }),
    );
    const page = fixture.componentInstance as unknown as Page;

    expect(urls[0]).toBe('/panel-api/settlements?status=PENDING');
    expect(page.settlements()).toHaveLength(1);

    await page.show('ALL');

    expect(urls[1]).toBe('/panel-api/settlements');
  });

  it('tells the admin when the settlement was already paid', async () => {
    const fixture = await mount(
      vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === 'PATCH'
          ? json(409, {message: 'Settlement already paid'})
          : json(200, [settlement]),
      ),
    );
    const page = fixture.componentInstance as unknown as Page;

    page.ask(settlement);
    await page.markPaid();

    expect(page.error()).toContain('ya estaba pagada');
    expect(page.notice()).toBeNull();
  });
});
