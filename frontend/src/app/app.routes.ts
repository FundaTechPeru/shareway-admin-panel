import {Routes} from '@angular/router';
import {signedInGuard} from './core/auth.guard';
import {Shell} from './layout/shell';

/** Screens of the panel; each one is loaded on its own when it is first opened. */
export const routes: Routes = [
  {
    path: 'login',
    title: 'Ingresar · ShareWay',
    loadComponent: () =>
      import('./features/login/login').then(module => module.LoginPage),
  },
  {
    path: '',
    component: Shell,
    canActivate: [signedInGuard],
    children: [
      {
        path: 'conductores',
        title: 'Verificación de conductores · ShareWay',
        loadComponent: () =>
          import('./features/drivers/drivers-page').then(
            module => module.DriversPage,
          ),
      },
      {
        path: 'registro/bitacora',
        title: 'Bitácora de consultas · ShareWay',
        loadComponent: () =>
          import('./features/audit/audit-page').then(
            module => module.AuditPage,
          ),
      },
      {
        path: 'registro',
        title: 'Registro de viajes · ShareWay',
        loadComponent: () =>
          import('./features/trips/trips-page').then(
            module => module.TripsPage,
          ),
      },
      {
        path: 'liquidaciones',
        title: 'Liquidaciones · ShareWay',
        loadComponent: () =>
          import('./features/settlements/settlements-page').then(
            module => module.SettlementsPage,
          ),
      },
      {
        path: 'servicios',
        title: 'Servicios · ShareWay',
        loadComponent: () =>
          import('./features/services/services-page').then(
            module => module.ServicesPage,
          ),
      },
      {path: '', pathMatch: 'full', redirectTo: 'servicios'},
    ],
  },
  {path: '**', redirectTo: 'servicios'},
];
