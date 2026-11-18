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
 * Trip Execution will serve these from its trip_records table as
 * GET /api/v1/admin/trip-records; until FEATURE_REAL_TRIP_RECORDS is turned on the screen and
 * the audit trail work against a seed of three finished trips.
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

export class GatewayTripRecords implements TripRecordsAdapter {
  constructor(private readonly gateway: GatewayClient) {}

  async search(
    query: TripRecordQuery,
    token: string,
  ): Promise<TripRecordsPage> {
    const search = new URLSearchParams();
    for (const [name, value] of Object.entries(query)) {
      if (value) {
        search.set(name, value);
      }
    }
    const answer = await this.gateway.call({
      path: `/api/v1/admin/trip-records?${search.toString()}`,
      token,
    });
    return {source: 'gateway', records: toRecords(answer.body)};
  }

  async byId(
    id: string,
    token: string,
  ): Promise<{source: AdapterSource; record?: TripRecord}> {
    const answer = await this.gateway.call({
      path: `/api/v1/admin/trip-records/${encodeURIComponent(id)}`,
      token,
    });
    if (answer.status !== 200) {
      return {source: 'gateway', record: undefined};
    }
    return {source: 'gateway', record: toRecords([answer.body])[0]};
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

function toRecords(body: unknown): TripRecord[] {
  const rows = Array.isArray(body)
    ? body
    : isRecord(body) && Array.isArray(body['content'])
      ? body['content']
      : [];
  return rows.filter(isRecord).map(toRecord);
}

function toRecord(row: Record<string, unknown>): TripRecord {
  const driver = isRecord(row['driver']) ? row['driver'] : {};
  const vehicle = isRecord(row['vehicle']) ? row['vehicle'] : {};
  const route = isRecord(row['route']) ? row['route'] : {};
  return {
    id: String(row['id'] ?? ''),
    tripId: String(row['tripId'] ?? row['id'] ?? ''),
    status: String(row['status'] ?? 'COMPLETED'),
    closedAt: String(row['closedAt'] ?? row['createdAt'] ?? ''),
    driver: {
      id: String(driver['id'] ?? row['driverId'] ?? ''),
      name: String(driver['name'] ?? driver['fullName'] ?? ''),
      licenseNumber: text(driver['licenseNumber']),
    },
    vehicle: {
      plate: String(vehicle['plate'] ?? ''),
      brand: String(vehicle['brand'] ?? ''),
      model: String(vehicle['model'] ?? ''),
      color: String(vehicle['color'] ?? ''),
      seats: Number(vehicle['seats'] ?? 0),
    },
    route: {
      origin: String(route['origin'] ?? row['origin'] ?? ''),
      destination: String(route['destination'] ?? row['destination'] ?? ''),
      departedAt: String(route['departedAt'] ?? row['departedAt'] ?? ''),
      arrivedAt: String(route['arrivedAt'] ?? row['arrivedAt'] ?? ''),
    },
    stops: asArray(row['stops']).map(stop => ({
      name: String(stop['name'] ?? ''),
      scheduledAt: String(stop['scheduledAt'] ?? ''),
      arrivedAt: text(stop['arrivedAt']),
    })),
    passengers: asArray(row['passengers']).map(passenger => ({
      passengerId: String(passenger['passengerId'] ?? passenger['id'] ?? ''),
      name: String(passenger['name'] ?? passenger['fullName'] ?? ''),
      stop: String(passenger['stop'] ?? ''),
      boardedAt: String(passenger['boardedAt'] ?? ''),
      validation: (passenger['validation'] === 'QR'
        ? 'QR'
        : 'PIN') as BoardingValidation,
    })),
  };
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
