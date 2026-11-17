import type {PanelConfig} from '../config.js';
import type {GatewayClient} from '../gateway.js';

/** Where the answer came from, so the screen can say it is still looking at sample data. */
export type AdapterSource = 'mock' | 'gateway';

export type DriverDocumentType =
  | 'DRIVERS_LICENSE'
  | 'NATIONAL_ID'
  | 'CRIMINAL_RECORD'
  | 'VEHICLE_REGISTRATION';

export interface PendingDocument {
  id: string;
  type: DriverDocumentType;
  fileName: string;
  submittedAt: string;
  driver: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    licenseNumber?: string;
  };
}

export interface PendingDocumentsPage {
  source: AdapterSource;
  documents: PendingDocument[];
}

/**
 * Driver Management does not list its pending documents yet: the endpoint
 * GET /api/v1/driver-documents?status=PENDING is planned, and the panel already knows how to
 * read it. Until FEATURE_REAL_PENDING_DOCS is turned on, the screen works against a seed, so the
 * review flow can be used and demonstrated end to end.
 */
export interface PendingDocumentsAdapter {
  list(token: string): Promise<PendingDocumentsPage>;
}

export function createPendingDocumentsAdapter(
  config: PanelConfig,
  gateway: GatewayClient,
): PendingDocumentsAdapter {
  return config.features.realPendingDocuments
    ? new GatewayPendingDocuments(gateway)
    : new MockPendingDocuments();
}

export class GatewayPendingDocuments implements PendingDocumentsAdapter {
  constructor(private readonly gateway: GatewayClient) {}

  async list(token: string): Promise<PendingDocumentsPage> {
    const answer = await this.gateway.call({
      path: '/api/v1/driver-documents?status=PENDING',
      token,
    });
    return {source: 'gateway', documents: toDocuments(answer.body)};
  }
}

export class MockPendingDocuments implements PendingDocumentsAdapter {
  async list(): Promise<PendingDocumentsPage> {
    return {source: 'mock', documents: SEED.map(document => ({...document}))};
  }
}

/** Sample queue of four documents waiting for a decision. */
const SEED: PendingDocument[] = [
  {
    id: '3f9a1c52-5b47-4d8e-9a10-6c2d4e8f1a01',
    type: 'DRIVERS_LICENSE',
    fileName: 'licencia-q1247853.pdf',
    submittedAt: '2026-11-14T13:42:00.000Z',
    driver: {
      id: 'b7c1d2e3-4f50-4a61-8b72-9c0d1e2f3a40',
      name: 'Luis Alberto Quispe Mamani',
      email: 'luis.quispe@upc.edu.pe',
      phone: '+51987654321',
      licenseNumber: 'Q1247853',
    },
  },
  {
    id: '3f9a1c52-5b47-4d8e-9a10-6c2d4e8f1a02',
    type: 'NATIONAL_ID',
    fileName: 'dni-70215498.jpg',
    submittedAt: '2026-11-15T09:15:00.000Z',
    driver: {
      id: 'b7c1d2e3-4f50-4a61-8b72-9c0d1e2f3a41',
      name: 'Rosa Maria Chavez Flores',
      email: 'rosa.chavez@upc.edu.pe',
      phone: '+51912345678',
      licenseNumber: 'C8841207',
    },
  },
  {
    id: '3f9a1c52-5b47-4d8e-9a10-6c2d4e8f1a03',
    type: 'CRIMINAL_RECORD',
    fileName: 'antecedentes-penales.pdf',
    submittedAt: '2026-11-15T18:05:00.000Z',
    driver: {
      id: 'b7c1d2e3-4f50-4a61-8b72-9c0d1e2f3a42',
      name: 'Jorge Enrique Salazar Rios',
      email: 'jorge.salazar@upc.edu.pe',
      phone: '+51998877665',
      licenseNumber: 'S5530914',
    },
  },
  {
    id: '3f9a1c52-5b47-4d8e-9a10-6c2d4e8f1a04',
    type: 'VEHICLE_REGISTRATION',
    fileName: 'tarjeta-propiedad-abc123.pdf',
    submittedAt: '2026-11-16T11:30:00.000Z',
    driver: {
      id: 'b7c1d2e3-4f50-4a61-8b72-9c0d1e2f3a43',
      name: 'Carmen Julia Ponce Vargas',
      email: 'carmen.ponce@upc.edu.pe',
      phone: '+51976543210',
      licenseNumber: 'P2098431',
    },
  },
];

/** Spring answers either a plain array or a page with its rows under "content". */
function toDocuments(body: unknown): PendingDocument[] {
  const rows = Array.isArray(body)
    ? body
    : isRecord(body) && Array.isArray(body['content'])
      ? body['content']
      : [];
  return rows.filter(isRecord).map(toDocument);
}

function toDocument(row: Record<string, unknown>): PendingDocument {
  const driver = isRecord(row['driver']) ? row['driver'] : {};
  return {
    id: String(row['id'] ?? ''),
    type: (row['type'] ??
      row['documentType'] ??
      'DRIVERS_LICENSE') as DriverDocumentType,
    fileName: String(row['fileName'] ?? row['originalFileName'] ?? ''),
    submittedAt: String(row['submittedAt'] ?? row['uploadedAt'] ?? ''),
    driver: {
      id: String(driver['id'] ?? row['userId'] ?? row['driverId'] ?? ''),
      name: String(
        driver['fullName'] ?? driver['name'] ?? row['driverName'] ?? '',
      ),
      email: String(driver['email'] ?? row['driverEmail'] ?? ''),
      phone: optional(driver['phone'] ?? row['driverPhone']),
      licenseNumber: optional(driver['licenseNumber'] ?? row['licenseNumber']),
    },
  };
}

function optional(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
