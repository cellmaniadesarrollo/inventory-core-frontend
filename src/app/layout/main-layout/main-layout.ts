import { Component, effect, HostListener, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeToggle } from '../../shared/components/theme-toggle/theme-toggle/theme-toggle';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { NgTemplateOutlet } from '@angular/common';
const COLLAPSED_KEY = 'inventario-sidebar-collapsed';

// Paths de iconos (Heroicons outline, 24x24)
const ICONS = {
  dashboard:
    'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
  products: 'M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9',
  suppliers: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.25v11.25m0-11.25h-6.75m0 0V4.5A2.25 2.25 0 018.25 2.25h5.25a2.25 2.25 0 012.25 2.25v3.75',
  movements: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
  logout:
    'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9',
  menu: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
  close: 'M6 18L18 6M6 6l12 12',
  receipts:
    'M9 3.75H6.912a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3',
  signature:
    'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z',
};
@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgTemplateOutlet, ThemeToggle],
  selector: 'app-main-layout',
  styleUrl: './main-layout.css',
  templateUrl: './main-layout.html',
})
export class MainLayout {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly icons = ICONS;
  readonly collapsed = signal(this.readCollapsed());
  readonly mobileOpen = signal(false);

  readonly menu = [
    { label: 'Dashboard', path: '/dashboard', icon: ICONS.dashboard },
    { label: 'Productos', path: '/productos', icon: ICONS.products },
    { label: 'Proveedores', path: '/proveedores', icon: ICONS.suppliers }, // Puedes ajustar a ICONS.proveedores si así lo nombraste
    { label: 'Ingresos', path: '/ingresos', icon: ICONS.receipts },
    { label: 'Movimientos', path: '/movimientos', icon: ICONS.movements },
    { label: 'Firmas', path: '/firmas', icon: ICONS.signature },
  ];

  constructor() {
    // Recordar estado del sidebar de escritorio
    effect(() => {
      try {
        localStorage.setItem(COLLAPSED_KEY, String(this.collapsed()));
      } catch { }
    });

    // Cerrar el panel móvil al navegar
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.mobileOpen.set(false));
  }

  // Una sola hamburguesa: según el ancho, colapsa (escritorio) o abre el panel (móvil)
  toggleSidebar() {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      this.collapsed.update(v => !v);
    } else {
      this.mobileOpen.update(v => !v);
    }
  }

  closeMobile() {
    this.mobileOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closeMobile();
  }

  // Si se agranda la ventana con el panel abierto, lo cerramos
  @HostListener('window:resize')
  onResize() {
    if (window.innerWidth >= 1024) this.closeMobile();
  }

  private readCollapsed(): boolean {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  }
}
