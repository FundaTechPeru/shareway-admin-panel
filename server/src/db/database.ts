import Database from 'better-sqlite3';
import {mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

export type PanelDatabase = Database.Database;

/**
 * Opens the SQLite file that keeps the audit trail. The panel stores nothing else: every other
 * screen reads from the services through the gateway. The schema is created on the way in, so a
 * fresh deployment needs no migration step; the data access stays behind a repository, which is
 * what a move to PostgreSQL would replace.
 */
export function openDatabase(file: string): PanelDatabase {
  if (file !== ':memory:') {
    const path = resolve(file);
    mkdirSync(dirname(path), {recursive: true});
    return migrate(new Database(path));
  }
  return migrate(new Database(':memory:'));
}

function migrate(db: PanelDatabase): PanelDatabase {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      admin_id TEXT NOT NULL,
      admin_email TEXT,
      search_type TEXT NOT NULL,
      criteria TEXT NOT NULL,
      reference TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS audit_log_created_at ON audit_log (created_at);
  `);
  return db;
}
