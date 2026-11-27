import { Component, effect, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { RealtimeService } from './core/services/realtime.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('inventario-ms');

  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);

  constructor() {
    effect(() => {
      const token = this.auth.token();
      if (token) this.realtime.connect(environment.realtimeUrl, token);
      else this.realtime.disconnect();
    });
  }
}