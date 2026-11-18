import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Router} from '@angular/router';
import {AuthService} from '../../core/auth.service';
import {messageOf, PanelError} from '../../core/panel-error';

/** Sign in of the panel (ADM-09). Only staff gets in; the BFF decides, not the screen. */
@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly credentials = {email: '', password: ''};
  protected readonly working = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    if (this.working()) {
      return;
    }
    this.error.set(null);
    this.working.set(true);
    try {
      await this.auth.signIn(
        this.credentials.email.trim(),
        this.credentials.password,
      );
      await this.router.navigate(['/servicios']);
    } catch (failure) {
      this.error.set(explain(failure));
    } finally {
      this.working.set(false);
    }
  }
}

function explain(failure: unknown): string {
  if (failure instanceof PanelError) {
    if (failure.status === 403) {
      return 'Acceso solo para personal autorizado.';
    }
    if (failure.status === 401 || failure.status === 400) {
      return 'Correo o contraseña incorrectos.';
    }
  }
  return messageOf(failure, 'No pudimos iniciar tu sesión. Inténtalo de nuevo.');
}
