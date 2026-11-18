import {inject} from '@angular/core';
import {Router, type CanActivateFn} from '@angular/router';
import {AuthService} from './auth.service';

/** Keeps the screens of the panel behind the sign in. */
export const signedInGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isSignedIn()) {
    return true;
  }
  return inject(Router).createUrlTree(['/login']);
};
