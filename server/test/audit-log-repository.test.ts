import {beforeEach, describe, expect, it} from 'vitest';
import {
  SqliteAuditLogRepository,
  type AuditLogRepository,
  type NewAuditLogEntry,
} from '../src/db/audit-log-repository.js';
import {openDatabase, type PanelDatabase} from '../src/db/database.js';

const entry: NewAuditLogEntry = {
  adminId: 'e1a0f6de-1f3c-4f0e-9d1a-62b5f3b9a001',
  adminEmail: 'admin@shareway.pe',
  searchType: 'TRIP',
  criteria: 'f2b1c0d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  reference: 'TICKET-1042',
};

describe('audit log repository', () => {
  let db: PanelDatabase;
  let repository: AuditLogRepository;

  beforeEach(() => {
    db = openDatabase(':memory:');
    repository = new SqliteAuditLogRepository(db);
  });

  it('stores a line with its own identifier and instant', () => {
    const stored = repository.record(entry);

    expect(stored.id).toBeGreaterThan(0);
    expect(stored.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(repository.list()).toEqual([stored]);
  });

  it('reads the newest line first', () => {
    repository.record(entry);
    repository.record({...entry, reference: 'TICKET-1043'});

    expect(repository.list().map(line => line.reference)).toEqual([
      'TICKET-1043',
      'TICKET-1042',
    ]);
  });

  it('keeps only the lines of the period, whole days included', () => {
    insertAt(db, '2026-11-15T10:00:00.000Z');
    insertAt(db, '2026-11-17T23:30:00.000Z');
    insertAt(db, '2026-11-20T08:00:00.000Z');

    const lines = repository.list({from: '2026-11-16', to: '2026-11-17'});

    expect(lines.map(line => line.createdAt)).toEqual([
      '2026-11-17T23:30:00.000Z',
    ]);
  });

  it('never returns more lines than asked for', () => {
    repository.record(entry);
    repository.record(entry);
    repository.record(entry);

    expect(repository.list({limit: 2})).toHaveLength(2);
  });
});

function insertAt(db: PanelDatabase, createdAt: string): void {
  db.prepare(
    `INSERT INTO audit_log
       (created_at, admin_id, admin_email, search_type, criteria, reference)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    createdAt,
    entry.adminId,
    entry.adminEmail,
    entry.searchType,
    entry.criteria,
    entry.reference,
  );
}
