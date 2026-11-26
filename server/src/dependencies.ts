import {
  createPendingDocumentsAdapter,
  type PendingDocumentsAdapter,
} from './adapters/pending-documents.js';
import {
  createTripRecordsAdapter,
  type TripRecordsAdapter,
} from './adapters/trip-records.js';
import {
  createUserDirectoryAdapter,
  type UserDirectoryAdapter,
} from './adapters/users.js';
import type {PanelConfig} from './config.js';
import {
  SqliteAuditLogRepository,
  type AuditLogRepository,
} from './db/audit-log-repository.js';
import {openDatabase} from './db/database.js';
import {GatewayClient} from './gateway.js';

/** Everything the routes need, so a test can replace any piece of it. */
export interface PanelDependencies {
  config: PanelConfig;
  gateway: GatewayClient;
  auditLog: AuditLogRepository;
  pendingDocuments: PendingDocumentsAdapter;
  tripRecords: TripRecordsAdapter;
  users: UserDirectoryAdapter;
}

/**
 * Wires the panel together. The adapters of the endpoints that do not exist yet are chosen here
 * from the feature flags, so turning one on is a deployment setting and not a code change.
 */
export function createDependencies(
  config: PanelConfig,
  overrides: Partial<PanelDependencies> = {},
): PanelDependencies {
  const gateway = overrides.gateway ?? new GatewayClient(config);
  return {
    config,
    gateway,
    auditLog:
      overrides.auditLog ??
      new SqliteAuditLogRepository(openDatabase(config.dbFile)),
    pendingDocuments:
      overrides.pendingDocuments ??
      createPendingDocumentsAdapter(config, gateway),
    tripRecords:
      overrides.tripRecords ?? createTripRecordsAdapter(config, gateway),
    users: overrides.users ?? createUserDirectoryAdapter(gateway),
  };
}
