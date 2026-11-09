import { Component, computed, inject, signal } from '@angular/core';
import { PaymentMethod, PaymentStatus, ReceiptDetail, ReceiptFile, ReceiptPayment, ReceiptStatus, RegisterPaymentResponse } from '../../types/receipt.types';
import { DatePipe } from '@angular/common';
import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ReceiptsService } from '../../services/receipts.service';
import { ImageLightboxDialog, LightboxData } from '../../../../shared/components/image-lightbox-dialog/image-lightbox-dialog';
import { PaymentDialogData, PaymentStatusDialog } from '../payment-status-dialog/payment-status-dialog';
import { LabelPrintDialog, LabelPrintDialogData } from '../../../../shared/components/label-print-dialog/label-print-dialog';
import { buildLabelItems } from '../../utils/label-items';
type TabId = 'summary' | 'products' | 'payments' | 'history';

const TABS: { id: TabId; label: string }[] = [
  { id: 'summary', label: 'Resumen' },
  { id: 'products', label: 'Productos' },
  { id: 'payments', label: 'Pagos' },
  { id: 'history', label: 'Historial' },
];

const STATUS: Record<ReceiptStatus, { label: string; cls: string }> = {
  REGISTERED: { label: 'Registrado', cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  VERIFIED: { label: 'Verificado', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  VOIDED: { label: 'Anulado', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
};

const PAYMENT: Record<PaymentStatus, { label: string; cls: string }> = {
  UNPAID: { label: 'No pagado', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  PARTIAL: { label: 'Pago parcial', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  PAID: { label: 'Pagado', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo', TRANSFER: 'Transferencia', CHECK: 'Cheque', CARD: 'Tarjeta', OTHER: 'Otro',
};

const UNIT_STATUS: Record<string, { label: string; cls: string }> = {
  AVAILABLE: { label: 'Disponible', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  SOLD: { label: 'Vendido', cls: 'bg-slate-500/15 text-slate-600 dark:text-slate-300' },
  RESERVED: { label: 'Reservado', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
};

const KIND_LABELS: Record<string, string> = { DEVICE: 'Equipo', PART: 'Repuesto', ACCESSORY: 'Accesorio' };
const SOURCE_LABELS: Record<string, string> = { MANUAL: 'Manual', ACCESS_KEY: 'Clave de acceso' };

const ACTION: Record<string, { label: string; dot: string; badge: string }> = {
  CREATED: { label: 'Creado', dot: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  UPDATED: { label: 'Modificado', dot: 'bg-primary', badge: 'bg-primary-soft text-primary' },
  VERIFIED: { label: 'Verificado', dot: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  VOIDED: { label: 'Anulado', dot: 'bg-red-500', badge: 'bg-red-500/15 text-red-600 dark:text-red-400' },
};

const FIELD_LABELS: Record<string, string> = {
  paidTotal: 'Total pagado', paymentStatus: 'Estado de pago', status: 'Estado',
  notes: 'Notas', documentNumber: 'N° de documento', issueDate: 'Fecha de emisión',
};

@Component({
  imports: [DatePipe],
  selector: 'app-receipt-detail-dialog',
  styleUrl: './receipt-detail-dialog.css',
  templateUrl: './receipt-detail-dialog.html',
})
export class ReceiptDetailDialog {
  private readonly api = inject(ReceiptsService);
  private readonly dialogRef = inject(DialogRef<boolean>);
  private readonly dialog = inject(Dialog);
  private readonly input = inject<{ id: string }>(DIALOG_DATA);

  readonly tabs = TABS;
  readonly detail = signal<ReceiptDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly tab = signal<TabId>('summary');

  private changed = false;

  readonly isPdf = (f: ReceiptFile) => f.mimeType === 'application/pdf';
  readonly voided = computed(() => this.detail()?.status === 'VOIDED');

  constructor() {
    this.reload();
  }

  private reload() {
    this.api.getOne(this.input.id).subscribe({
      next: d => {
        this.detail.set(d);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.error.set(this.message(err, 'No se pudo cargar el ingreso'));
      },
    });
  }

  // ===== Textos =====
  statusLabel(s: ReceiptStatus) { return STATUS[s]?.label ?? s; }
  statusClass(s: ReceiptStatus) { return STATUS[s]?.cls ?? ''; }
  paymentLabel(s: PaymentStatus) { return PAYMENT[s]?.label ?? s; }
  paymentClass(s: PaymentStatus) { return PAYMENT[s]?.cls ?? ''; }
  methodLabel(m: PaymentMethod) { return METHOD_LABELS[m] ?? m; }
  unitLabel(s: string) { return UNIT_STATUS[s]?.label ?? s; }
  unitClass(s: string) { return UNIT_STATUS[s]?.cls ?? 'bg-surface-hover text-body'; }
  kindLabel(k: string) { return KIND_LABELS[k] ?? k; }
  sourceLabel(s: string) { return SOURCE_LABELS[s] ?? s; }

  /** Clave de 49 dígitos en grupos de 7, más fácil de leer y comparar */
  fmtKey(k: string) { return k.replace(/(\d{7})(?=\d)/g, '$1 '); }

  /** Copia la clave al portapapeles */
  copyKey(k: string) {
    navigator.clipboard?.writeText(k).then(
      () => this.flash('Clave de acceso copiada'),
      () => this.error.set('No se pudo copiar la clave'),
    );
  }
  actionLabel(a: string) { return ACTION[a]?.label ?? a; }
  actionDot(a: string) { return ACTION[a]?.dot ?? 'bg-primary'; }
  actionBadge(a: string) { return ACTION[a]?.badge ?? 'bg-primary-soft text-primary'; }
  fieldLabel(k: string) { return FIELD_LABELS[k] ?? k; }

  /** AAAA-MM-DD → DD/MM/AAAA, sin pasar por Date (evita desfases de zona horaria) */
  fmtDate(d: string) {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }

  size(bytes: number) {
    return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  changeKeys(e: { changes: Record<string, unknown> | null }) {
    return e.changes ? Object.keys(e.changes) : [];
  }

  formatValue(key: string, v: unknown): string {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    if (key === 'paymentStatus') return PAYMENT[v as PaymentStatus]?.label ?? String(v);
    if (key === 'status') return STATUS[v as ReceiptStatus]?.label ?? String(v);
    return String(v);
  }

  // ===== Acciones =====
  openImages(files: ReceiptFile[], index: number) {
    const images = files.filter(f => !this.isPdf(f));
    const target = files[index];
    const start = Math.max(0, images.indexOf(target));
    if (!images.length) return;
    this.dialog.open<void, LightboxData>(ImageLightboxDialog, {
      data: { images: images.map(i => ({ url: i.url, fileName: i.originalName })), startIndex: start },
      backdropClass: 'bg-black/80',
      panelClass: 'max-w-full',
      autoFocus: false,
    });
  }

  openPayment() {
    const d = this.detail();
    if (!d || !d.payment.canRegisterPayment) return;

    const ref = this.dialog.open<RegisterPaymentResponse, PaymentDialogData>(PaymentStatusDialog, {
      data: { id: d.id, code: d.code, total: d.totals.total, paidTotal: d.payment.paidTotal, balance: d.payment.balance },
      width: '36rem',
      maxWidth: '95vw',
      autoFocus: 'first-tabbable',
      disableClose: true,
    });

    ref.closed.subscribe(res => {
      if (!res) return;
      this.changed = true;
      this.flash(res.replayed ? 'Ese pago ya estaba registrado' : `Pago registrado. Saldo: ${res.receipt.balance}`);
      this.reload(); // refresca pagos, saldo e historial
    });
  }

  close() { this.dialogRef.close(this.changed); }

  private flash(text: string) {
    this.notice.set(text);
    setTimeout(() => this.notice.set(null), 4000);
  }

  private message(err: unknown, fallback: string): string {
    const e = err as { status?: number; error?: { message?: string | string[] } };
    if (e.status === 0) return 'No se pudo conectar con el servidor';
    if (e.status === 404) return 'El ingreso no existe';
    const msg = e.error?.message;
    return Array.isArray(msg) ? msg.join(', ') : (msg ?? fallback);
  }



  // Agrega ReceiptPayment al import de '../../types/receipt.types'

  readonly isImageProof = (p: ReceiptPayment) =>
    p.hasProof && !!p.proofUrl && !!p.proofMime?.startsWith('image/');

  /** Abre el comprobante en el lightbox; permite navegar entre todos los comprobantes de imagen */
  openProof(p: ReceiptPayment) {
    const d = this.detail();
    if (!d) return;
    const proofs = d.payment.items.filter(this.isImageProof);
    const start = proofs.indexOf(p);
    if (start < 0) return;

    this.dialog.open<void, LightboxData>(ImageLightboxDialog, {
      data: {
        images: proofs.map(x => ({ url: x.proofUrl!, fileName: x.proofName ?? 'Comprobante' })),
        startIndex: start,
      },
      backdropClass: 'bg-black/80',
      panelClass: 'max-w-full',
      autoFocus: false,
    });
  }

  /** Líneas con lote: solo esas se pueden etiquetar (las sin inventario tienen lot null) */
  readonly printableLines = computed(() =>
    (this.detail()?.lines ?? []).filter(l => l.affectsInventory && l.lot),
  );


  openLabels() {
    const d = this.detail();
    if (!d || this.voided()) return;
    const items = buildLabelItems(d);
    if (!items.length) return;

    this.dialog.open<void, LabelPrintDialogData>(LabelPrintDialog, {
      data: { items },
      width: '36rem',
      maxWidth: '95vw',
      autoFocus: 'first-tabbable',
      disableClose: true,
    });
  }
}
