import {Component, inject, signal} from '@angular/core';
import {formatDate} from '../../core/format';
import type {DirectoryUser, UserDirectoryPage, UserRole} from '../../core/models';
import {PanelApiService} from '../../core/panel-api.service';
import {messageOf} from '../../core/panel-error';

interface RoleOption {
  value: '' | UserRole;
  label: string;
}

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const ROLE_LABELS: Record<UserRole, string> = {
  PASSENGER: 'Pasajero',
  DRIVER: 'Conductor',
  ADMIN: 'Administrador',
};

/**
 * User directory (admin panel "Usuarios"). Driver Management owns the users; the screen reads
 * the page through the BFF and filters by role, by name and by e-mail. The filters are applied
 * on the server, so paging stays correct no matter how many users there are.
 */
@Component({
  selector: 'app-users-page',
  templateUrl: './users-page.html',
  styleUrl: './users-page.css',
})
export class UsersPage {
  private readonly api = inject(PanelApiService);
  private debounce?: ReturnType<typeof setTimeout>;

  protected readonly roles: RoleOption[] = [
    {value: '', label: 'Todos los roles'},
    {value: 'PASSENGER', label: 'Pasajeros'},
    {value: 'DRIVER', label: 'Conductores'},
    {value: 'ADMIN', label: 'Administradores'},
  ];

  protected readonly role = signal<'' | UserRole>('');
  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly page = signal(0);

  protected readonly result = signal<UserDirectoryPage | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly formatDate = formatDate;

  constructor() {
    void this.load();
  }

  protected roleLabel(role: UserRole): string {
    return ROLE_LABELS[role] ?? role;
  }

  protected onRole(value: string): void {
    this.role.set((value as UserRole) || '');
    this.page.set(0);
    void this.load();
  }

  protected onName(value: string): void {
    this.name.set(value);
    this.scheduleSearch();
  }

  protected onEmail(value: string): void {
    this.email.set(value);
    this.scheduleSearch();
  }

  protected async previous(): Promise<void> {
    if (this.page() > 0) {
      this.page.update(current => current - 1);
      await this.load();
    }
  }

  protected async next(): Promise<void> {
    const total = this.result()?.totalPages ?? 0;
    if (this.page() + 1 < total) {
      this.page.update(current => current + 1);
      await this.load();
    }
  }

  protected hasPrevious(): boolean {
    return this.page() > 0;
  }

  protected hasNext(): boolean {
    const total = this.result()?.totalPages ?? 0;
    return this.page() + 1 < total;
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.api.get<UserDirectoryPage>('/panel-api/users', {
        role: this.role() || undefined,
        fullName: this.name().trim() || undefined,
        email: this.email().trim() || undefined,
        page: String(this.page()),
        size: String(PAGE_SIZE),
      });
      this.result.set(result);
    } catch (failure) {
      this.result.set(null);
      this.error.set(messageOf(failure, 'No pudimos leer los usuarios.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected users(): DirectoryUser[] {
    return this.result()?.content ?? [];
  }

  private scheduleSearch(): void {
    this.page.set(0);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => void this.load(), SEARCH_DEBOUNCE_MS);
  }
}
