import { Dialog } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, of, switchMap, tap } from 'rxjs';
import { ClientBillingDialog } from '../../components/client-billing-dialog/client-billing-dialog';
import { ClientsService } from '../../services/clients.service';
import { BillingClient, BillingDialogResult, BillingListResponse } from '../../types/clients.types';

@Component({
  selector: 'app-clients-search',
  templateUrl: './clients-search.html',
  styleUrl: './clients-search.css',
})
export class ClientsSearch {
  private readonly api = inject(ClientsService);
  private readonly dialog = inject(Dialog);
  private readonly reload$ = new Subject<void>();

  readonly limit = 20;
  readonly query = signal('');
  readonly status = signal<'all' | 'true' | 'false'>('true');
  readonly page = signal(1);
  readonly total = signal(0);
  readonly items = signal<BillingClient[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly flash = signal<string | null>(null);
  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit)));

  constructor() {
    this.reload$
      .pipe(
        debounceTime(300),
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(() =>
          this.api
            .list({ q: this.query().trim(), active: this.status(), page: this.page(), limit: this.limit })
            .pipe(
              catchError((err) => {
                const msg = err?.error?.message;
                this.error.set(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'No se pudo cargar la lista.'));
                return of<BillingListResponse>({ items: [], total: 0, page: 1, limit: this.limit });
              }),
            ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      });

    this.reload$.next();
  }

  onInput(value: string) {
    this.query.set(value);
    this.page.set(1);
    this.reload$.next();
  }

  onStatus(value: string) {
    this.status.set(value as 'all' | 'true' | 'false');
    this.page.set(1);
    this.reload$.next();
  }

  go(p: number) {
    if (p < 1 || p > this.pages()) return;
    this.page.set(p);
    this.reload$.next();
  }

  displayName(c: BillingClient): string {
    return c.tradeName || [c.firstName, c.lastName].filter(Boolean).join(' ');
  }

  openDialog(client: BillingClient | null) {
    this.dialog
      .open<BillingDialogResult>(ClientBillingDialog, {
        width: '40rem',
        maxWidth: '95vw',
        data: client,
        autoFocus: 'first-tabbable',
        disableClose: true,
      })
      .closed.subscribe((res) => {
        if (!res) return;
        const msg = {
          created: 'Datos creados.',
          updated: 'Datos actualizados.',
          selected: 'Cliente seleccionado.',
        }[res.action];
        this.showFlash(msg);
        this.reload$.next();
      });
  }

  private showFlash(text: string) {
    this.flash.set(text);
    setTimeout(() => this.flash.set(null), 4000);
  }
}