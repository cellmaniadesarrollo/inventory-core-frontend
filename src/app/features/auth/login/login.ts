import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ThemeToggle } from '../../../shared/components/theme-toggle/theme-toggle/theme-toggle';

@Component({
  imports: [ReactiveFormsModule, ThemeToggle],
  selector: 'app-login',
  styleUrl: './login.css',
  templateUrl: './login.html',
})
export class Login {
  readonly year = new Date().getFullYear();
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal(false);

  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
    remember: [false],
  });

  async onSubmit() {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const coords = await this.getCoords();

    this.auth.login({ ...this.form.getRawValue(), ...coords }).subscribe({
      next: async () => {

        try {
          const ok = await this.router.navigate(['/dashboard']);

          if (!ok) {
            this.loading.set(false);
            this.error.set('La navegación fue rechazada (guard o ruta).');
          }
        } catch (err) {
          console.error('3. error navegando:', err);
          this.loading.set(false);
          this.error.set('No se pudo abrir el panel. Revisa la consola.');
        }
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const e = err as { status?: number; error?: { message?: string | string[] }; message?: string };
        const msg = e.error?.message;
        this.error.set(
          e.status === 0
            ? 'No se pudo conectar con el servidor'
            : Array.isArray(msg) ? msg.join(', ') : msg ?? e.message ?? 'Error al iniciar sesión',
        );
      },
    });
  }

  // Coordenadas opcionales: si el usuario no da permiso o tarda, el login sigue sin ellas
  private getCoords(): Promise<{ latitude?: number; longitude?: number }> {
    return new Promise(resolve => {
      if (!('geolocation' in navigator)) return resolve({});
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve({}),
        { timeout: 3000, maximumAge: 60000 },
      );
    });
  }
}
