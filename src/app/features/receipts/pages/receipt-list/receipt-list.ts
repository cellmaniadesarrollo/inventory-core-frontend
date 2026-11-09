import { Dialog } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { ReceiptFormDialog } from '../../components/receipt-form-dialog/receipt-form-dialog';
import { DocumentTypeOption, LabeledOption, ListReceiptsQuery, PaymentStatus, Receipt, ReceiptListFilters, ReceiptListItem, ReceiptPrintItem, ReceiptSortBy, ReceiptStatus, RegisterPaymentResponse, SupplierOption } from '../../types/receipt.types';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Autocomplete } from '../../../../shared/components/autocomplete/autocomplete';
import { ReceiptsService } from '../../services/receipts.service';
import { PaginationMeta } from '../../../suppliers/types/supplier.types';
import { catchError, debounceTime, distinctUntilChanged, EMPTY, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { PaymentDialogData, PaymentStatusDialog } from '../../components/payment-status-dialog/payment-status-dialog';
import { ReceiptDetailDialog } from '../../components/receipt-detail-dialog/receipt-detail-dialog';
import { DateRangePicker } from '../../../../shared/components/date-range-picker/date-range-picker';
import { PrinterType } from '../../../../shared/types/label.types';
import { buildLabelItems } from '../../utils/label-items';
import { LabelPrintDialog, LabelPrintDialogData } from '../../../../shared/components/label-print-dialog/label-print-dialog';

const STATUS_CLASS: Record<ReceiptStatus, string> = {
  REGISTERED: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  VERIFIED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  VOIDED: 'bg-red-500/15 text-red-600 dark:text-red-400',
};

const PAYMENT_CLASS: Record<PaymentStatus, string> = {
  UNPAID: 'bg-red-500/15 text-red-600 dark:text-red-400',
  PARTIAL: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  PAID: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};

// Respaldo mientras llegan los filtros del backend (o si fallan)
const FALLBACK_STATUS: Record<ReceiptStatus, string> = {
  REGISTERED: 'Registrado', VERIFIED: 'Verificado', VOIDED: 'Anulado',
};
const FALLBACK_PAYMENT: Record<PaymentStatus, string> = {
  UNPAID: 'No pagado', PARTIAL: 'Pago parcial', PAID: 'Pagado',
};
const FALLBACK_SORT: LabeledOption<ReceiptSortBy>[] = [
  { value: 'issueDate', label: 'Fecha de emisión' },
  { value: 'code', label: 'Código' },
  { value: 'total', label: 'Total' },
  { value: 'createdAt', label: 'Fecha de registro' },
];

@Component({
  imports: [ReactiveFormsModule, DatePipe, Autocomplete, DateRangePicker,],
  selector: 'app-receipt-list',
  styleUrl: './receipt-list.css',
  templateUrl: './receipt-list.html',
})
export class ReceiptList {
  private readonly dialog = inject(Dialog);
  private readonly api = inject(ReceiptsService);

  readonly notice = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);
  readonly items = signal<ReceiptListItem[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);

  /** "id:impresora" en curso; bloquea el doble clic y muestra el estado solo en el botón pulsado */
  readonly printingKey = signal<string | null>(null);

  /** Etiquetas del último ingreso creado que no salieron, para reintentar */
  readonly printRetry = signal<{ code: number | undefined; printer: PrinterType; items: ReceiptPrintItem[] } | null>(null);

  // Filtros que devuelve el backend en la primera carga
  readonly filters = signal<ReceiptListFilters | null>(null);
  readonly statusOptions = computed(() => this.filters()?.statuses ?? []);
  readonly paymentOptions = computed(() => this.filters()?.paymentStatuses ?? []);
  readonly sortOptions = computed(() => this.filters()?.sortOptions ?? FALLBACK_SORT);
  /** Activos primero; los inactivos al final y marcados (ingresos viejos pueden usarlos) */
  readonly documentTypes = computed(() =>
    [...(this.filters()?.documentTypes ?? [])].sort((a, b) => Number(b.active) - Number(a.active)),
  );

  readonly limits = [10, 20, 50, 100];

  readonly query = signal<ListReceiptsQuery>({
    page: 1, limit: 20, search: '', dateFrom: '', dateTo: '', status: '', paymentStatus: '',
    documentTypeId: '', sortBy: 'createdAt', sortDir: 'DESC',
  });
  private readonly reloadTick = signal(0);

  readonly search = new FormControl('', { nonNullable: true });
  readonly dateRangeControl = new FormControl<any>(null);
  readonly searchText = signal('');

  readonly hasActive = computed(() => {
    const q = this.query();
    return !!(q.search || q.dateFrom || q.dateTo || q.status || q.paymentStatus || q.documentTypeId);
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

    // Cada cambio de filtros (o recarga) cancela la petición anterior.
    // Los filtros del backend se piden solo hasta que llegan una vez.
    toObservable(computed(() => ({ q: this.query(), t: this.reloadTick() })))
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(({ q }) =>
          this.api.list(q, !this.filters()).pipe(
            catchError(err => {
              this.error.set(err?.error?.message ?? 'No se pudo cargar el listado de ingresos.');
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
    // Suscripción para el rango de fechas
    this.dateRangeControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(range => {
        if (range && range.dateFrom && range.dateTo) {
          this.patch({ dateFrom: range.dateFrom, dateTo: range.dateTo, page: 1 });
        } else {
          this.patch({ dateFrom: '', dateTo: '', page: 1 });
        }
      });
  }

  private patch(changes: Partial<ListReceiptsQuery>) {
    this.query.update(q => ({ ...q, ...changes }));
  }

  reload() { this.reloadTick.update(n => n + 1); }

  // ---------- Filtros ----------
  clearSearch() { this.search.setValue(''); }

  setStatus(v: string) { this.patch({ status: v as ListReceiptsQuery['status'], page: 1 }); }
  setPayment(v: string) { this.patch({ paymentStatus: v as ListReceiptsQuery['paymentStatus'], page: 1 }); }
  setDocType(v: string) { this.patch({ documentTypeId: v, page: 1 }); }

  /** Si el rango queda invertido (el backend respondería 400), se ajusta el otro extremo */
  setDate(kind: 'dateFrom' | 'dateTo', value: string) {
    const q = this.query();
    const changes: Partial<ListReceiptsQuery> = { [kind]: value, page: 1 };
    const from = kind === 'dateFrom' ? value : q.dateFrom;
    const to = kind === 'dateTo' ? value : q.dateTo;
    if (from && to && from > to) {
      if (kind === 'dateFrom') changes.dateTo = value;
      else changes.dateFrom = value;
    }
    this.patch(changes);
  }

  clear() {
    this.search.setValue('', { emitEvent: false });
    this.searchText.set('');

    // <-- Añade esta línea para limpiar el selector de fechas y su input visual -->
    this.dateRangeControl.setValue(null, { emitEvent: false });

    this.patch({
      search: '',
      dateFrom: '',
      dateTo: '',
      status: '',
      paymentStatus: '',
      documentTypeId: '',
      page: 1
    });
  }

  // ---------- Orden y paginación ----------
  setSortBy(v: string) { this.patch({ sortBy: v as ReceiptSortBy, page: 1 }); }
  toggleDir() { this.patch({ sortDir: this.query().sortDir === 'ASC' ? 'DESC' : 'ASC', page: 1 }); }
  setLimit(v: string) { this.patch({ limit: Number(v), page: 1 }); }
  goTo(page: number) {
    const m = this.meta();
    if (!m || page < 1 || page > m.totalPages) return;
    this.patch({ page });
  }

  dismissError() { this.error.set(null); }

  // ---------- Textos ----------
  statusLabel(s: ReceiptStatus) {
    return this.statusOptions().find(o => o.value === s)?.label ?? FALLBACK_STATUS[s] ?? s;
  }
  statusClass(s: ReceiptStatus) { return STATUS_CLASS[s] ?? ''; }

  paymentLabel(s: PaymentStatus) {
    return this.paymentOptions().find(o => o.value === s)?.label ?? FALLBACK_PAYMENT[s] ?? s;
  }
  paymentClass(s: PaymentStatus) { return PAYMENT_CLASS[s] ?? ''; }

  /** AAAA-MM-DD → DD/MM/AAAA, sin pasar por Date para evitar desfases de zona horaria */
  fmtDate(d: string) {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }

  // ---------- Acciones ----------
  openDetail(id: string) {
    const ref = this.dialog.open<boolean>(ReceiptDetailDialog, {
      data: { id },
      width: '60rem',
      maxWidth: '95vw',
      autoFocus: false,
    });

    ref.closed.subscribe(changed => {
      if (changed) this.reload(); // si se registró un pago, refresca estado de pago y saldo
    });
  }

  openPayment(r: ReceiptListItem) {
    if (r.status === 'VOIDED' || r.paymentStatus === 'PAID') return;

    const ref = this.dialog.open<RegisterPaymentResponse, PaymentDialogData>(PaymentStatusDialog, {
      data: { id: r.id, code: r.code, total: r.total, paidTotal: r.paidTotal, balance: r.balance },
      width: '36rem',
      maxWidth: '95vw',
      autoFocus: 'first-tabbable',
      disableClose: true, // evita perder el formulario por un clic fuera
    });

    ref.closed.subscribe(res => {
      if (!res) return;
      const s = res.receipt;
      // Actualiza solo esa fila con lo que recalculó el backend
      this.items.update(list =>
        list.map(i =>
          i.id === s.receiptId
            ? { ...i, paymentStatus: s.paymentStatus, paidTotal: s.paidTotal, balance: s.balance }
            : i,
        ),
      );
      this.flash(
        res.replayed
          ? `El pago del ingreso #${r.code} ya estaba registrado`
          : `Pago registrado en el ingreso #${r.code}. Saldo: ${s.balance}`,
      );
    });
  }

  openNew() {
    const ref = this.dialog.open<Receipt>(ReceiptFormDialog, {
      width: '64rem',
      maxWidth: '95vw',
      autoFocus: 'first-tabbable',
      disableClose: true,
    });

    ref.closed.subscribe(receipt => {
      if (!receipt) return;
      const code = receipt.code ? ` #${receipt.code}` : '';
      const p = receipt.print;

      if (!p || p.ok) {
        this.flash(`Ingreso registrado${code}${p ? ' y etiquetas enviadas' : ''}`);
      } else {
        this.flash(`Ingreso registrado${code}`);
        const failed = p.items.filter(i => !i.ok);
        if (failed.length) {
          this.printRetry.set({ code: receipt.code, printer: p.printer, items: failed });
        } else {
          this.error.set(
            `Ingreso registrado${code}, pero no se pudo preparar la impresión${p.message ? ': ' + p.message : ''}. ` +
            'Reintenta con los botones Dymo/Zebra de la fila.',
          );
        }
      }
      this.reload();
    });
  }

  retryPrint() {
    const r = this.printRetry();
    if (!r) return;
    this.dialog
      .open<void, LabelPrintDialogData>(LabelPrintDialog, {
        data: {
          printer: r.printer,
          items: r.items.map(i => ({ lotId: i.lotId, cant: i.cant, label: `Línea ${i.lineIndex + 1}` })),
        },
        width: '36rem', maxWidth: '95vw', autoFocus: 'first-tabbable', disableClose: true,
      })
      .closed.subscribe(() => this.printRetry.set(null));
  }

  dismissRetry() { this.printRetry.set(null); }

  private flash(text: string) {
    this.notice.set(text);
    setTimeout(() => this.notice.set(null), 5000);
  }

  printLabels(r: ReceiptListItem, printer: PrinterType) {
    if (this.printingKey() || r.status === 'VOIDED') return;
    this.printingKey.set(`${r.id}:${printer}`);

    this.api.getOne(r.id).subscribe({
      next: d => {
        this.printingKey.set(null);
        // se revalida con el detalle: la lista puede ir por detrás
        if (d.status === 'VOIDED') {
          this.error.set(`El ingreso #${d.code} está anulado`);
          return;
        }
        const items = buildLabelItems(d);
        if (!items.length) {
          this.error.set(`El ingreso #${d.code} no tiene líneas con lote para etiquetar`);
          return;
        }
        this.dialog.open<void, LabelPrintDialogData>(LabelPrintDialog, {
          data: { items, printer },
          width: '36rem',
          maxWidth: '95vw',
          autoFocus: 'first-tabbable',
          disableClose: true,
        });
      },
      error: err => {
        this.printingKey.set(null);
        const msg = err?.error?.message;
        this.error.set(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'No se pudo cargar el ingreso para imprimir.'));
      },
    });
  }
}