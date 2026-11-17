import type {PanelDatabase} from './database.js';

/** What the admin searched by when the trip record was looked up. */
export type AuditSearchType = 'TRIP' | 'DRIVER' | 'PASSENGER' | 'TRIP_DETAIL';

/** One line of the audit trail: who looked up which trip record, when and under which ticket. */
export interface AuditLogEntry {
  id: number;
  createdAt: string;
  adminId: string;
  adminEmail: string | null;
  searchType: AuditSearchType;
  criteria: string;
  reference: string;
}

export type NewAuditLogEntry = Omit<AuditLogEntry, 'id' | 'createdAt'>;

/** Period to read, as a date (2026-11-17) or a full instant; both ends are inclusive. */
export interface AuditLogFilter {
  from?: string;
  to?: string;
  limit?: number;
}

export const AUDIT_LOG_DEFAULT_LIMIT = 200;
export const AUDIT_LOG_MAX_LIMIT = 1000;

/**
 * The audit trail of the trip record screen. It only grows: nothing updates or removes a line,
 * which is why this interface has no such method.
 */
export interface AuditLogRepository {
  record(entry: NewAuditLogEntry): AuditLogEntry;
  list(filter?: AuditLogFilter): AuditLogEntry[];
}

interface AuditLogRow {
  id: number;
  created_at: string;
  admin_id: string;
  admin_email: string | null;
  search_type: string;
  criteria: string;
  reference: string;
}

export class SqliteAuditLogRepository implements AuditLogRepository {
  constructor(private readonly db: PanelDatabase) {}

  record(entry: NewAuditLogEntry): AuditLogEntry {
    const createdAt = new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO audit_log
           (created_at, admin_id, admin_email, search_type, criteria, reference)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        createdAt,
        entry.adminId,
        entry.adminEmail,
        entry.searchType,
        entry.criteria,
        entry.reference,
      );
    return {...entry, id: Number(result.lastInsertRowid), createdAt};
  }

  list(filter: AuditLogFilter = {}): AuditLogEntry[] {
    const conditions: string[] = [];
    const values: string[] = [];
    if (filter.from) {
      conditions.push('created_at >= ?');
      values.push(startOfPeriod(filter.from));
    }
    if (filter.to) {
      conditions.push('created_at <= ?');
      values.push(endOfPeriod(filter.to));
    }
    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(
      Math.max(filter.limit ?? AUDIT_LOG_DEFAULT_LIMIT, 1),
      AUDIT_LOG_MAX_LIMIT,
    );
    const rows = this.db
      .prepare(
        `SELECT id, created_at, admin_id, admin_email, search_type, criteria, reference
           FROM audit_log ${where}
          ORDER BY created_at DESC, id DESC
          LIMIT ?`,
      )
      .all(...values, limit) as AuditLogRow[];
    return rows.map(toEntry);
  }
}

function toEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    createdAt: row.created_at,
    adminId: row.admin_id,
    adminEmail: row.admin_email,
    searchType: row.search_type as AuditSearchType,
    criteria: row.criteria,
    reference: row.reference,
  };
}

/** A plain date means the whole day, so the filter is easy to use from the screen. */
function startOfPeriod(value: string): string {
  return isDateOnly(value) ? `${value}T00:00:00.000Z` : value;
}

function endOfPeriod(value: string): string {
  return isDateOnly(value) ? `${value}T23:59:59.999Z` : value;
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
