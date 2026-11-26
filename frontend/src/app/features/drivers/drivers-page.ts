import {Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {documentLabel, MIN_REASON_LENGTH} from '../../core/document-type';
import {formatDateTime} from '../../core/format';
import {MenuBadgesService} from '../../core/menu-badges.service';
import type {PendingDocument, PendingDocumentsPage} from '../../core/models';
import {PanelApiService} from '../../core/panel-api.service';
import {messageOf, PanelError} from '../../core/panel-error';

type Decision = 'APPROVED' | 'REJECTED';

/**
 * Verification of drivers (US-35). The list comes from the documents waiting for review; the
 * administrator reads one, approves it or rejects it with a reason, and the decision travels to
 * Driver Management through the BFF.
 */
@Component({
  selector: 'app-drivers-page',
  imports: [FormsModule],
  templateUrl: './drivers-page.html',
  styleUrl: './drivers-page.css',
})
export class DriversPage {
  private readonly api = inject(PanelApiService);
  private readonly badges = inject(MenuBadgesService);

  protected readonly documents = signal<PendingDocument[]>([]);
  protected readonly source = signal<string>('gateway');
  protected readonly selectedId = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly working = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly askingReason = signal(false);
  protected reason = '';

  protected readonly selected = computed(
    () =>
      this.documents().find(document => document.id === this.selectedId()) ??
      null,
  );

  protected readonly documentLabel = documentLabel;
  protected readonly formatDateTime = formatDateTime;

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.error.set(null);
    await this.fetchDocuments();
  }

  /** Reads the list again without erasing the message the admin is reading. */
  private async fetchDocuments(): Promise<void> {
    this.loading.set(true);
    try {
      const page = await this.api.get<PendingDocumentsPage>(
        '/panel-api/pending-documents',
      );
      this.documents.set(page.documents);
      this.source.set(page.source);
      if (!page.documents.some(document => document.id === this.selectedId())) {
        this.clearSelection();
      }
    } catch (failure) {
      this.error.set(
        messageOf(failure, 'No pudimos leer los documentos pendientes.'),
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected select(document: PendingDocument): void {
    this.selectedId.set(document.id);
    this.askingReason.set(false);
    this.reason = '';
    this.notice.set(null);
    this.error.set(null);
  }

  protected askReason(): void {
    this.askingReason.set(true);
  }

  protected cancelReason(): void {
    this.askingReason.set(false);
    this.reason = '';
  }

  protected get reasonTooShort(): boolean {
    return this.reason.trim().length < MIN_REASON_LENGTH;
  }

  protected approve(): Promise<void> {
    return this.review('APPROVED');
  }

  protected reject(): Promise<void> {
    if (this.reasonTooShort) {
      this.error.set(
        'Escribe el motivo del rechazo; el conductor lo verá en su aplicación.',
      );
      return Promise.resolve();
    }
    return this.review('REJECTED', this.reason.trim());
  }

  private async review(decision: Decision, reason?: string): Promise<void> {
    const document = this.selected();
    if (!document || this.working()) {
      return;
    }
    this.working.set(true);
    this.error.set(null);
    try {
      await this.api.patch(
        `/panel-api/driver-documents/${document.id}/review`,
        reason === undefined ? {decision} : {decision, reason},
      );
      this.notice.set(
        decision === 'APPROVED'
          ? `Aprobaste ${documentLabel(document.type)} de ${document.driver.name}.`
          : `Rechazaste ${documentLabel(document.type)} de ${document.driver.name}.`,
      );
      this.clearSelection();
      await this.fetchDocuments();
      void this.badges.refreshPendingDrivers();
    } catch (failure) {
      this.error.set(this.explain(failure));
      if (failure instanceof PanelError && failure.status === 409) {
        this.clearSelection();
        await this.fetchDocuments();
      }
    } finally {
      this.working.set(false);
    }
  }

  private clearSelection(): void {
    this.selectedId.set(null);
    this.askingReason.set(false);
    this.reason = '';
  }

  private explain(failure: unknown): string {
    if (failure instanceof PanelError && failure.status === 409) {
      return 'Otra persona ya revisó este documento. Actualizamos la lista.';
    }
    if (failure instanceof PanelError && failure.status === 404) {
      return 'El documento ya no existe en Gestión de conductores.';
    }
    return messageOf(failure, 'No pudimos registrar la decisión.');
  }
}
