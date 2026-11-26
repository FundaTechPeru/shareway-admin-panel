import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {UsersPage} from './users-page';

function page(users: unknown[], extra: Record<string, unknown> = {}): unknown {
  return {
    content: users,
    page: 0,
    size: 20,
    totalElements: users.length,
    totalPages: 1,
    ...extra,
  };
}

const sample = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c01',
  email: 'ana.torres@upc.edu.pe',
  fullName: 'Ana Lucia Torres Vega',
  phone: '+51987654321',
  role: 'PASSENGER',
  driverStatus: null,
  createdAt: '2026-11-14T12:00:00.000Z',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'content-type': 'application/json'},
  });
}

interface Component {
  onRole(value: string): void;
  next(): Promise<void>;
  users: () => unknown[];
  error: () => string | null;
  hasNext: () => boolean;
}

async function mount(fetchStub: unknown) {
  vi.stubGlobal('fetch', fetchStub);
  await TestBed.configureTestingModule({
    imports: [UsersPage],
    providers: [provideRouter([])],
  }).compileComponents();
  const fixture = TestBed.createComponent(UsersPage);
  for (let round = 0; round < 5; round += 1) {
    await new Promise(resolve => setTimeout(resolve, 0));
    fixture.detectChanges();
  }
  return fixture;
}

describe('UsersPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the first page on open', async () => {
    const urls: string[] = [];
    const fixture = await mount(
      vi.fn(async (url: string) => {
        urls.push(url);
        return json(200, page([sample]));
      }),
    );
    const component = fixture.componentInstance as unknown as Component;

    expect(urls[0]).toBe('/panel-api/users?page=0&size=20');
    expect(component.users()).toHaveLength(1);
  });

  it('forwards the role filter to the BFF', async () => {
    const urls: string[] = [];
    const fixture = await mount(
      vi.fn(async (url: string) => {
        urls.push(url);
        return json(200, page([sample]));
      }),
    );
    const component = fixture.componentInstance as unknown as Component;

    component.onRole('DRIVER');
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(urls[urls.length - 1]).toBe(
      '/panel-api/users?role=DRIVER&page=0&size=20',
    );
  });

  it('asks for the next page when there is one', async () => {
    const urls: string[] = [];
    const fixture = await mount(
      vi.fn(async (url: string) => {
        urls.push(url);
        return json(200, page([sample], {totalPages: 3}));
      }),
    );
    const component = fixture.componentInstance as unknown as Component;

    expect(component.hasNext()).toBe(true);
    await component.next();

    expect(urls[urls.length - 1]).toBe('/panel-api/users?page=1&size=20');
  });

  it('shows a message when the directory cannot be read', async () => {
    const fixture = await mount(
      vi.fn(async () => json(503, {message: 'Driver Management is down'})),
    );
    const component = fixture.componentInstance as unknown as Component;

    expect(component.users()).toHaveLength(0);
    expect(component.error()).not.toBeNull();
  });
});
