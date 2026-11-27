import type {GatewayClient} from '../gateway.js';

/** Roles a user can hold on the platform, as Driver Management reports them. */
export type UserRole = 'PASSENGER' | 'DRIVER' | 'ADMIN';

/** A user as the admin directory shows it; mirrors UserResponse of Driver Management. */
export interface DirectoryUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  driverStatus: string | null;
  createdAt: string;
}

/** Optional filters and paging forwarded to GET /api/v1/users. */
export interface UserQuery {
  role?: string;
  email?: string;
  fullName?: string;
  page?: number;
  size?: number;
}

/** A page of the directory, shaped like the PagedResult the service returns. */
export interface UserDirectoryPage {
  content: DirectoryUser[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/**
 * The "Usuarios" screen reads Driver Management's admin directory
 * (GET /api/v1/users, ADMIN only) through the gateway. The endpoint exists already, so unlike
 * the trip records or the pending documents this adapter has no seed: it always goes to the
 * gateway with the token of the admin who is signed in.
 */
export interface UserDirectoryAdapter {
  search(query: UserQuery, token: string): Promise<UserDirectoryPage>;
}

export function createUserDirectoryAdapter(
  gateway: GatewayClient,
): UserDirectoryAdapter {
  return new GatewayUserDirectory(gateway);
}

export class GatewayUserDirectory implements UserDirectoryAdapter {
  constructor(private readonly gateway: GatewayClient) {}

  async search(query: UserQuery, token: string): Promise<UserDirectoryPage> {
    const search = new URLSearchParams();
    put(search, 'role', query.role);
    put(search, 'email', query.email);
    put(search, 'fullName', query.fullName);
    put(search, 'page', numeric(query.page));
    put(search, 'size', numeric(query.size));
    const suffix = search.size > 0 ? `?${search.toString()}` : '';
    const answer = await this.gateway.call({
      path: `/api/v1/users${suffix}`,
      token,
    });
    return toPage(answer.body, query);
  }
}

function put(search: URLSearchParams, name: string, value?: string): void {
  if (value !== undefined && value !== '') {
    search.set(name, value);
  }
}

function numeric(value: number | undefined): string | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : undefined;
}

/** Driver Management answers with a PagedResult; a plain array is tolerated as a single page. */
function toPage(body: unknown, query: UserQuery): UserDirectoryPage {
  if (Array.isArray(body)) {
    const content = body.filter(isRecord).map(toUser);
    return {
      content,
      page: query.page ?? 0,
      size: query.size ?? content.length,
      totalElements: content.length,
      totalPages: 1,
    };
  }
  if (isRecord(body)) {
    const rows = Array.isArray(body['content']) ? body['content'] : [];
    return {
      content: rows.filter(isRecord).map(toUser),
      page: Number(body['page'] ?? query.page ?? 0),
      size: Number(body['size'] ?? query.size ?? rows.length),
      totalElements: Number(body['totalElements'] ?? rows.length),
      totalPages: Number(body['totalPages'] ?? 1),
    };
  }
  return {content: [], page: 0, size: 0, totalElements: 0, totalPages: 0};
}

function toUser(row: Record<string, unknown>): DirectoryUser {
  return {
    id: String(row['id'] ?? ''),
    email: String(row['email'] ?? ''),
    fullName: String(row['fullName'] ?? row['name'] ?? ''),
    phone: String(row['phone'] ?? ''),
    role: toRole(row['role']),
    driverStatus: text(row['driverStatus']) ?? null,
    createdAt: String(row['createdAt'] ?? ''),
  };
}

function toRole(value: unknown): UserRole {
  return value === 'DRIVER' || value === 'ADMIN' ? value : 'PASSENGER';
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
