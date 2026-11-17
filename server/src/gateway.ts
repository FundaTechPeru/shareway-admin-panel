import type {PanelConfig} from './config.js';

/** What the gateway answered: its status code and the parsed body, whatever it was. */
export interface GatewayAnswer<T = unknown> {
  status: number;
  body: T;
}

export interface GatewayRequest {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Path on the gateway, starting with a slash, query string included. */
  path: string;
  /** Access token of the admin, forwarded as is so the gateway validates it again. */
  token?: string;
  body?: unknown;
  timeoutMs?: number;
}

/** The gateway could not be reached, or took longer than the budget of the panel. */
export class GatewayUnavailableError extends Error {
  constructor(
    readonly path: string,
    override readonly cause: unknown,
  ) {
    super(`The gateway did not answer ${path}`);
    this.name = 'GatewayUnavailableError';
  }
}

/**
 * The single way out of the panel. Every call goes to the ShareWay API gateway with the token of
 * the admin who is signed in, so the services apply their own ADMIN checks and the panel never
 * holds credentials of its own.
 */
export class GatewayClient {
  constructor(
    private readonly config: PanelConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async call<T = unknown>(request: GatewayRequest): Promise<GatewayAnswer<T>> {
    const headers: Record<string, string> = {accept: 'application/json'};
    if (request.token) {
      headers['authorization'] = `Bearer ${request.token}`;
    }
    if (request.body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    let response: Response;
    try {
      response = await this.fetchImpl(
        `${this.config.gatewayUrl}${request.path}`,
        {
          method: request.method ?? 'GET',
          headers,
          body:
            request.body === undefined
              ? undefined
              : JSON.stringify(request.body),
          signal: AbortSignal.timeout(
            request.timeoutMs ?? this.config.gatewayTimeoutMs,
          ),
        },
      );
    } catch (cause) {
      throw new GatewayUnavailableError(request.path, cause);
    }
    return {status: response.status, body: (await readBody(response)) as T};
  }
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
