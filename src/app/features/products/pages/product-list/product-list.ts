import { Dialog } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { EMPTY, catchError, debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { ProductFormDialog } from '../../components/product-form-dialog/product-form-dialog';
import { ProductsService } from '../../services/products.service';
import {
  CreateProductResponse,
  ListFilters,
  ListOption,
  ProductFiltersResponse,
  ProductListQuery,
  ProductListResponse,
  ProductSortBy,
  ProductStock,
  StockStatus,
} from '../../types/product.types';
import { ProductDetailDialog } from '../../components/product-detail-dialog/product-detail-dialog';
import { ImageLightboxDialog, LightboxData } from '../../../../shared/components/image-lightbox-dialog/image-lightbox-dialog';
import { StockVoucherCreated, StockVoucherFormDialogData } from '../../../stock-vouchers/types/stock-voucher.types';
import { StockVoucherFormDialog } from '../../../stock-vouchers/components/stock-voucher-form-dialog/stock-voucher-form-dialog';

const FILTER_KEYS = ['productTypeId', 'kind', 'usageId', 'qualityId', 'trackingMode', 'stockStatus'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

interface FilterField {
  key: FilterKey;
  label: string;
  empty: string;
  options: { id: string; name: string }[];
}

// includeFilters NO va aquí: se agrega solo en la primera carga (ver constructor)
const DEFAULT_QUERY: ProductListQuery = { page: 1, limit: 20, sortBy: 'createdAt', sortDir: 'DESC' };

const TRACKING_LABELS: Record<string, string> = {
  QUANTITY: 'Por cantidad',
  SERIAL: 'Por serial/IMEI',
};

// Respaldo mientras llegan los filtros del backend
const FALLBACK_TRACKING: ListOption[] = [
  { value: 'QUANTITY', label: 'Por cantidad' },
  { value: 'SERIAL', label: 'Por serial/IMEI' },
];
const FALLBACK_STOCK: ListOption[] = [
  { value: 'OUT', label: 'Sin stock' },
  { value: 'LOW', label: 'Stock bajo' },
  { value: 'OK', label: 'Con stock' },
];

@Component({
  selector: 'app-product-list',
  imports: [ReactiveFormsModule],
  templateUrl: './product-list.html',
  styleUrl: './product-list.css',
})
export class ProductList {
  private readonly dialog = inject(Dialog);
  private readonly service = inject(ProductsService);
  private readonly fb = inject(FormBuilder);

  // ===== Estado =====
  readonly filters = signal<ProductFiltersResponse | null>(null); // new-data: tipos, clases, usos, calidades
  readonly listFilters = signal<ListFilters | null>(null); // includeFilters: stock, seguimiento, orden
  readonly query = signal<ProductListQuery>({ ...DEFAULT_QUERY });
  readonly result = signal<ProductListResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly limits = [10, 20, 50, 100];
  readonly sortOptions: { value: ProductSortBy; label: string }[] = [
    { value: 'createdAt', label: 'Fecha de creación' },
    { value: 'code', label: 'Código' },
    { value: 'sku', label: 'SKU' },
    { value: 'name', label: 'Nombre' },
    { value: 'basePrice', label: 'Precio base' },
    { value: 'stock', label: 'Stock disponible' },
  ];
  private readonly broken = signal<Set<string>>(new Set());

  // ===== Formularios =====
  readonly search = new FormControl('', { nonNullable: true });
  readonly form = this.fb.nonNullable.group({
    productTypeId: [''],
    kind: [''],
    usageId: [''],
    qualityId: [''],
    trackingMode: [''],
    stockStatus: [''],
  });

  readonly searchText = toSignal(this.search.valueChanges, { initialValue: '' });

  // ===== Derivados =====
  readonly items = computed(() => this.result()?.items ?? []);
  readonly meta = computed(() => this.result()?.meta ?? null);
  readonly from = computed(() => {
    const m = this.meta();
    return m && m.total ? (m.page - 1) * m.limit + 1 : 0;
  });
  readonly to = computed(() => {
    const m = this.meta();
    return m ? Math.min(m.page * m.limit, m.total) : 0;
  });
  readonly activeCount = computed(() => {
    const q = this.query();
    return FILTER_KEYS.filter(k => !!q[k]).length;
  });
  readonly hasActive = computed(() => this.activeCount() > 0 || !!this.query().search);

  readonly fields = computed<FilterField[]>(() => {
    const f = this.filters();
    const lf = this.listFilters();
    const toOpts = (o: ListOption[]) => o.map(x => ({ id: x.value, name: x.label }));
    return [
      { key: 'productTypeId', label: 'Tipo', empty: 'Todos', options: f?.types ?? [] },
      { key: 'kind', label: 'Clase', empty: 'Todas', options: f?.kinds ?? [] },
      { key: 'usageId', label: 'Uso', empty: 'Todos', options: f?.usages ?? [] },
      { key: 'qualityId', label: 'Calidad', empty: 'Todas', options: f?.qualities ?? [] },
      {
        key: 'trackingMode',
        label: 'Seguimiento',
        empty: 'Todos',
        options: toOpts(lf?.trackingModes ?? FALLBACK_TRACKING),
      },
      {
        key: 'stockStatus',
        label: 'Stock',
        empty: 'Todos',
        options: toOpts(lf?.stockStatuses ?? FALLBACK_STOCK),
      },
    ];
  });

  constructor() {
    this.service.getFilters().subscribe({
      next: f => this.filters.set(f),
      error: err => this.error.set(this.message(err, 'No se pudieron cargar los filtros')),
    });

    // Cada cambio del query dispara una carga; switchMap cancela la anterior.
    // includeFilters se pide hasta que los filtros lleguen una vez.
    toObservable(this.query)
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(q => {
          const req: ProductListQuery = this.listFilters() ? q : { ...q, includeFilters: true };
          return this.service.list(req).pipe(
            catchError(err => {
              this.loading.set(false);
              this.error.set(this.message(err, 'No se pudo cargar el listado'));
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe(res => {
        this.result.set(res);
        if (res.filters) this.listFilters.set(res.filters);
        this.broken.set(new Set()); // las URLs firmadas cambian en cada respuesta
        this.loading.set(false);
      });

    // Los selects aplican al instante; la búsqueda con debounce de 300 ms
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.applyFilters());
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.applyFilters());
  }

  // ===== Filtros =====
  // Cualquier cambio de filtro o búsqueda vuelve a la página 1.
  // Los filtros vacíos no se incluyen en el query (no se envían).
  private applyFilters() {
    const v = this.form.getRawValue();
    const search = this.search.value.trim();
    this.query.update(q => {
      const next: ProductListQuery = { page: 1, limit: q.limit, sortBy: q.sortBy, sortDir: q.sortDir };
      if (search) next.search = search;
      for (const key of FILTER_KEYS) {
        if (v[key]) next[key] = v[key];
      }
      return JSON.stringify(next) === JSON.stringify(q) ? q : next;
    });
  }

  clear() {
    this.search.setValue('', { emitEvent: false });
    this.form.reset();
  }

  clearSearch() {
    this.search.setValue('');
  }

  // ===== Orden y paginación =====
  setSortBy(value: string) {
    const col = value as ProductSortBy;
    // Fecha y stock: lo más reciente / con más stock primero
    const desc = col === 'createdAt' || col === 'stock';
    this.query.update(q => ({ ...q, sortBy: col, sortDir: desc ? 'DESC' : 'ASC', page: 1 }));
  }

  toggleDir() {
    this.query.update(q => ({ ...q, sortDir: q.sortDir === 'ASC' ? 'DESC' : 'ASC', page: 1 }));
  }

  goTo(page: number) {
    const m = this.meta();
    if (!m || page < 1 || page > m.totalPages || page === m.page) return;
    this.query.update(q => ({ ...q, page }));
  }

  setLimit(value: string) {
    this.query.update(q => ({ ...q, limit: Number(value), page: 1 }));
  }

  // ===== Crear =====
  openNew() {
    const ref = this.dialog.open<CreateProductResponse>(ProductFormDialog, {
      width: '48rem',
      maxWidth: '95vw',
      autoFocus: 'first-tabbable',
    });

    ref.closed.subscribe(product => {
      if (!product) return;
      this.notice.set(`Producto creado: ${product.sku}`);
      setTimeout(() => this.notice.set(null), 5000);
      this.query.update(q => ({ ...q })); // recarga con los mismos filtros
    });
  }

  // ===== Utilidades de vista =====
  price(value: string): string {
    const n = Number(value);
    return Number.isNaN(n) ? value : n.toFixed(2);
  }

  kindLabel(id: string): string {
    return this.filters()?.kinds.find(k => k.id === id)?.name ?? id;
  }

  trackingLabel(id: string): string {
    return TRACKING_LABELS[id] ?? id;
  }

  // ===== Stock =====
  stockLabel(s: StockStatus): string {
    return s === 'OUT' ? 'Sin stock' : s === 'LOW' ? 'Stock bajo' : 'Con stock';
  }

  stockClass(s: StockStatus): string {
    switch (s) {
      case 'OUT':
        return 'bg-red-500/15 text-red-600 dark:text-red-400';
      case 'LOW':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
      default:
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    }
  }

  // Un solo precio si min = max; "—" si no hay existencias
  salePriceRange(s: ProductStock): string {
    if (s.salePriceMin === null || s.salePriceMax === null) return '—';
    return s.salePriceMin === s.salePriceMax
      ? this.price(s.salePriceMin)
      : `${this.price(s.salePriceMin)} – ${this.price(s.salePriceMax)}`;
  }

  // Primeros `max` nombres separados por coma (el resto se resume como "+N")
  names(list: { name: string }[], max = 2): string {
    return list
      .slice(0, max)
      .map(i => i.name)
      .join(', ');
  }

  allNames(list: { name: string }[]): string {
    return list.map(i => i.name).join(', ');
  }

  isBroken(id: string): boolean {
    return this.broken().has(id);
  }

  markBroken(id: string) {
    this.broken.update(s => new Set(s).add(id));
  }

  dismissError() {
    this.error.set(null);
  }

  private message(err: unknown, fallback: string): string {
    const e = err as { status?: number; error?: { message?: string | string[] } };
    if (e.status === 0) return 'No se pudo conectar con el servidor';
    const msg = e.error?.message;
    return Array.isArray(msg) ? msg.join(', ') : (msg ?? fallback);
  }

  private readonly USAGE_CLASSES: Record<string, string> = {
    SELLABLE: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    REPAIR_PART: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    CUSTOMIZABLE: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  };

  usageClass(code: string): string {
    return this.USAGE_CLASSES[code] ?? 'bg-slate-500/15 text-slate-700 dark:text-slate-300';
  }

  openDetail(id: string) {
    const ref = this.dialog.open<boolean>(ProductDetailDialog, {
      width: '48rem',
      maxWidth: '95vw',
      data: { id },
    });
    ref.closed.subscribe(changed => {
      if (changed) this.query.update(q => ({ ...q })); // recarga el listado
    });
  }

  openProductImage(url: string, fileName = 'imagen') {
    if (!url) return;

    this.dialog.open<void, LightboxData>(ImageLightboxDialog, {
      data: {
        images: [{ url, fileName }],
        startIndex: 0,
      },
      backdropClass: 'bg-black/80',
      panelClass: 'max-w-full',
      autoFocus: false,
    });
  }
  openMovement(p: { id: string; name: string; sku: string; trackingMode: string }) {
    const data: StockVoucherFormDialogData = {
      product: { id: p.id, name: p.name, sku: p.sku, trackingMode: p.trackingMode },
    };
    this.dialog
      .open<StockVoucherCreated>(StockVoucherFormDialog, {
        width: '44rem',
        maxWidth: '95vw',
        autoFocus: 'first-tabbable',
        disableClose: true,
        data,
      })
      .closed.subscribe(voucher => {
        if (!voucher) return;
        this.notice.set(`Movimiento registrado: #${voucher.code}`);
        setTimeout(() => this.notice.set(null), 5000);
        this.query.update(q => ({ ...q })); // el stock cambió: recarga el listado
      });
  }
}