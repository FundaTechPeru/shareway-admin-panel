import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TripsPage} from './trips-page';

const record = {
  id: '5c8d1e2f-7a3b-4c9d-8e10-1f2a3b4c4e01',
  tripId: 'd41f9a70-2c5b-4e18-9a73-5b6c7d8e0c01',
  status: 'CLOSED',
  closedAt: '2026-03-02T13:10:00Z',
  driver: {
    id: '9b2d7c41-3e5a-4f80-9c12-6d7e8f901b02',
    name: 'Luis Alberto Quispe Mamani',
  },
  vehicle: {
    plate: 'ABC-123',
    brand: 'Toyota',
    model: 'Yaris',
    color: 'Plata',
    seats: 4,
  },
  route: {
    origin: 'UPC Monterrico',
    destination: 'San Isidro',
    departedAt: '2026-03-02T12:30:00Z',
    arrivedAt: '2026-03-02T13:05:00Z',
  },
  stops: [],
  passengers: [],
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'content-type': 'application/json'},
  });
}

async function mount(fetchStub: unknown) {
  vi.stubGlobal('fetch', fetchStub);
  await TestBed.configureTestingModule({
    imports: [TripsPage],
    providers: [provideRouter([])],
  }).compileComponents();
  const fixture = TestBed.createComponent(TripsPage);
  fixture.detectChanges();
  return fixture;
}

interface Page {
  form: {reference: string; criterion: string; value: string};
  search(): Promise<void>;
  open(record: unknown): Promise<void>;
  error: () => string | null;
  records: () => unknown[] | null;
}

describe('TripsPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not search without the reference of the requirement', async () => {
    const call = vi.fn(async () => json(200, {source: 'mock', records: []}));
    const fixture = await mount(call);
    const page = fixture.componentInstance as unknown as Page;

    page.form.value = 'd41f9a70-2c5b-4e18-9a73-5b6c7d8e0c01';
    await page.search();

    expect(call).not.toHaveBeenCalled();
    expect(page.error()).toContain('referencia');
  });

  it('carries the reference on the search and on the detail', async () => {
    const urls: string[] = [];
    const fixture = await mount(
      vi.fn(async (url: string) => {
        urls.push(url);
        return url.includes('/trip-records/')
          ? json(200, {source: 'mock', record, reference: 'CASO-7781'})
          : json(200, {
              source: 'mock',
              records: [record],
              reference: 'CASO-7781',
            });
      }),
    );
    const page = fixture.componentInstance as unknown as Page;

    page.form.reference = 'CASO-7781';
    page.form.value = record.tripId;
    await page.search();
    expect(page.records()).toHaveLength(1);

    await page.open(record);

    expect(urls[0]).toContain('reference=CASO-7781');
    expect(urls[0]).toContain(`tripId=${record.tripId}`);
    expect(urls[1]).toBe(
      `/panel-api/trip-records/${record.id}?reference=CASO-7781`,
    );
  });
});
