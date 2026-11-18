import {Component, computed, inject} from '@angular/core';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {AuthService} from '../core/auth.service';

interface NavItem {
  label: string;
  path?: string;
  icon: string;
}

/**
 * Frame of the panel: the ShareWay sidebar on the left and the screen on the right. The items
 * without a path are the ones the wireframes show as still to come.
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

  protected readonly admin = this.auth.admin;
  protected readonly initials = computed(() => {
    const email = this.auth.admin()?.email ?? '';
    return email.slice(0, 2).toUpperCase() || 'SW';
  });

  protected readonly items: NavItem[] = [
    {label: 'Panel', icon: '▦'},
    {label: 'Verificaciones', icon: '✓'},
    {label: 'Alertas', icon: '!'},
    {label: 'Usuarios', icon: '○'},
    {label: 'Conductores', path: '/conductores', icon: '⬙'},
    {label: 'Servicios', path: '/servicios', icon: '◉'},
    {label: 'Registro de viajes', path: '/registro', icon: '☰'},
    {label: 'Liquidaciones', path: '/liquidaciones', icon: '₴'},
  ];

  protected async signOut(): Promise<void> {
    this.auth.signOut();
    await this.router.navigate(['/login']);
  }
}
