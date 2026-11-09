import { Dialog } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, EMPTY, switchMap, tap } from 'rxjs';
import { DateRangePicker } from '../../../../shared/components/date-range-picker/date-range-picker';
import { PaginationMeta } from '../../../suppliers/types/supplier.types';
import { StockVoucherFormDialog } from '../../components/stock-voucher-form-dialog/stock-voucher-form-dialog';
import { StockVoucherReturnDialog } from '../../components/stock-voucher-return-dialog/stock-voucher-return-dialog';
import { StockVouchersService } from '../../services/stock-vouchers.service';
import {
  Employee, ListVouchersQuery, StockVoucherCreated, StockVoucherReturnDialogData,
  VoucherDirection, VoucherListFilters, VoucherListItem, VoucherSortBy,
} from '../../types/stock-voucher.types';
import { StockVoucherDetailDialog } from '../../components/stock-voucher-detail-dialog/stock-voucher-detail-dialog';

const DIRECTION_LABEL: Record<VoucherDirection, string> = { OUT: 'Salida', IN: 'Retorno' };
const DIRECTION_CLASS: Record<VoucherDirection, string> = {
  OUT: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  IN: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};
const RETURN_STATUS_LABEL: Record<string, string> = {
  NONE: 'Sin devolver',
  PARTIAL: 'Devolución parcial',
  FULL: 'Devuelto',
};
const RETURN_STATUS_CLASS: Record<string, string> = {
  NONE: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  PARTIAL: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  FULL: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};
@Component({
  imports: [ReactiveFormsModule, DatePipe, DateRangePicker],
  selector: 'app-stock-voucher-list',
  styleUrl: './stock-voucher-list.css',
  templateUrl: './stock-voucher-list.html',
})
export class StockVoucherList {
  private readonly dialog = inject(Dialog);
  private readonly api = inject(StockVouchersService);

  readonly notice = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);
  readonly items = signal<VoucherListItem[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);
  readonly filters = signal<VoucherListFilters | null>(null);
  readonly employees = signal<Employee[]>([]);

  /** Id del vale cuyo detalle se está cargando para abrir el retorno */
  readonly returningId = signal<string | null>(null);

  readonly limits = [10, 20, 50, 100];
  readonly sortOptions: { value: VoucherSortBy; label: string }[] = [
    { value: 'createdAt', label: 'Fecha de registro' },
    { value: 'code', label: 'Código' },
  ];

  readonly query = signal<ListVouchersQuery>({
    page: 1, limit: 20, search: '', direction: '', reasonId: '', employeeId: '',
    from: '', to: '', sortBy: 'createdAt', sortDir: 'DESC',
  });
  private readonly reloadTick = signal(0);

  readonly search = new FormControl('', { nonNullable: true });
  readonly searchText = signal('');
  readonly dateRangeControl = new FormControl<any>(null);

  /** Motivos según la dirección elegida */
  readonly reasonOptions = computed(() => {
    const dir = this.query().direction;
    const all = this.filters()?.reasons ?? [];
    return dir ? all.filter(r => r.direction === dir) : all;
  });

  readonly hasActive = computed(() => {
    const q = this.query();
    return !!(q.search || q.direction || q.reasonId || q.employeeId || q.from || q.to);
  });
  readonly from = computed(() => {
    const m = this.meta();
    return !m || m.total === 0 ? 0 : (m.page - 1) * m.limit + 1;
  });
  readonly to = computed(() => {
    const m = this.meta();
    return m ? Math.min(m.page * m.limit, m.total) : 0;
  });

  constructor() {
    this.api.getEmployees().pipe(takeUntilDestroyed()).subscribe({
      next: list => this.employees.set(list),
      error: () => this.employees.set([]), // el filtro por empleado es opcional
    });

    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(v => {
        this.searchText.set(v);
        this.patch({ search: v.trim().replace(/^#/, ''), page: 1 }); // "#123" no funciona en este endpoint
      });

    toObservable(computed(() => ({ q: this.query(), t: this.reloadTick() })))
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(({ q }) =>
          this.api.list(q, !this.filters()).pipe(
            catchError(err => {
              const msg = err?.error?.message;
              this.error.set(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'No se pudo cargar el listado de movimientos.'));
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(res => {
        if (res.filters) this.filters.set(res.filters);
        this.items.set(res.items);
        this.meta.set(res.meta);
        this.error.set(null);
        this.loading.set(false);
      });

    this.dateRangeControl.valueChanges.pipe(takeUntilDestroyed()).subscribe(range => {
      if (range?.dateFrom && range?.dateTo) this.patch({ from: range.dateFrom, to: range.dateTo, page: 1 });
      else this.patch({ from: '', to: '', page: 1 });
    });
  }

  private patch(changes: Partial<ListVouchersQuery>) {
    this.query.update(q => ({ ...q, ...changes }));
  }

  reload() { this.reloadTick.update(n => n + 1); }

  // ---------- Filtros ----------
  clearSearch() { this.search.setValue(''); }

  setDirection(v: string) {
    const direction = v as ListVouchersQuery['direction'];
    // si el motivo elegido ya no corresponde a la dirección, se descarta
    const reason = this.filters()?.reasons.find(r => r.id === this.query().reasonId);
    const reasonId = reason && direction && reason.direction !== direction ? '' : this.query().reasonId;
    this.patch({ direction, reasonId, page: 1 });
  }
  setReason(v: string) { this.patch({ reasonId: v, page: 1 }); }
  setEmployee(v: string) { this.patch({ employeeId: v, page: 1 }); }

  clear() {
    this.search.setValue('', { emitEvent: false });
    this.searchText.set('');
    this.dateRangeControl.setValue(null, { emitEvent: false });
    this.patch({ search: '', direction: '', reasonId: '', employeeId: '', from: '', to: '', page: 1 });
  }

  // ---------- Orden y paginación ----------
  setSortBy(v: string) { this.patch({ sortBy: v as VoucherSortBy, page: 1 }); }
  toggleDir() { this.patch({ sortDir: this.query().sortDir === 'ASC' ? 'DESC' : 'ASC', page: 1 }); }
  setLimit(v: string) { this.patch({ limit: Number(v), page: 1 }); }
  goTo(page: number) {
    const m = this.meta();
    if (!m || page < 1 || page > m.totalPages) return;
    this.patch({ page });
  }

  dismissError() { this.error.set(null); }

  directionLabel(d: VoucherDirection) { return DIRECTION_LABEL[d] ?? d; }
  directionClass(d: VoucherDirection) { return DIRECTION_CLASS[d] ?? ''; }

  openNew() {
    this.dialog
      .open<StockVoucherCreated>(StockVoucherFormDialog, {
        width: '44rem',
        maxWidth: '95vw',
        autoFocus: 'first-tabbable',
        disableClose: true,
      })
      .closed.subscribe(voucher => {
        if (!voucher) return;
        this.flash(`Movimiento registrado: #${voucher.code}`);
        this.reload();
      });
  }

  private flash(text: string) {
    this.notice.set(text);
    setTimeout(() => this.notice.set(null), 5000);
  }

  openDetail(id: string) {
    this.dialog
      .open<boolean>(StockVoucherDetailDialog, {
        data: { id },
        width: '48rem',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .closed.subscribe(changed => { if (changed) this.reload(); });
  }

  openReturn(v: VoucherListItem) {
    if (!v.canReturn || this.returningId()) return;
    this.returningId.set(v.id);

    this.api.getOne(v.id).subscribe({
      next: detail => {
        this.returningId.set(null);

        // La lista pudo ir por detrás del estado real: se revalida con el detalle
        if (!detail.lines.some(l => (l.pending ?? 0) > 0)) {
          this.error.set(`El movimiento #${detail.code} ya no tiene repuestos pendientes de devolver.`);
          this.reload();
          return;
        }

        this.dialog
          .open<StockVoucherCreated>(StockVoucherReturnDialog, {
            data: { voucher: detail } satisfies StockVoucherReturnDialogData,
            width: '44rem',
            maxWidth: '95vw',
            autoFocus: 'first-tabbable',
            disableClose: true,
          })
          .closed.subscribe(created => {
            if (!created) return;
            this.flash(`Retorno registrado: #${created.code}`);
            this.reload();
          });
      },
      error: err => {
        this.returningId.set(null);
        const msg = err?.error?.message;
        this.error.set(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'No se pudo cargar el movimiento.'));
      },
    });
  }
  returnStatusLabel(s: string | null) { return s ? (RETURN_STATUS_LABEL[s] ?? s) : ''; }
  returnStatusClass(s: string | null) { return s ? (RETURN_STATUS_CLASS[s] ?? 'bg-surface-hover text-text-subtle') : ''; }
}