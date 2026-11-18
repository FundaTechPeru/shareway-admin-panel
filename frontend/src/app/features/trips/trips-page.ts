import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {formatDateTime, formatTime} from '../../core/format';
import type {
  TripRecord,
  TripRecordAnswer,
  TripRecordsPage,
} from '../../core/models';
import {PanelApiService} from '../../core/panel-api.service';
import {messageOf, PanelError} from '../../core/panel-error';

type Criterion = 'tripId' | 'driverId' | 'passengerId';

interface CriterionOption {
  value: Criterion;
  label: string;
  placeholder: string;
}

/**
 * Trip record lookups (US-36). Nothing is searched without the reference of the requirement that
 * justifies it, because every lookup reads personal data and leaves a line in the audit trail.
 */
@Component({
  selector: 'app-trips-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './trips-page.html',
  styleUrl: './trips-page.css',
})
export class TripsPage {
  private readonly api = inject(PanelApiService);

  protected readonly options: CriterionOption[] = [
    {
      value: 'tripId',
      label: 'Viaje',
      placeholder: 'Identificador del viaje',
    },
    {
      value: 'driverId',
      label: 'Conductor',
      placeholder: 'Identificador del conductor',
    },
    {
      value: 'passengerId',
      label: 'Pasajero',
      placeholder: 'Identificador del pasajero',
    },
  ];

  protected form = {reference: '', criterion: 'tripId' as Criterion, value: ''};

  protected readonly records = signal<TripRecord[] | null>(null);
  protected readonly detail = signal<TripRecord | null>(null);
  protected readonly source = signal<string>('gateway');
  protected readonly searching = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly formatDateTime = formatDateTime;
  protected readonly formatTime = formatTime;

  protected get placeholder(): string {
    return (
      this.options.find(option => option.value === this.form.criterion)
        ?.placeholder ?? ''
    );
  }

  protected async search(): Promise<void> {
    const reference = this.form.reference.trim();
    const value = this.form.value.trim();
    if (!reference) {
      this.error.set(
        'Escribe la referencia del requerimiento; queda guardada en la bitácora.',
      );
      return;
    }
    if (!value) {
      this.error.set('Escribe el identificador que quieres buscar.');
      return;
    }
    this.searching.set(true);
    this.error.set(null);
    this.detail.set(null);
    try {
      const page = await this.api.get<TripRecordsPage>(
        '/panel-api/trip-records',
        {reference, [this.form.criterion]: value},
      );
      this.records.set(page.records);
      this.source.set(page.source);
    } catch (failure) {
      this.records.set(null);
      this.error.set(this.explain(failure));
    } finally {
      this.searching.set(false);
    }
  }

  protected async open(record: TripRecord): Promise<void> {
    const reference = this.form.reference.trim();
    this.searching.set(true);
    this.error.set(null);
    try {
      const answer = await this.api.get<TripRecordAnswer>(
        `/panel-api/trip-records/${record.id}`,
        {reference},
      );
      this.detail.set(answer.record);
    } catch (failure) {
      this.error.set(this.explain(failure));
    } finally {
      this.searching.set(false);
    }
  }

  protected close(): void {
    this.detail.set(null);
  }

  private explain(failure: unknown): string {
    if (failure instanceof PanelError && failure.status === 400) {
      return failure.message.includes('reference')
        ? 'Escribe la referencia del requerimiento antes de buscar.'
        : 'Revisa los datos de la búsqueda.';
    }
    if (failure instanceof PanelError && failure.status === 404) {
      return 'No encontramos el registro de ese viaje.';
    }
    return messageOf(failure, 'No pudimos consultar el registro de viajes.');
  }
}
