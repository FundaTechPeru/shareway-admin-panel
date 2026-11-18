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
