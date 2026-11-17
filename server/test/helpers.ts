import type {Express} from 'express';
import {createApp} from '../src/app.js';
import {loadConfig, type PanelConfig} from '../src/config.js';
import {
  SqliteAuditLogRepository,
  type AuditLogRepository,
} from '../src/db/audit-log-repository.js';
import {openDatabase} from '../src/db/database.js';
import {createDependencies} from '../src/dependencies.js';
import {GatewayClient} from '../src/gateway.js';

export const GATEWAY_URL = 'https://gateway.shareway.test';
export const ADMIN_ID = '8f14e45f-ea1b-4c3f-9d2a-7b6c5d4e3f20';
export const ADMIN_EMAIL = 'admin@shareway.pe';

/** One call the panel made to the gateway, as the stub saw it. */
export interface RecordedCall {
  method: string;
  path: string;
  token?: string;
  body?: unknown;
}

/** What the stubbed gateway answers; an Error stands for a gateway that does not answer. */
export type GatewayReply = {status: number; body?: unknown} | Error;
export type GatewayHandler = (call: RecordedCall) => GatewayReply;

export interface TestPanel {
  app: Express;
  config: PanelConfig;
  auditLog: AuditLogRepository;
  /** Every call the panel made to the gateway, in order. */
  calls: RecordedCall[];
}

export function testPanel(
  options: {env?: NodeJS.ProcessEnv; gateway?: GatewayHandler} = {},
): TestPanel {
  const config = loadConfig({
    GATEWAY_URL,
    DB_FILE: ':memory:',
    WEB_ROOT: './does-not-exist',
    LOG_LEVEL: 'silent',
    ...options.env,
  });
  const calls: RecordedCall[] = [];
  const handler: GatewayHandler =
    options.gateway ?? (() => ({status: 404, body: {message: 'not stubbed'}}));
  const auditLog = new SqliteAuditLogRepository(openDatabase(':memory:'));
  const deps = createDependencies(config, {
    gateway: new GatewayClient(config, stubFetch(handler, calls)),
    auditLog,
  });
  return {app: createApp(deps), config, auditLog, calls};
}

/** Builds a token like the ones Driver Management issues; the signature is never checked. */
export function token(claims: Record<string, unknown> = {}): string {
  const payload = {
    sub: ADMIN_ID,
    email: ADMIN_EMAIL,
    role: 'ADMIN',
    ...claims,
  };
  return [
    encode({alg: 'HS256', typ: 'JWT'}),
    encode(payload),
    'signature-checked-by-the-gateway',
  ].join('.');
}

export function bearer(value = token()): string {
  return `Bearer ${value}`;
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function stubFetch(
  handler: GatewayHandler,
  calls: RecordedCall[],
): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const authorization = headers['authorization'];
    const call: RecordedCall = {
      method: init?.method ?? 'GET',
      path: `${url.pathname}${url.search}`,
      token: authorization?.replace('Bearer ', ''),
      body:
        typeof init?.body === 'string'
          ? (JSON.parse(init.body) as unknown)
          : undefined,
    };
    calls.push(call);
    const reply = handler(call);
    if (reply instanceof Error) {
      throw reply;
    }
    return new Response(
      reply.body === undefined ? null : JSON.stringify(reply.body),
      {status: reply.status, headers: {'content-type': 'application/json'}},
    );
  }) as typeof fetch;
}
