import {Component, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {formatTime} from '../../core/format';
import type {
  PendingDocumentsPage,
  PlatformReport,
  Settlement,
} from '../../core/models';
import {PanelApiService} from '../../core/panel-api.service';
import {messageOf} from '../../core/panel-error';

interface ServicesSummary {
  operational: number;
  total: number;
  gatewayDown: boolean;
  checkedAt: string;
}

/**
 * Home of the panel: a short summary built only from data the panel already serves — the state
 * of the platform, the pending documents and the pending settlements. Each card reads its own
 * source, so one service being down never blanks the whole screen, and links to the detail.
 */
@Component({
  selector: 'app-overview-page',
  imports: [RouterLink],
  templateUrl: './overview-page.html',
  styleUrl: './overview-page.css',
})
export class OverviewPage {
  private readonly api = inject(PanelApiService);

  protected readonly services = signal<ServicesSummary | null>(null);
  protected readonly servicesError = signal<string | null>(null);

  protected readonly pendingDocuments = signal<number | null>(null);
  protected readonly documentsError = signal<string | null>(null);

  protected readonly pendingSettlements = signal<number | null>(null);
  protected readonly settlementsError = signal<string | null>(null);

  protected readonly loading = signal(true);

  protected readonly formatTime = formatTime;

  constructor() {
    void this.refresh();
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    await Promise.all([
      this.loadServices(),
      this.loadPendingDocuments(),
      this.loadPendingSettlements(),
    ]);
    this.loading.set(false);
  }

  private async loadServices(): Promise<void> {
    try {
      const report = await this.api.get<PlatformReport>('/panel-api/health');
      this.services.set({
        operational: report.services.filter(s => s.status === 'OPERATIONAL')
          .length,
        total: report.services.length,
        gatewayDown: report.gateway === 'DOWN',
        checkedAt: report.checkedAt,
      });
      this.servicesError.set(null);
    } catch (failure) {
      this.services.set(null);
      this.servicesError.set(
        messageOf(failure, 'No pudimos leer el estado de los servicios.'),
      );
    }
  }

  private async loadPendingDocuments(): Promise<void> {
    try {
      const page = await this.api.get<PendingDocumentsPage>(
        '/panel-api/pending-documents',
      );
      this.pendingDocuments.set(page.documents.length);
      this.documentsError.set(null);
    } catch (failure) {
      this.pendingDocuments.set(null);
      this.documentsError.set(
        messageOf(failure, 'No pudimos leer los documentos pendientes.'),
      );
    }
  }

  private async loadPendingSettlements(): Promise<void> {
    try {
      const body = await this.api.get<unknown>('/panel-api/settlements', {
        status: 'PENDING',
      });
      this.pendingSettlements.set(toSettlements(body).length);
      this.settlementsError.set(null);
    } catch (failure) {
      this.pendingSettlements.set(null);
      this.settlementsError.set(
        messageOf(failure, 'No pudimos leer las liquidaciones pendientes.'),
      );
    }
  }
}

/** Payments & Settlement may answer with a plain list or with a page; both are read here. */
function toSettlements(body: unknown): Settlement[] {
  if (Array.isArray(body)) {
    return body as Settlement[];
  }
  if (body && typeof body === 'object') {
    const values = body as Record<string, unknown>;
    for (const key of ['content', 'settlements', 'items']) {
      const list = values[key];
      if (Array.isArray(list)) {
        return list as Settlement[];
      }
    }
  }
  return [];
}
