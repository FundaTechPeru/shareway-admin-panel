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
}

export function createDependencies(config: PanelConfig): PanelDependencies {
  return {
    config,
    gateway: new GatewayClient(config),
    auditLog: new SqliteAuditLogRepository(openDatabase(config.dbFile)),
  };
}
