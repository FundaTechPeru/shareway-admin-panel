import {Component, computed, inject, Signal} from '@angular/core';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {AuthService} from '../core/auth.service';
import {MenuBadgesService} from '../core/menu-badges.service';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  badge?: Signal<number | null>;
}

/**
 * Frame of the panel: the ShareWay sidebar on the left and the screen on the right. Two sections
 * carry a counter the admin should not miss — the drivers waiting for review and the open
 * alerts — loaded once when the panel opens and refreshed after the related action.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly badges = inject(MenuBadgesService);

  protected readonly admin = this.auth.admin;
  protected readonly initials = computed(() => {
    const email = this.auth.admin()?.email ?? '';
    return email.slice(0, 2).toUpperCase() || 'SW';
  });

  protected readonly items: NavItem[] = [
    {label: 'Panel', path: '/panel', icon: '▦'},
    {label: 'Usuarios', path: '/usuarios', icon: '○'},
    {
      label: 'Conductores',
      path: '/conductores',
      icon: '⬙',
      badge: this.badges.pendingDrivers,
    },
    {label: 'Alertas', path: '/alertas', icon: '!', badge: this.badges.openAlerts},
    {label: 'Servicios', path: '/servicios', icon: '◉'},
    {label: 'Registro de viajes', path: '/registro', icon: '☰'},
    {label: 'Liquidaciones', path: '/liquidaciones', icon: '₴'},
  ];

  constructor() {
    this.badges.refresh();
  }

  protected async signOut(): Promise<void> {
    this.auth.signOut();
    await this.router.navigate(['/login']);
  }
}
