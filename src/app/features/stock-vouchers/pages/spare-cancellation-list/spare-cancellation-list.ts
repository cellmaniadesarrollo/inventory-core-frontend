import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, EMPTY, switchMap, tap } from 'rxjs';
import { PaginationMeta } from '../../../suppliers/types/supplier.types';
import { SpareCancellationsService } from '../../services/spare-cancellations.service';
import {
  CancellationSortBy, CancellationStatus, ListCancellationsQuery,
  SpareCancellationApproveDialogData,
  SpareCancellationApproveResult,
  SpareCancellationFilters, SpareCancellationItem,
  SpareCancellationRejectDialogData,
  SpareCancellationRejectResult,
} from '../../types/spare-cancellation.types';
import { Dialog } from '@angular/cdk/dialog';
import { SpareCancellationRejectDialog } from '../../components/spare-cancellation-reject-dialog/spare-cancellation-reject-dialog';
import { SpareCancellationApproveDialog } from '../../components/spare-cancellation-approve-dialog/spare-cancellation-approve-dialog';

const STATUS_LABEL: Record<CancellationStatus, string> = {
  PENDING: 'Pendiente', CONFIRMED: 'Confirmada', REJECTED: 'Rechazada',
};
const STATUS_CLASS: Record<CancellationStatus, string> = {
  PENDING: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  CONFIRMED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  REJECTED: 'bg-red-500/15 text-red-700 dark:text-red-300',
};
// Respaldo hasta que llegue `filters`
const DEFAULT_STATUSES: SpareCancellationFilters['statuses'] = [
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'CONFIRMED', label: 'Confirmadas' },
  { value: 'REJECTED', label: 'Rechazadas' },
];
const DEFAULT_SORTS: SpareCancellationFilters['sortOptions'] = [
  { value: 'createdAt', label: 'Más recientes' },
  { value: 'orderNumber', label: 'Número de orden' },
  { value: 'productName', label: 'Producto' },
  { value: 'sku', label: 'SKU' },
];

@Component({
  imports: [ReactiveFormsModule, DatePipe],
  selector: 'app-spare-cancellation-list',
  styleUrl: './spare-cancellation-list.css',
  templateUrl: './spare-cancellation-list.html',
})
export class SpareCancellationList {
  private readonly api = inject(SpareCancellationsService);

  readonly error = signal<string | null>(null);
  readonly loading = signal(true);
  readonly items = signal<SpareCancellationItem[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);
  readonly filters = signal<SpareCancellationFilters | null>(null);

  readonly limits = [10, 20, 50, 100];

  readonly query = signal<ListCancellationsQuery>({
    page: 1, limit: 20, status: 'PENDING', search: '', sortBy: 'createdAt', sortDir: 'DESC',
  });
  private readonly reloadTick = signal(0);

  readonly search = new FormControl('', { nonNullable: true });
  readonly searchText = signal('');

  readonly statusOptions = computed(() => this.filters()?.statuses ?? DEFAULT_STATUSES);
  readonly sortOptions = computed(() => this.filters()?.sortOptions ?? DEFAULT_SORTS);

  readonly hasActive = computed(() => {
    const q = this.query();
    return !!(q.search || q.status !== 'PENDING');
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
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(v => {
        this.searchText.set(v);
        this.patch({ search: v.trim(), page: 1 });
      });

    toObservable(computed(() => ({ q: this.query(), t: this.reloadTick() })))
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(({ q }) =>
          this.api.list(q, !this.filters()).pipe(
            catchError(err => {
              const msg = err?.error?.message;
              this.error.set(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'No se pudo cargar las solicitudes de cancelación.'));
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
  }

  private patch(changes: Partial<ListCancellationsQuery>) {
    this.query.update(q => ({ ...q, ...changes }));
  }

  reload() { this.reloadTick.update(n => n + 1); }

  // ---------- Filtros ----------
  clearSearch() { this.search.setValue(''); }
  setStatus(v: string) { this.patch({ status: v as CancellationStatus, page: 1 }); }

  clear() {
    this.search.setValue('', { emitEvent: false });
    this.searchText.set('');
    this.patch({ search: '', status: 'PENDING', page: 1 });
  }

  // ---------- Orden y paginación ----------
  setSortBy(v: string) {
    // mismo default del backend: DESC para createdAt, ASC para el resto
    this.patch({ sortBy: v as CancellationSortBy, sortDir: v === 'createdAt' ? 'DESC' : 'ASC', page: 1 });
  }
  toggleDir() { this.patch({ sortDir: this.query().sortDir === 'ASC' ? 'DESC' : 'ASC', page: 1 }); }
  setLimit(v: string) { this.patch({ limit: Number(v), page: 1 }); }
  goTo(page: number) {
    const m = this.meta();
    if (!m || page < 1 || page > m.totalPages) return;
    this.patch({ page });
  }

  dismissError() { this.error.set(null); }

  statusLabel(s: CancellationStatus) { return STATUS_LABEL[s] ?? s; }
  statusClass(s: CancellationStatus) { return STATUS_CLASS[s] ?? 'bg-surface-hover text-text-subtle'; }


  private readonly dialog = inject(Dialog);
  readonly notice = signal<string | null>(null);

  private flash(text: string) {
    this.notice.set(text);
    setTimeout(() => this.notice.set(null), 5000);
  }

  openReject(c: SpareCancellationItem) {
    if (c.status !== 'PENDING') return;
    this.dialog
      .open<SpareCancellationRejectResult>(SpareCancellationRejectDialog, {
        data: { item: c } satisfies SpareCancellationRejectDialogData,
        width: '34rem', maxWidth: '95vw', autoFocus: 'first-tabbable', disableClose: true,
      })
      .closed.subscribe(result => {
        if (!result) return;
        if (result.kind === 'rejected') {
          this.flash('Solicitud rechazada.');
        } else {
          this.error.set(result.message); // 409: la fila ya cambió de estado
        }
        this.reload();
      });
  }
  /** Regla del contrato: PENDING, con saldo y orden replicada que no esté ENTREGADA (8) */
  canApprove(c: SpareCancellationItem) {
    return c.status === 'PENDING' && c.pending > 0
      && c.order.statusId !== null && c.order.statusId !== 8;
  }

  approveHint(c: SpareCancellationItem) {
    if (c.pending <= 0) return 'Sin saldo pendiente: se confirmará sola en breve';
    if (c.order.statusId === null) return 'La orden aún no está sincronizada';
    if (c.order.statusId === 8) return 'La orden ya fue entregada';
    return 'Devolver al stock lo pendiente';
  }

  openApprove(c: SpareCancellationItem) {
    if (!this.canApprove(c)) return;
    this.dialog
      .open<SpareCancellationApproveResult>(SpareCancellationApproveDialog, {
        data: { item: c } satisfies SpareCancellationApproveDialogData,
        width: '40rem', maxWidth: '95vw', autoFocus: 'first-tabbable', disableClose: true,
      })
      .closed.subscribe(result => {
        if (!result) return;
        if (result.kind === 'approved') this.flash(`Retorno registrado: #${result.code}`);
        else this.error.set(result.message);
        this.reload();
      });
  }
}