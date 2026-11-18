import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {DriversPage} from './drivers-page';

const pending = {
  source: 'mock',
  documents: [
    {
      id: '3f9a1c52-6b7d-4e8f-9a01-2b3c4d5e1a01',
      type: 'DRIVERS_LICENSE',
      fileName: 'licencia-quispe.pdf',
      submittedAt: '2026-03-02T14:20:00Z',
      driver: {
        id: '9b2d7c41-3e5a-4f80-9c12-6d7e8f901b02',
        name: 'Luis Alberto Quispe Mamani',
        email: 'luis.quispe@upc.edu.pe',
      },
    },
  ],
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
    imports: [DriversPage],
    providers: [provideRouter([])],
  }).compileComponents();
  const fixture = TestBed.createComponent(DriversPage);
  await settle(fixture);
  return fixture;
}

/** Lets the calls to the BFF and the signals that follow them finish. */
async function settle(fixture: {detectChanges(): void}): Promise<void> {
  for (let round = 0; round < 5; round += 1) {
    await new Promise(resolve => setTimeout(resolve, 0));
    fixture.detectChanges();
  }
}

function text(fixture: {nativeElement: HTMLElement}): string {
  return fixture.nativeElement.textContent ?? '';
}

describe('DriversPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists the documents waiting for review', async () => {
    const fixture = await mount(vi.fn(async () => json(200, pending)));

    expect(text(fixture)).toContain('Luis Alberto Quispe Mamani');
    expect(text(fixture)).toContain('Licencia de conducir');
    expect(text(fixture)).toContain('Datos de ejemplo');
  });

  it('asks for a reason before it rejects a document', async () => {
    const calls: string[] = [];
    const fixture = await mount(
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? 'GET'} ${url}`);
        return json(200, pending);
      }),
    );
    const page = fixture.componentInstance as unknown as {
      select(document: unknown): void;
      askReason(): void;
      reject(): Promise<void>;
      reason: string;
      error: () => string | null;
    };

    page.select(pending.documents[0]);
    page.askReason();
    await page.reject();

    expect(page.error()).toContain('motivo del rechazo');
    expect(calls.filter(call => call.startsWith('PATCH'))).toHaveLength(0);

    page.reason = 'La licencia está vencida desde enero';
    await page.reject();

    expect(calls).toContain(
      'PATCH /panel-api/driver-documents/3f9a1c52-6b7d-4e8f-9a01-2b3c4d5e1a01/review',
    );
  });

  it('tells the admin when somebody else already reviewed the document', async () => {
    const fixture = await mount(
      vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === 'PATCH'
          ? json(409, {message: 'Document already reviewed'})
          : json(200, pending),
      ),
    );
    const page = fixture.componentInstance as unknown as {
      select(document: unknown): void;
      approve(): Promise<void>;
      error: () => string | null;
    };

    page.select(pending.documents[0]);
    await page.approve();

    expect(page.error()).toContain('ya revisó este documento');
  });
});
