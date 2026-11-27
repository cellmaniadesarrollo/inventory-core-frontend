import { RouterLink } from '@angular/router';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of, switchMap, tap } from 'rxjs';
import { InvoicesService } from '../../services/invoice.service';
import { SalesService } from '../../services/sales.service';
import { InvoiceStatus } from '../../types/invoice.type';
import { RealtimeService } from '../../../../core/services/realtime.service';

type DocKind = 'FACTURA' | 'RECIBO' | 'NOTA_CREDITO' | 'NOTA_DEBITO' | 'RETORNO';

interface DocItem {
  id: string;
  kind: DocKind;
  number: string;
  buyerName: string;
  buyerIdNumber: string;
  issueDate: string;
  createdAt: string;
  total: string;
  statusCode: string;
  errorMessage: string | null;
}

const KIND_LABEL: Record<DocKind, string> = {
  FACTURA: 'Factura',
  RECIBO: 'Recibo',
  NOTA_CREDITO: 'Nota de crédito',
  NOTA_DEBITO: 'Nota de débito',
  RETORNO: 'Retorno',
};

const KIND_PLURAL: Record<DocKind, string> = {
  FACTURA: 'Facturas',
  RECIBO: 'Recibos',
  NOTA_CREDITO: 'Notas de crédito',
  NOTA_DEBITO: 'Notas de débito',
  RETORNO: 'Retornos',
};

/** Código SRI de comprobante → tipo de documento. */
const SRI_KIND: Record<string, DocKind> = { '01': 'FACTURA', '04': 'NOTA_CREDITO', '05': 'NOTA_DEBITO' };

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  BORRADOR: 'Borrador',
  FIRMADO: 'Firmada',
  RECIBIDO: 'Recibida',
  PPR: 'En proceso',
  AUT: 'Autorizada',
  NAT: 'No autorizada',
  DEVUELTO: 'Devuelta',
};

const STATUS_CLASS: Record<InvoiceStatus, string> = {
  BORRADOR: 'bg-surface-hover text-text-muted',
  FIRMADO: 'bg-primary-soft text-primary',
  RECIBIDO: 'bg-primary-soft text-primary',
  PPR: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  AUT: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  NAT: 'bg-red-500/10 text-red-700 dark:text-red-300',
  DEVUELTO: 'bg-red-500/10 text-red-700 dark:text-red-300',
};

/** Estados propios de los recibos. */
const RECEIPT_STATUS_LABEL: Record<string, string> = { EMITIDO: 'Emitido', ANULADO: 'Anulado' };
const RECEIPT_STATUS_CLASS: Record<string, string> = {
  EMITIDO: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  ANULADO: 'bg-red-500/10 text-red-700 dark:text-red-300',
};

const isReceipt = (k: DocKind) => k === 'RECIBO' || k === 'RETORNO';

/** Mismo mapeo para la carga HTTP y para el evento en vivo. */
const toInvoiceItem = (d: any): DocItem => ({
  id: d.id,
  kind: SRI_KIND[d.documentTypeCode] ?? 'FACTURA',
  number: `${d.series.slice(0, 3)}-${d.series.slice(3)}-${d.sequence}`,
  buyerName: d.buyerName,
  buyerIdNumber: d.buyerIdNumber ?? '',
  issueDate: d.issueDate,
  createdAt: String(d.createdAt),
  total: d.total,
  statusCode: d.statusCode,
  errorMessage: d.lastErrorMessage ?? null,
});

const toReceiptItem = (d: any): DocItem => ({
  id: d.id,
  kind: d.kind === 'RETORNO' ? 'RETORNO' : 'RECIBO',
  number: d.number,
  buyerName: d.buyerName,
  buyerIdNumber: d.buyerIdNumber ?? '',
  issueDate: d.issueDate,
  createdAt: String(d.createdAt),
  total: d.total,
  statusCode: d.statusCode,
  errorMessage: null,
});

@Component({
  selector: 'app-invoice-list',
  imports: [RouterLink],
  templateUrl: './invoice-list.html',
  styleUrl: './invoice-list.css',
})
export class InvoiceList {
  private readonly api = inject(InvoicesService);
  private readonly sales = inject(SalesService);
  private readonly realtime = inject(RealtimeService);

  readonly all = signal<DocItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly filter = signal<DocKind | 'ALL'>('ALL');
  private readonly reloadTick = signal(0);
  private wasConnected = false;

  readonly items = computed(() => {
    const f = this.filter();
    return f === 'ALL' ? this.all() : this.all().filter((d) => d.kind === f);
  });

  /** "Todos" + solo los tipos que tienen documentos. */
  readonly chips = computed(() => {
    const counts = new Map<DocKind, number>();
    for (const d of this.all()) counts.set(d.kind, (counts.get(d.kind) ?? 0) + 1);
    return [
      { key: 'ALL' as const, label: 'Todos', count: this.all().length },
      ...[...counts].map(([key, count]) => ({ key, label: KIND_PLURAL[key], count })),
    ];
  });

  constructor() {
    toObservable(this.reloadTick)
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(() => {
          let failed = 0;
          const onFail = () => {
            failed++;
            return of({ items: [] as any[] });
          };
          return forkJoin([
            this.api.list().pipe(catchError(onFail)),
            this.sales.listReceipts().pipe(catchError(onFail)),
          ]).pipe(tap(() => this.setError(failed)));
        }),
        takeUntilDestroyed(),
      )
      .subscribe(([inv, rec]) => {
        const fromInvoices = (inv.items ?? []).map(toInvoiceItem);
        const fromReceipts = (rec.items ?? []).map(toReceiptItem);
        this.all.set(
          [...fromInvoices, ...fromReceipts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        );
        this.loading.set(false);
      });

    // ── Tiempo real ──
    this.realtime
      .on<any>('invoice.updated')
      .pipe(takeUntilDestroyed())
      .subscribe((d) => this.upsert(toInvoiceItem(d)));

    this.realtime
      .on<any>('receipt.updated')
      .pipe(takeUntilDestroyed())
      .subscribe((d) => this.upsert(toReceiptItem(d)));

    // Al reconectar, recarga para recuperar lo que pasó mientras estuvo caído.
    effect(() => {
      const up = this.realtime.connected();
      if (up && this.wasConnected) untracked(() => this.reload());
      if (up) this.wasConnected = true;
    });
  }

  /** Reemplaza la fila si existe (mismo kind + id) o la agrega arriba. */
  private upsert(item: DocItem) {
    this.all.update((list) => {
      const i = list.findIndex((x) => x.kind === item.kind && x.id === item.id);
      const next = i >= 0 ? list.map((x, j) => (j === i ? item : x)) : [...list, item];
      return next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  }

  private setError(failed: number) {
    this.error.set(
      failed === 0
        ? null
        : failed === 2
          ? 'No se pudieron cargar los documentos.'
          : 'Algunos documentos no se pudieron cargar.',
    );
  }

  reload() {
    this.reloadTick.update((n) => n + 1);
  }

  kindLabel(d: DocItem): string {
    return KIND_LABEL[d.kind];
  }

  kindClass(d: DocItem): string {
    return isReceipt(d.kind)
      ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
      : 'bg-violet-500/10 text-violet-700 dark:text-violet-300';
  }

  statusLabel(d: DocItem): string {
    if (isReceipt(d.kind)) return RECEIPT_STATUS_LABEL[d.statusCode] ?? d.statusCode;
    return STATUS_LABEL[d.statusCode as InvoiceStatus] ?? d.statusCode;
  }

  statusClass(d: DocItem): string {
    if (isReceipt(d.kind)) return RECEIPT_STATUS_CLASS[d.statusCode] ?? STATUS_CLASS.BORRADOR;
    return STATUS_CLASS[d.statusCode as InvoiceStatus] ?? STATUS_CLASS.BORRADOR;
  }

  /** AAAA-MM-DD → DD/MM/AAAA, cortando el string (sin pasar por Date). */
  date(iso: string): string {
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
}