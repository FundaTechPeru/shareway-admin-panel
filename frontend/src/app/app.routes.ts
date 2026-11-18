import {Routes} from '@angular/router';

/** Screens of the panel; each one is loaded on its own when it is first opened. */
export const routes: Routes = [
  {
    path: 'login',
    title: 'Ingresar · ShareWay',
    loadComponent: () =>
      import('./features/login/login').then(module => module.LoginPage),
  },
  {path: '', pathMatch: 'full', redirectTo: 'login'},
  {path: '**', redirectTo: 'login'},
];
