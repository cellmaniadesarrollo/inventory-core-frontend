import { Dialog } from '@angular/cdk/dialog';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { IdentificationType, ListSuppliersQuery, PaginationMeta, Supplier, SupplierListItem, SupplierNewDataResponse, SupplierSortBy } from '../../types/supplier.types';
import { SupplierFormDialog } from '../../components/supplier-form-dialog/supplier-form-dialog';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SuppliersService } from '../../services/suppliers.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { SupplierDetailDialog } from '../../components/supplier-detail-dialog/supplier-detail-dialog';

@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-supplier-list',
  styleUrl: './supplier-list.css',
  templateUrl: './supplier-list.html',
})
export class SupplierList {
  private readonly dialog = inject(Dialog);
  private readonly api = inject(SuppliersService);
  private readonly destroyRef = inject(DestroyRef);

  readonly notice = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);
  readonly items = signal<SupplierListItem[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);
  readonly result = computed(() => (this.meta() ? true : null));
  readonly newData = signal<SupplierNewDataResponse | null>(null);

  readonly limits = [10, 20, 50, 100];
  readonly sortOptions: { value: SupplierSortBy; label: string }[] = [
    { value: 'createdAt', label: 'Fecha de registro' },
    { value: 'code', label: 'Código' },
    { value: 'name', label: 'Razón social' },
    { value: 'identification', label: 'Identificación' },
  ];

  readonly query = signal<ListSuppliersQuery>({
    page: 1, limit: 20, search: '', status: '', identificationType: '',
    countryId: '', sortBy: 'createdAt', sortDir: 'DESC',
  });

  // Controles
  readonly search = new FormControl('', { nonNullable: true });
  readonly searchText = signal('');
  readonly form = new FormGroup({
    status: new FormControl('', { nonNullable: true }),
    identificationType: new FormControl('', { nonNullable: true }),
    countryId: new FormControl('', { nonNullable: true }),
  });

  // Filtros dinámicos (los selects se arman con new-data)
  readonly fields = computed(() => {
    const nd = this.newData();
    return [
      {
        key: 'status', label: 'Estado', empty: 'Todos',
        options: [{ id: 'true', name: 'Activos' }, { id: 'false', name: 'Inactivos' }],
      },
      {
        key: 'identificationType', label: 'Tipo de identificación', empty: 'Todos',
        options: (nd?.identificationTypes ?? []).map(t => ({ id: t.value, name: t.label })),
      },
      {
        key: 'countryId', label: 'País', empty: 'Todos',
        options: (nd?.countries ?? []).map(c => ({ id: c.id, name: c.name })),
      },
    ];
  });

  readonly hasActive = computed(() => {
    const q = this.query();
    return !!(q.search || q.status || q.identificationType || q.countryId);
  });

  readonly from = computed(() => {
    const m = this.meta();
    return !m || m.total === 0 ? 0 : (m.page - 1) * m.limit + 1;
  });
  readonly to = computed(() => {
    const m = this.meta();
    return m ? Math.min(m.page * m.limit, m.total) : 0;
  });

  private readonly idLabels: Record<IdentificationType, string> = {
    RUC: 'RUC', CEDULA: 'Cédula', PASSPORT: 'Pasaporte', FOREIGN_ID: 'ID extranjero',
  };

  constructor() {
    this.api.getNewData().pipe(takeUntilDestroyed()).subscribe({
      next: d => this.newData.set(d),
    });

    this.search.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(v => {
        this.searchText.set(v);
        this.patch({ search: v.trim(), page: 1 });
      });

    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(v =>
      this.patch({
        status: (v.status ?? '') as ListSuppliersQuery['status'],
        identificationType: (v.identificationType ?? '') as ListSuppliersQuery['identificationType'],
        countryId: v.countryId ?? '',
        page: 1,
      }),
    );

    this.load();
  }

  // ---------- Carga ----------
  private patch(changes: Partial<ListSuppliersQuery>) {
    this.query.update(q => ({ ...q, ...changes }));
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.list(this.query()).subscribe({
      next: res => {
        this.items.set(res.data);
        this.meta.set(res.meta);
        this.error.set(null);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err?.error?.message ?? 'No se pudo cargar el listado de proveedores.');
        this.loading.set(false);
      },
    });
  }

  // ---------- Acciones de UI ----------
  clearSearch() { this.search.setValue(''); }

  clear() {
    this.search.setValue('', { emitEvent: false });
    this.searchText.set('');
    this.form.reset({ status: '', identificationType: '', countryId: '' }, { emitEvent: false });
    this.patch({ search: '', status: '', identificationType: '', countryId: '', page: 1 });
  }

  setSortBy(v: string) { this.patch({ sortBy: v as SupplierSortBy, page: 1 }); }
  toggleDir() { this.patch({ sortDir: this.query().sortDir === 'ASC' ? 'DESC' : 'ASC', page: 1 }); }
  setLimit(v: string) { this.patch({ limit: Number(v), page: 1 }); }
  goTo(page: number) {
    const m = this.meta();
    if (!m || page < 1 || page > m.totalPages) return;
    this.patch({ page });
  }

  dismissError() { this.error.set(null); }

  idTypeLabel(t: IdentificationType) { return this.idLabels[t] ?? t; }

  openDetail(id: string) {
    const ref = this.dialog.open<boolean>(SupplierDetailDialog, {
      data: { id },
      width: '44rem',
      maxWidth: '95vw',
      autoFocus: false,
    });

    ref.closed.subscribe(changed => {
      if (changed) this.load(); // refresca el listado si hubo ediciones o cambio de estado
    });
  }

  openNew() {
    const ref = this.dialog.open<Supplier>(SupplierFormDialog, {
      width: '40rem', maxWidth: '95vw', autoFocus: 'first-tabbable',
    });

    ref.closed.subscribe(supplier => {
      if (!supplier) return;
      this.notice.set(`Proveedor creado: #${supplier.code} · ${supplier.businessName}`);
      setTimeout(() => this.notice.set(null), 5000);
      this.load(); // refresca el listado
    });
  }
}
