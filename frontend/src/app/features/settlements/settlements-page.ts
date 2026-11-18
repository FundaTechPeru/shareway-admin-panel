import {Component, inject, signal} from '@angular/core';
import {formatDate, formatMoney} from '../../core/format';
import type {Settlement, SettlementStatus} from '../../core/models';
import {PanelApiService} from '../../core/panel-api.service';
import {messageOf, PanelError} from '../../core/panel-error';

type Tab = 'PENDING' | 'PAID' | 'ALL';

interface TabOption {
  value: Tab;
  label: string;
}

/**
 * Driver settlements (US-25). Payments & Settlement owns the money, so the screen only reads the
 * list and asks for the payment to be marked; when somebody else marked it first the service
 * answers 409 and the screen says so instead of pretending it worked.
 */
@Component({
  selector: 'app-settlements-page',
  templateUrl: './settlements-page.html',
  styleUrl: './settlements-page.css',
})
export class SettlementsPage {
  private readonly api = inject(PanelApiService);

  protected readonly tabs: TabOption[] = [
    {value: 'PENDING', label: 'Pendientes'},
    {value: 'PAID', label: 'Pagadas'},
    {value: 'ALL', label: 'Todas'},
  ];

  protected readonly tab = signal<Tab>('PENDING');
  protected readonly settlements = signal<Settlement[]>([]);
  protected readonly loading = signal(true);
  protected readonly working = signal(false);
  protected readonly confirming = signal<Settlement | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected readonly formatDate = formatDate;
  protected readonly formatMoney = formatMoney;

  constructor() {
    void this.load();
  }

  protected statusLabel(status: SettlementStatus): string {
    return status === 'PAID' ? 'Pagada' : 'Pendiente';
  }

  protected async show(tab: Tab): Promise<void> {
    this.tab.set(tab);
    this.confirming.set(null);
    this.notice.set(null);
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const tab = this.tab();
      const body = await this.api.get<unknown>(
        '/panel-api/settlements',
        tab === 'ALL' ? {} : {status: tab},
      );
      this.settlements.set(toSettlements(body));
    } catch (failure) {
      this.settlements.set([]);
      this.error.set(messageOf(failure, 'No pudimos leer las liquidaciones.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected ask(settlement: Settlement): void {
    this.confirming.set(settlement);
    this.notice.set(null);
    this.error.set(null);
  }

  protected cancel(): void {
    this.confirming.set(null);
  }

  protected async markPaid(): Promise<void> {
    const settlement = this.confirming();
    if (!settlement || this.working()) {
      return;
    }
    this.working.set(true);
    this.error.set(null);
    try {
      await this.api.patch(
        `/panel-api/settlements/${settlement.id}/mark-paid`,
        undefined,
      );
      this.notice.set(
        `Marcaste como pagada la liquidación de ${settlement.driverName ?? settlement.id}.`,
      );
      this.confirming.set(null);
      await this.reload();
    } catch (failure) {
      this.error.set(this.explain(failure));
      if (failure instanceof PanelError && failure.status === 409) {
        this.confirming.set(null);
        await this.reload();
      }
    } finally {
      this.working.set(false);
    }
  }

  /** Reads the list again without erasing the message the admin is reading. */
  private async reload(): Promise<void> {
    const message = this.error();
    await this.load();
    if (message && !this.error()) {
      this.error.set(message);
    }
  }

  private explain(failure: unknown): string {
    if (failure instanceof PanelError && failure.status === 409) {
      return 'Esta liquidación ya estaba pagada. Actualizamos la lista.';
    }
    if (failure instanceof PanelError && failure.status === 404) {
      return 'La liquidación ya no existe en Pagos y liquidaciones.';
    }
    return messageOf(failure, 'No pudimos marcar la liquidación como pagada.');
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
