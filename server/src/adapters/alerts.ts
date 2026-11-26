import type {GatewayClient} from '../gateway.js';

/** Who opened the alert, as Trip Execution records it. */
export type AlertReporterRole = 'DRIVER' | 'PASSENGER';

/** An emergency alert is open until an administrator attends it. */
export type AlertStatus = 'OPEN' | 'ATTENDED';

/**
 * An emergency alert as the panel reads it. Trip Execution speaks Spanish (estado Abierta/Atendida,
 * reportanteId, rolReportante…); this is the English shape the "Alertas" screen works against. The
 * reporter name is filled best-effort from Driver Management when the reporter is a driver.
 */
export interface Alert {
  id: string;
  tripId: string;
  reporterId: string;
  reporterRole: AlertReporterRole;
  reporterName?: string;
  type: string;
  description: string;
  status: AlertStatus;
  createdAt: string;
  attendedAt?: string;
  attendedBy?: string;
}

export interface AlertQuery {
  status?: AlertStatus;
  page?: number;
  size?: number;
}

export interface AlertsPage {
  items: Alert[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

/**
 * The "Alertas" screen reads Trip Execution's admin listing through the gateway:
 * GET /api/v1/trips/alertas -> GET /api/viajes/alertas (the gateway rewrites /api/v1/trips ->
 * /api/viajes), and PATCH /api/v1/trips/alertas/{id}/atender to resolve one. Both are ADMIN only,
 * so the adapter always carries the token of the admin who is signed in. The endpoint already
 * exists, so there is no mock.
 */
export interface AlertsAdapter {
  list(query: AlertQuery, token: string): Promise<AlertsPage>;
  attend(id: string, token: string): Promise<number>;
}

export function createAlertsAdapter(gateway: GatewayClient): AlertsAdapter {
  return new GatewayAlerts(gateway);
}

export class GatewayAlerts implements AlertsAdapter {
  constructor(private readonly gateway: GatewayClient) {}

  async list(query: AlertQuery, token: string): Promise<AlertsPage> {
    const search = new URLSearchParams();
    if (query.status) {
      // Trip Execution filters by its own enum: Abierta / Atendida.
      search.set('estado', query.status === 'OPEN' ? 'Abierta' : 'Atendida');
    }
    if (typeof query.page === 'number') {
      search.set('pagina', String(query.page));
    }
    if (typeof query.size === 'number') {
      search.set('tamano', String(query.size));
    }
    const qs = search.toString();
    const answer = await this.gateway.call({
      path: `/api/v1/trips/alertas${qs ? `?${qs}` : ''}`,
      token,
    });
    const body = isRecord(answer.body) ? answer.body : {};
    const items = await this.enrichAll(asArray(body['items']), token);
    return {
      items,
      page: toInt(body['pagina'], query.page ?? 0),
      size: toInt(body['tamano'], query.size ?? items.length),
      total: toInt(body['total'], items.length),
      totalPages: toInt(body['totalPaginas'], 1),
    };
  }

  async attend(id: string, token: string): Promise<number> {
    const answer = await this.gateway.call({
      method: 'PATCH',
      path: `/api/v1/trips/alertas/${encodeURIComponent(id)}/atender`,
      token,
    });
    return answer.status;
  }

  /**
   * Fills the reporter's name when the reporter is a driver, from
   * GET /api/v1/drivers/{id}/public-profile, caching by id so the same driver is fetched once. A
   * failed lookup, or a passenger reporter (no public profile endpoint yet), leaves the name unset
   * and the screen falls back to the id. It never fails the whole list.
   */
  private async enrichAll(rows: unknown[], token: string): Promise<Alert[]> {
    const cache = new Map<string, string | undefined>();
    const alerts: Alert[] = [];
    for (const row of rows) {
      if (!isRecord(row)) {
        continue;
      }
      const alert = toAlert(row);
      if (alert.reporterRole === 'DRIVER' && alert.reporterId) {
        const name = cache.has(alert.reporterId)
          ? cache.get(alert.reporterId)
          : await this.lookupName(alert.reporterId, token);
        cache.set(alert.reporterId, name);
        alert.reporterName = name;
      }
      alerts.push(alert);
    }
    return alerts;
  }

  private async lookupName(
    driverId: string,
    token: string,
  ): Promise<string | undefined> {
    try {
      const answer = await this.gateway.call({
        path: `/api/v1/drivers/${encodeURIComponent(driverId)}/public-profile`,
        token,
      });
      if (answer.status === 200 && isRecord(answer.body)) {
        const name = String(answer.body['fullName'] ?? '').trim();
        return name.length > 0 ? name : undefined;
      }
    } catch {
      // Best effort: the list is more important than the reporter's name.
    }
    return undefined;
  }
}

function toAlert(row: Record<string, unknown>): Alert {
  return {
    id: String(row['id'] ?? ''),
    tripId: String(row['viajeId'] ?? row['tripId'] ?? ''),
    reporterId: String(row['reportanteId'] ?? row['reporterId'] ?? ''),
    reporterRole: toRole(row['rolReportante'] ?? row['reporterRole']),
    type: String(row['tipo'] ?? row['type'] ?? ''),
    description: String(row['descripcion'] ?? row['description'] ?? ''),
    status: toStatus(row['estado'] ?? row['status']),
    createdAt: String(row['creadaEn'] ?? row['createdAt'] ?? ''),
    attendedAt: text(row['atendidaEn'] ?? row['attendedAt']),
    attendedBy: text(row['atendidaPor'] ?? row['attendedBy']),
  };
}

function toRole(value: unknown): AlertReporterRole {
  return String(value ?? '').toUpperCase() === 'PASSENGER'
    ? 'PASSENGER'
    : 'DRIVER';
}

function toStatus(value: unknown): AlertStatus {
  const text = String(value ?? '').toLowerCase();
  return text === 'atendida' || text === 'attended' ? 'ATTENDED' : 'OPEN';
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
