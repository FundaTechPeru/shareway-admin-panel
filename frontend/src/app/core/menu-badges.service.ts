import {inject, Injectable, signal} from '@angular/core';
import type {AlertsPage, PendingDocumentsPage} from './models';
import {PanelApiService} from './panel-api.service';

/**
 * The counters the sidebar shows next to "Conductores" and "Alertas". They are read once when the
 * panel opens and again after an action that changes them (a document reviewed, an alert attended),
 * so the menu stays in step without polling. A read that fails leaves the counter unset and the
 * sidebar simply shows no badge: a counter must never break the menu.
 */
@Injectable({providedIn: 'root'})
export class MenuBadgesService {
  private readonly api = inject(PanelApiService);

  readonly pendingDrivers = signal<number | null>(null);
  readonly openAlerts = signal<number | null>(null);

  /** Loads both counters. Each one is best-effort and independent of the other. */
  refresh(): void {
    void this.refreshPendingDrivers();
    void this.refreshOpenAlerts();
  }

  async refreshPendingDrivers(): Promise<void> {
    try {
      const page = await this.api.get<PendingDocumentsPage>(
        '/panel-api/pending-documents',
      );
      this.pendingDrivers.set(page.documents.length);
    } catch {
      this.pendingDrivers.set(null);
    }
  }

  async refreshOpenAlerts(): Promise<void> {
    try {
      const page = await this.api.get<AlertsPage>('/panel-api/alerts', {
        status: 'OPEN',
        size: '1',
      });
      this.openAlerts.set(page.total);
    } catch {
      this.openAlerts.set(null);
    }
  }
}
