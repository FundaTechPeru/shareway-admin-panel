import type {PanelConfig} from '../config.js';
import type {GatewayClient} from '../gateway.js';
import type {AdapterSource} from './pending-documents.js';

/** How the passenger proved at the stop that the seat was theirs. */
export type BoardingValidation = 'PIN' | 'QR';

export interface TripRecordStop {
  name: string;
  scheduledAt: string;
  arrivedAt?: string;
}

export interface TripRecordPassenger {
  passengerId: string;
  name: string;
  stop: string;
  boardedAt: string;
  validation: BoardingValidation;
}

export interface TripRecordVehicle {
  plate: string;
  brand: string;
  model: string;
  color: string;
  seats: number;
}

/**
 * The immutable picture Trip Execution keeps of a finished trip: who drove, in which vehicle,
 * along which route and stops, and which passengers boarded. The panel only reads it.
 */
export interface TripRecord {
  id: string;
  tripId: string;
  status: string;
  closedAt: string;
  driver: {id: string; name: string; licenseNumber?: string};
  vehicle: TripRecordVehicle;
  route: {
    origin: string;
    destination: string;
    departedAt: string;
    arrivedAt: string;
  };
  stops: TripRecordStop[];
  passengers: TripRecordPassenger[];
}

export interface TripRecordQuery {
  tripId?: string;
  driverId?: string;
  passengerId?: string;
}

export interface TripRecordsPage {
  source: AdapterSource;
  records: TripRecord[];
}

/**
 * Trip Execution serves the trip records from GET /api/viajes/admin, reached through the gateway as
 * GET /api/v1/trips/admin (the gateway rewrites /api/v1/trips -> /api/viajes). Until
 * FEATURE_REAL_TRIP_RECORDS is turned on the screen and the audit trail work against a seed of
 * three finished trips.
 */
export interface TripRecordsAdapter {
  search(query: TripRecordQuery, token: string): Promise<TripRecordsPage>;
  byId(
    id: string,
    token: string,
  ): Promise<{source: AdapterSource; record?: TripRecord}>;
}

export function createTripRecordsAdapter(
  config: PanelConfig,
  gateway: GatewayClient,
): TripRecordsAdapter {
  return config.features.realTripRecords
    ? new GatewayTripRecords(gateway)
    : new MockTripRecords();
}

/** Driver details composed from Driver Management for a trip record row. */
interface DriverDetails {
  name: string;
  licenseNumber?: string;
  vehicle: TripRecordVehicle;
}

export class GatewayTripRecords implements TripRecordsAdapter {
  constructor(private readonly gateway: GatewayClient) {}

  async search(
    query: TripRecordQuery,
    token: string,
  ): Promise<TripRecordsPage> {
    // Trip Execution's admin endpoint filters by conductorId/pasajeroId (its own query handler),
    // not by the panel's driverId/passengerId names, so they are mapped here.
    const search = new URLSearchParams();
    if (query.tripId) {
      search.set('tripId', query.tripId);
    }
    if (query.driverId) {
      search.set('conductorId', query.driverId);
    }
    if (query.passengerId) {
      search.set('pasajeroId', query.passengerId);
    }
    const qs = search.toString();
    const answer = await this.gateway.call({
      path: `/api/v1/trips/admin${qs ? `?${qs}` : ''}`,
      token,
    });
    return {source: 'gateway', records: await this.enrichAll(answer.body, token)};
  }

  async byId(
    id: string,
    token: string,
  ): Promise<{source: AdapterSource; record?: TripRecord}> {
    const answer = await this.gateway.call({
      path: `/api/v1/trips/admin/${encodeURIComponent(id)}`,
      token,
    });
    if (answer.status !== 200 || !isRecord(answer.body)) {
      return {source: 'gateway', record: undefined};
    }
    const [record] = await this.enrichAll([answer.body], token);
    return {source: 'gateway', record};
  }

  /**
   * The admin endpoint returns only ids and the raw route; the driver's name and vehicle live in
   * Driver Management. For each row this fills them from GET /api/v1/drivers/{id}/public-profile and
   * GET /api/v1/drivers/{id}/vehicle, caching by driver so the same driver is fetched once. A failed
   * lookup degrades to empty fields instead of failing the whole search.
   */
  private async enrichAll(body: unknown, token: string): Promise<TripRecord[]> {
    const rows = toRows(body);
    const cache = new Map<string, DriverDetails>();
    const records: TripRecord[] = [];
    for (const row of rows) {
      const record = toRecord(row);
      const driverId = record.driver.id;
      if (driverId) {
        const details =
          cache.get(driverId) ?? (await this.lookupDriver(driverId, token));
        cache.set(driverId, details);
        record.driver.name = details.name;
        record.driver.licenseNumber = details.licenseNumber;
        record.vehicle = details.vehicle;
      }
      records.push(record);
    }
    return records;
  }

  private async lookupDriver(
    driverId: string,
    token: string,
  ): Promise<DriverDetails> {
    const id = encodeURIComponent(driverId);
    const profile = await this.safeGet(
      `/api/v1/drivers/${id}/public-profile`,
      token,
    );
    const vehicle = await this.safeGet(`/api/v1/drivers/${id}/vehicle`, token);
    return {
      name: isRecord(profile) ? String(profile['fullName'] ?? '') : '',
      licenseNumber: isRecord(profile)
        ? text(profile['licenseNumber'])
        : undefined,
      vehicle: toVehicle(isRecord(vehicle) ? vehicle : {}),
    };
  }

  private async safeGet(path: string, token: string): Promise<unknown> {
    try {
      const answer = await this.gateway.call({path, token});
      return answer.status === 200 ? answer.body : undefined;
    } catch {
      return undefined;
    }
  }
}

export class MockTripRecords implements TripRecordsAdapter {
  async search(query: TripRecordQuery): Promise<TripRecordsPage> {
    return {
      source: 'mock',
      records: SEED.filter(record => matches(record, query)),
    };
  }

  async byId(
    id: string,
  ): Promise<{source: AdapterSource; record?: TripRecord}> {
    return {
      source: 'mock',
      record: SEED.find(record => record.id === id || record.tripId === id),
    };
  }
}

function matches(record: TripRecord, query: TripRecordQuery): boolean {
  if (
    query.tripId &&
    record.tripId !== query.tripId &&
    record.id !== query.tripId
  ) {
    return false;
  }
  if (query.driverId && record.driver.id !== query.driverId) {
    return false;
  }
  if (
    query.passengerId &&
    !record.passengers.some(
      passenger => passenger.passengerId === query.passengerId,
    )
  ) {
    return false;
  }
  return true;
}

/** Three finished trips between the UPC campuses, with their stops and boardings. */
const SEED: TripRecord[] = [
  {
    id: '5c8d1e2f-3a4b-4c5d-8e9f-0a1b2c3d4e01',
    tripId: 'd41f9a70-18c6-4a2b-9f31-5c7e8a9b0c01',
    status: 'COMPLETED',
    closedAt: '2026-11-14T13:05:00.000Z',
    driver: {
      id: 'b7c1d2e3-4f50-4a61-8b72-9c0d1e2f3a40',
      name: 'Luis Alberto Quispe Mamani',
      licenseNumber: 'Q1247853',
    },
    vehicle: {
      plate: 'ABC-123',
      brand: 'Toyota',
      model: 'Yaris',
      color: 'Blanco',
      seats: 4,
    },
    route: {
      origin: 'UPC Monterrico',
      destination: 'Estacion Central, Lima',
      departedAt: '2026-11-14T12:10:00.000Z',
      arrivedAt: '2026-11-14T13:02:00.000Z',
    },
    stops: [
      {
        name: 'UPC Monterrico (puerta 3)',
        scheduledAt: '2026-11-14T12:10:00.000Z',
        arrivedAt: '2026-11-14T12:11:00.000Z',
      },
      {
        name: 'Ovalo Higuereta',
        scheduledAt: '2026-11-14T12:35:00.000Z',
        arrivedAt: '2026-11-14T12:38:00.000Z',
      },
      {
        name: 'Estacion Central, Lima',
        scheduledAt: '2026-11-14T13:00:00.000Z',
        arrivedAt: '2026-11-14T13:02:00.000Z',
      },
    ],
    passengers: [
      {
        passengerId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c01',
        name: 'Ana Lucia Torres Vega',
        stop: 'UPC Monterrico (puerta 3)',
        boardedAt: '2026-11-14T12:12:00.000Z',
        validation: 'PIN',
      },
      {
        passengerId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c02',
        name: 'Diego Fernando Rojas Lama',
        stop: 'Ovalo Higuereta',
        boardedAt: '2026-11-14T12:39:00.000Z',
        validation: 'QR',
      },
    ],
  },
  {
    id: '5c8d1e2f-3a4b-4c5d-8e9f-0a1b2c3d4e02',
    tripId: 'd41f9a70-18c6-4a2b-9f31-5c7e8a9b0c02',
    status: 'COMPLETED',
    closedAt: '2026-11-15T23:50:00.000Z',
    driver: {
      id: 'b7c1d2e3-4f50-4a61-8b72-9c0d1e2f3a41',
      name: 'Rosa Maria Chavez Flores',
      licenseNumber: 'C8841207',
    },
    vehicle: {
      plate: 'XYZ-789',
      brand: 'Kia',
      model: 'Rio',
      color: 'Gris',
      seats: 4,
    },
    route: {
      origin: 'UPC San Isidro',
      destination: 'UPC Villa',
      departedAt: '2026-11-15T22:40:00.000Z',
      arrivedAt: '2026-11-15T23:45:00.000Z',
    },
    stops: [
      {
        name: 'UPC San Isidro',
        scheduledAt: '2026-11-15T22:40:00.000Z',
        arrivedAt: '2026-11-15T22:42:00.000Z',
      },
      {
        name: 'Plaza Lima Sur',
        scheduledAt: '2026-11-15T23:20:00.000Z',
        arrivedAt: '2026-11-15T23:24:00.000Z',
      },
      {
        name: 'UPC Villa',
        scheduledAt: '2026-11-15T23:45:00.000Z',
        arrivedAt: '2026-11-15T23:45:00.000Z',
      },
    ],
    passengers: [
      {
        passengerId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c02',
        name: 'Diego Fernando Rojas Lama',
        stop: 'UPC San Isidro',
        boardedAt: '2026-11-15T22:43:00.000Z',
        validation: 'QR',
      },
      {
        passengerId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c03',
        name: 'Valeria Nicole Arce Pinto',
        stop: 'UPC San Isidro',
        boardedAt: '2026-11-15T22:44:00.000Z',
        validation: 'PIN',
      },
      {
        passengerId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c04',
        name: 'Sebastian Mateo Ruiz Cano',
        stop: 'Plaza Lima Sur',
        boardedAt: '2026-11-15T23:25:00.000Z',
        validation: 'PIN',
      },
    ],
  },
  {
    id: '5c8d1e2f-3a4b-4c5d-8e9f-0a1b2c3d4e03',
    tripId: 'd41f9a70-18c6-4a2b-9f31-5c7e8a9b0c03',
    status: 'COMPLETED',
    closedAt: '2026-11-16T15:20:00.000Z',
    driver: {
      id: 'b7c1d2e3-4f50-4a61-8b72-9c0d1e2f3a42',
      name: 'Jorge Enrique Salazar Rios',
      licenseNumber: 'S5530914',
    },
    vehicle: {
      plate: 'JKL-456',
      brand: 'Hyundai',
      model: 'Accent',
      color: 'Azul',
      seats: 4,
    },
    route: {
      origin: 'UPC Monterrico',
      destination: 'Jockey Plaza',
      departedAt: '2026-11-16T14:30:00.000Z',
      arrivedAt: '2026-11-16T15:15:00.000Z',
    },
    stops: [
      {
        name: 'UPC Monterrico (puerta 1)',
        scheduledAt: '2026-11-16T14:30:00.000Z',
        arrivedAt: '2026-11-16T14:33:00.000Z',
      },
      {
        name: 'Jockey Plaza',
        scheduledAt: '2026-11-16T15:15:00.000Z',
        arrivedAt: '2026-11-16T15:15:00.000Z',
      },
    ],
    passengers: [
      {
        passengerId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c01',
        name: 'Ana Lucia Torres Vega',
        stop: 'UPC Monterrico (puerta 1)',
        boardedAt: '2026-11-16T14:34:00.000Z',
        validation: 'QR',
      },
    ],
  },
];

function toRows(body: unknown): Record<string, unknown>[] {
  const rows = Array.isArray(body)
    ? body
    : isRecord(body) && Array.isArray(body['content'])
      ? body['content']
      : [];
  return rows.filter(isRecord);
}

/**
 * Maps one raw /api/viajes/admin row to a TripRecord. The driver's name, license and vehicle are
 * left empty here and filled by the adapter from Driver Management. The real route carries
 * `Puntos` (Etiqueta/Latitud/Longitud/Tipo ORIGEN|PARADA|DESTINO), not panel-shaped stops, and the
 * boarded passengers come from `Abordajes`. Fallbacks to the panel's own shape keep the mock and
 * any future contract change parsing without throwing.
 */
function toRecord(row: Record<string, unknown>): TripRecord {
  const route = isRecord(row['ruta'])
    ? row['ruta']
    : isRecord(row['route'])
      ? row['route']
      : {};
  const points = asArray(route['puntos'] ?? row['stops']);
  return {
    id: String(row['id'] ?? row['tripId'] ?? ''),
    tripId: String(row['id'] ?? row['tripId'] ?? ''),
    status: String(row['estado'] ?? row['status'] ?? ''),
    closedAt: String(row['finReal'] ?? row['closedAt'] ?? ''),
    driver: {
      id: String(row['conductorId'] ?? row['driverId'] ?? ''),
      // Filled from GET /api/v1/drivers/{id}/public-profile by the adapter.
      name: '',
      licenseNumber: undefined,
    },
    // Filled from GET /api/v1/drivers/{id}/vehicle by the adapter.
    vehicle: toVehicle({}),
    route: {
      origin: label(route['origen'] ?? route['origin']) || etiqueta(points, 'ORIGEN'),
      destination:
        label(route['destino'] ?? route['destination']) ||
        etiqueta(points, 'DESTINO'),
      departedAt: String(row['inicioReal'] ?? route['departedAt'] ?? ''),
      arrivedAt: String(row['finReal'] ?? route['arrivedAt'] ?? ''),
    },
    stops: points.map(point => ({
      name: label(point) || String(point['name'] ?? ''),
      scheduledAt: String(point['scheduledAt'] ?? ''),
      // The real route has no per-stop arrival time; leave it empty rather than invent one.
      arrivedAt: text(point['arrivedAt']),
    })),
    passengers: asArray(row['abordajes'] ?? row['passengers']).map(passenger => ({
      passengerId: String(
        passenger['pasajeroId'] ?? passenger['passengerId'] ?? passenger['id'] ?? '',
      ),
      // TODO: Driver Management has no public passenger profile yet, so the name is left empty
      // instead of invented; fill it once such an endpoint exists.
      name: String(passenger['name'] ?? passenger['fullName'] ?? ''),
      stop: String(passenger['stop'] ?? ''),
      boardedAt: String(passenger['abordadoEn'] ?? passenger['boardedAt'] ?? ''),
      validation:
        String(passenger['metodo'] ?? passenger['validation'] ?? '').toUpperCase() === 'QR'
          ? 'QR'
          : 'PIN',
    })),
  };
}

function toVehicle(vehicle: Record<string, unknown>): TripRecordVehicle {
  return {
    plate: String(vehicle['plate'] ?? ''),
    brand: String(vehicle['brand'] ?? ''),
    model: String(vehicle['model'] ?? ''),
    color: String(vehicle['color'] ?? ''),
    seats: Number(vehicle['seats'] ?? 0),
  };
}

/** The label of a route point, whether it is a plain string or a {Etiqueta} object. */
function label(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (isRecord(value)) {
    return String(value['etiqueta'] ?? value['name'] ?? value['label'] ?? '');
  }
  return '';
}

/** The label of the first point of a given type (ORIGEN, DESTINO), if any. */
function etiqueta(points: Record<string, unknown>[], type: string): string {
  const point = points.find(
    candidate => String(candidate['tipo'] ?? candidate['type'] ?? '').toUpperCase() === type,
  );
  return point ? label(point) : '';
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
