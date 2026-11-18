import express, {type Router} from 'express';
import type {AuditLogEntry} from '../db/audit-log-repository.js';
import type {PanelDependencies} from '../dependencies.js';

/**
 * The audit trail of the trip record screen (US-37), read only: there is no route that edits or
 * removes a line, and the repository behind it cannot do either. The export is a CSV the staff
 * opens in a spreadsheet, so its header is in Spanish like the rest of the user interface.
 */
export function auditLogRouter(deps: PanelDependencies): Router {
  const router = express.Router();

  router.get('/audit-log', (req, res) => {
    res.json({lines: read(deps, req.query)});
  });

  router.get('/audit-log.csv', (req, res) => {
    const lines = read(deps, req.query);
    res.type('text/csv; charset=utf-8');
    res.setHeader(
      'content-disposition',
      `attachment; filename="bitacora-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(toCsv(lines));
  });

  return router;
}

function read(
  deps: PanelDependencies,
  query: unknown,
): ReturnType<PanelDependencies['auditLog']['list']> {
  const values = query as Record<string, unknown>;
  const limit = Number(values['limit']);
  return deps.auditLog.list({
    from: text(values['from']),
    to: text(values['to']),
    limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
  });
}

const BOM = String.fromCharCode(0xfeff);

const CSV_HEADER = [
  'fecha',
  'administrador',
  'correo',
  'busqueda',
  'criterio',
  'referencia',
];

function toCsv(lines: AuditLogEntry[]): string {
  const rows = lines.map(line => [
    line.createdAt,
    line.adminId,
    line.adminEmail ?? '',
    line.searchType,
    line.criteria,
    line.reference,
  ]);
  // The byte order mark keeps the accents readable when the file is opened in Excel.
  return `${BOM}${[CSV_HEADER, ...rows].map(toCsvRow).join('\r\n')}\r\n`;
}

function toCsvRow(row: string[]): string {
  return row.map(toCsvField).join(',');
}

function toCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
