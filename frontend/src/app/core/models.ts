/** Shapes the BFF answers with. They mirror the interfaces of server/src. */

export interface AdminIdentity {
  id: string;
  email: string;
  role: string;
}

export interface SignInAnswer {
  token: string;
  admin: AdminIdentity;
}

export type ServiceStatus =
  | 'OPERATIONAL'
  | 'RECOVERING'
  | 'DOWN'
  | 'NOT_CONFIGURED'
  | 'UNKNOWN';

export interface ServiceReport {
  name: string;
  status: ServiceStatus;
}

export interface PlatformReport {
  checkedAt: string;
  gateway: ServiceStatus;
  services: ServiceReport[];
}

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
  validation: 'PIN' | 'QR';
}

export interface TripRecord {
  id: string;
  tripId: string;
  status: string;
  closedAt: string;
  driver: {id: string; name: string; licenseNumber?: string};
  vehicle: {
    plate: string;
    brand: string;
    model: string;
    color: string;
    seats: number;
  };
  route: {
    origin: string;
    destination: string;
    departedAt: string;
    arrivedAt: string;
  };
  stops: TripRecordStop[];
  passengers: TripRecordPassenger[];
}

export interface TripRecordsPage {
  source: AdapterSource;
  records: TripRecord[];
  reference: string;
}

export interface TripRecordAnswer {
  source: AdapterSource;
  record: TripRecord;
  reference: string;
}

export type AuditSearchType =
  | 'TRIP'
  | 'DRIVER'
  | 'PASSENGER'
  | 'TRIP_DETAIL'
  | 'ALERT_ATTEND';

export interface AuditLogEntry {
  id: number;
  createdAt: string;
  adminId: string;
  adminEmail: string | null;
  searchType: AuditSearchType;
  criteria: string;
  reference: string;
}

export interface AuditLogPage {
  lines: AuditLogEntry[];
}

export type UserRole = 'PASSENGER' | 'DRIVER' | 'ADMIN';

export interface DirectoryUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  driverStatus: string | null;
  createdAt: string;
}

export interface UserDirectoryPage {
  content: DirectoryUser[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export type AlertReporterRole = 'DRIVER' | 'PASSENGER';

export type AlertStatus = 'OPEN' | 'ATTENDED';

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

export interface AlertsPage {
  items: Alert[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

export type SettlementStatus = 'PENDING' | 'PAID';

export interface Settlement {
  id: string;
  driverId?: string;
  driverName?: string;
  status: SettlementStatus;
  amount?: number;
  currency?: string;
  periodStart?: string;
  periodEnd?: string;
  trips?: number;
  paidAt?: string;
}
