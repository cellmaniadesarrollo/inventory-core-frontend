// features/invoice/page/service-catalog/service-catalog.ts
import { Component, inject, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { RouterLink } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { ServiceDialog, ServiceDialogData } from '../../components/service-dialog/service-dialog';
import { ServicesCatalogService } from '../../services/services-catalogs.service';
import { BillingService, ServiceType } from '../../types/billing-service.type';

@Component({
  selector: 'app-service-catalog',
  imports: [RouterLink],
  templateUrl: './service-catalog.html',
})
export class ServiceCatalog {
  private readonly api = inject(ServicesCatalogService);
  private readonly dialog = inject(Dialog);
  private loadSub?: Subscription;

  readonly services = signal<BillingService[]>([]);
  readonly types = signal<ServiceType[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private q = '';
  private serviceTypeId = '';

  constructor() {
    this.load();
  }

  load() {
    this.loadSub?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.loadSub = forkJoin({
      types: this.api.types(),
      services: this.api.list({ q: this.q, serviceTypeId: this.serviceTypeId }),
    }).subscribe({
      next: (res) => {
        this.types.set(res.types);
        this.services.set(res.services);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'No se pudo cargar el catálogo.');
      },
    });
  }

  search(q: string) {
    this.q = q.trim();
    this.load();
  }

  filterType(id: string) {
    this.serviceTypeId = id;
    this.load();
  }

  typeName(id: string) {
    return this.types().find((t) => t.id === id)?.name ?? '—';
  }

  open(service?: BillingService) {
    this.dialog
      .open<BillingService | boolean, ServiceDialogData>(ServiceDialog, { data: { types: this.types(), service } })
      .closed.subscribe((changed) => {
        if (changed) this.load();
      });
  }

  toggle(s: BillingService) {
    this.api.setActive(s.id, !s.isActive).subscribe({
      next: () => this.load(),
      error: (err) => this.error.set(err?.error?.message ?? 'No se pudo cambiar el estado.'),
    });
  }
}