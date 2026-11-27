import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {formatDateTime} from '../../core/format';
import type {AuditLogEntry, AuditLogPage, AuditSearchType} from '../../core/models';
import {PanelApiService} from '../../core/panel-api.service';
import {messageOf} from '../../core/panel-error';

const SEARCH_LABELS: Record<AuditSearchType, string> = {
  TRIP: 'Por viaje',
  DRIVER: 'Por conductor',
  PASSENGER: 'Por pasajero',
  TRIP_DETAIL: 'Detalle de viaje',
  ALERT_ATTEND: 'Atención de alerta',
};

/**
 * Audit trail of the trip record lookups (US-37). The screen only reads: there is no way to edit
 * or remove a line, here or in the BFF. The export hands the staff the same lines as a CSV.
 */
@Component({
  selector: 'app-audit-page',
  imports: [FormsModule],
  templateUrl: './audit-page.html',
  styleUrl: './audit-page.css',
})
export class AuditPage {
  private readonly api = inject(PanelApiService);

  protected period = {from: '', to: ''};

  protected readonly lines = signal<AuditLogEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly downloading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly formatDateTime = formatDateTime;

  constructor() {
    void this.load();
  }

  protected searchLabel(type: AuditSearchType): string {
    return SEARCH_LABELS[type] ?? type;
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const page = await this.api.get<AuditLogPage>('/panel-api/audit-log', {
        from: this.period.from,
        to: this.period.to,
      });
      this.lines.set(page.lines);
    } catch (failure) {
      this.error.set(messageOf(failure, 'No pudimos leer la bitácora.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async download(): Promise<void> {
    this.downloading.set(true);
    this.error.set(null);
    try {
      const file = await this.api.blob('/panel-api/audit-log.csv', {
        from: this.period.from,
        to: this.period.to,
      });
      save(file, `bitacora-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (failure) {
      this.error.set(messageOf(failure, 'No pudimos exportar la bitácora.'));
    } finally {
      this.downloading.set(false);
    }
  }
}

/** Hands the file to the browser so the staff keeps it where they want. */
function save(file: Blob, name: string): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
