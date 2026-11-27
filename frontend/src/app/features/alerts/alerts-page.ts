import {Component, computed, inject, signal} from '@angular/core';
import {formatDateTime} from '../../core/format';
import {MenuBadgesService} from '../../core/menu-badges.service';
import type {Alert, AlertsPage as AlertsResponse} from '../../core/models';
import {PanelApiService} from '../../core/panel-api.service';
import {messageOf, PanelError} from '../../core/panel-error';

type Filter = 'OPEN' | 'ATTENDED' | 'ALL';

const PAGE_SIZE = 20;

/**
 * Emergency alerts (US-Alertas). The administrator reads the alerts a driver or a passenger opened
 * during a trip, newest first, and marks each one as attended once it is handled. Attending asks
 * for an in-page confirmation and travels to Trip Execution through the BFF; the open-alerts badge
 * in the sidebar is refreshed afterwards.
 */
@Component({
  selector: 'app-alerts-page',
  templateUrl: './alerts-page.html',
  styleUrl: './alerts-page.css',
})
export class AlertsPage {
  private readonly api = inject(PanelApiService);
  private readonly badges = inject(MenuBadgesService);

  protected readonly alerts = signal<Alert[]>([]);
  protected readonly filter = signal<Filter>('OPEN');
  protected readonly page = signal(0);
  protected readonly totalPages = signal(1);
  protected readonly total = signal(0);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly working = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly confirming = signal(false);
  protected readonly copied = signal<string | null>(null);

  protected readonly selected = computed(
    () => this.alerts().find(alert => alert.id === this.selectedId()) ?? null,
  );

  protected readonly formatDateTime = formatDateTime;

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const status = this.filter() === 'ALL' ? undefined : this.filter();
      const answer = await this.api.get<AlertsResponse>('/panel-api/alerts', {
        status,
        page: String(this.page()),
        size: String(PAGE_SIZE),
      });
      this.alerts.set(sortByDateDesc(answer.items));
      this.total.set(answer.total);
      this.totalPages.set(Math.max(answer.totalPages, 1));
      if (!answer.items.some(alert => alert.id === this.selectedId())) {
        this.selectedId.set(null);
        this.confirming.set(false);
      }
    } catch (failure) {
      this.alerts.set([]);
      this.error.set(messageOf(failure, 'No pudimos leer las alertas.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async changeFilter(filter: Filter): Promise<void> {
    if (filter === this.filter()) {
      return;
    }
    this.filter.set(filter);
    this.page.set(0);
    this.notice.set(null);
    await this.load();
  }

  protected async goTo(page: number): Promise<void> {
    if (page < 0 || page >= this.totalPages() || page === this.page()) {
      return;
    }
    this.page.set(page);
    await this.load();
  }

  protected select(alert: Alert): void {
    this.selectedId.set(alert.id);
    this.confirming.set(false);
    this.notice.set(null);
    this.error.set(null);
  }

  protected askConfirm(): void {
    this.confirming.set(true);
  }

  protected cancelConfirm(): void {
    this.confirming.set(false);
  }

  protected async attend(): Promise<void> {
    const alert = this.selected();
    if (!alert || alert.status !== 'OPEN' || this.working()) {
      return;
    }
    this.working.set(true);
    this.error.set(null);
    try {
      await this.api.patch(`/panel-api/alerts/${alert.id}/attend`);
      this.alerts.update(list =>
        list.map(row =>
          row.id === alert.id ? {...row, status: 'ATTENDED' as const} : row,
        ),
      );
      this.confirming.set(false);
      this.notice.set('La alerta quedó marcada como atendida.');
      void this.badges.refreshOpenAlerts();
    } catch (failure) {
      const message = this.explain(failure);
      if (failure instanceof PanelError && failure.status === 409) {
        this.confirming.set(false);
        await this.load();
      }
      this.error.set(message);
    } finally {
      this.working.set(false);
    }
  }

  protected async copyTrip(tripId: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(tripId);
      this.copied.set(tripId);
      setTimeout(() => {
        if (this.copied() === tripId) {
          this.copied.set(null);
        }
      }, 1500);
    } catch {
      // Clipboard is a convenience; the id is on screen if it is not available.
    }
  }

  protected shortId(id: string): string {
    return id ? id.slice(0, 8) : '—';
  }

  protected reporterLabel(alert: Alert): string {
    const role = alert.reporterRole === 'DRIVER' ? 'Conductor' : 'Pasajero';
    const who = alert.reporterName ?? alert.reporterId ?? '—';
    return `${who} · ${role}`;
  }

  protected emptyMessage(): string {
    if (this.filter() === 'ATTENDED') {
      return 'No hay alertas atendidas.';
    }
    if (this.filter() === 'ALL') {
      return 'No hay alertas registradas.';
    }
    return 'No hay alertas abiertas.';
  }

  private explain(failure: unknown): string {
    if (failure instanceof PanelError && failure.status === 409) {
      return 'La alerta ya había sido atendida. Actualizamos la lista.';
    }
    if (failure instanceof PanelError && failure.status === 404) {
      return 'La alerta ya no existe en Trip Execution.';
    }
    return messageOf(failure, 'No pudimos marcar la alerta como atendida.');
  }
}

/** Newest first, so the most recent emergency is at the top whatever order the service used. */
function sortByDateDesc(items: Alert[]): Alert[] {
  return [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
