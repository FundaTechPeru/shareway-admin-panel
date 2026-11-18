import {Component, inject, OnDestroy, signal} from '@angular/core';
import {formatTime} from '../../core/format';
import type {PlatformReport} from '../../core/models';
import {PanelApiService} from '../../core/panel-api.service';
import {messageOf} from '../../core/panel-error';
import {serviceLabel, statusLabel} from '../../core/service-status';

const REFRESH_MS = 30_000;

/**
 * Status of the platform (US-34). The screen reads the gateway through the BFF every thirty
 * seconds; when the gateway is down it says so and leaves every service without data instead of
 * breaking.
 */
@Component({
  selector: 'app-services-page',
  templateUrl: './services-page.html',
  styleUrl: './services-page.css',
})
export class ServicesPage implements OnDestroy {
  private readonly api = inject(PanelApiService);
  private readonly timer = setInterval(() => void this.refresh(), REFRESH_MS);

  protected readonly report = signal<PlatformReport | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly statusLabel = statusLabel;
  protected readonly serviceLabel = serviceLabel;
  protected readonly formatTime = formatTime;

  constructor() {
    void this.refresh();
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      this.report.set(await this.api.get<PlatformReport>('/panel-api/health'));
      this.error.set(null);
    } catch (failure) {
      this.error.set(
        messageOf(failure, 'No pudimos leer el estado de los servicios.'),
      );
    } finally {
      this.loading.set(false);
    }
  }
}
