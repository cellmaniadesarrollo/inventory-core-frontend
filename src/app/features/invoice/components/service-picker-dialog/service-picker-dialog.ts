// features/invoice/components/service-picker-dialog/service-picker-dialog.ts
import { Component, computed, inject, signal } from '@angular/core';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { forkJoin } from 'rxjs';
import { ServicesCatalogService } from '../../services/services-catalogs.service';
import { BillingService, ServiceType } from '../../types/billing-service.type';
import { ServiceDialog, ServiceDialogData } from '../service-dialog/service-dialog';

@Component({
  selector: 'app-service-picker-dialog',
  templateUrl: './service-picker-dialog.html',
})
export class ServicePickerDialog {
  protected readonly ref = inject<DialogRef<BillingService>>(DialogRef);
  private readonly api = inject(ServicesCatalogService);
  private readonly dialog = inject(Dialog);

  readonly services = signal<BillingService[]>([]);
  readonly types = signal<ServiceType[]>([]);
  readonly term = signal('');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /** Filtra en el navegador por código o nombre. */
  readonly filtered = computed(() => {
    const t = this.term().trim().toLowerCase();
    return this.services().filter((s) => `${s.code} ${s.name}`.toLowerCase().includes(t));
  });

  constructor() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    forkJoin({ types: this.api.types(), services: this.api.list({ onlyActive: true }) }).subscribe({
      next: (res) => {
        this.types.set(res.types);
        this.services.set(res.services);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudieron cargar los servicios.');
        this.loading.set(false);
      },
    });
  }

  /** Crea un servicio y lo agrega de una vez a la venta. */
  create() {
    this.dialog
      .open<BillingService | boolean, ServiceDialogData>(ServiceDialog, { data: { types: this.types() } })
      .closed.subscribe((res) => {
        if (typeof res === 'object') this.ref.close(res);
        else if (res) this.load(); // solo se creó un tipo
      });
  }

  priceWithVat(subtotal: string): string {
    return (Math.round(Number(subtotal) * 1.15 * 100) / 100).toFixed(2);
  }
}