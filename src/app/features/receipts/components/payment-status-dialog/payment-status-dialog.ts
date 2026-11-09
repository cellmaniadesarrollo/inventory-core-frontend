import { Component, inject, signal } from '@angular/core';
import { LabeledOption, PaymentMethod, RegisterPaymentResponse } from '../../types/receipt.types';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ReceiptsService } from '../../services/receipts.service';
import { ImageUpload } from '../../../../shared/components/image-upload/image-upload';

export interface PaymentDialogData {
  id: string;
  code: number;
  total: string;
  paidTotal: string;
  balance: string;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

@Component({
  imports: [ImageUpload],
  selector: 'app-payment-status-dialog',
  styleUrl: './payment-status-dialog.css',
  templateUrl: './payment-status-dialog.html',
})
export class PaymentStatusDialog {
  private readonly api = inject(ReceiptsService);
  private readonly dialogRef = inject(DialogRef<RegisterPaymentResponse>);
  readonly data = inject<PaymentDialogData>(DIALOG_DATA);

  /** Se genera al abrir y se reutiliza en cualquier reintento */
  private readonly clientRequestId = crypto.randomUUID();

  readonly methods = signal<LabeledOption<PaymentMethod>[]>([]);
  readonly maxDate = today();
  readonly proofAccept = 'image/jpeg,image/png,image/webp,application/pdf';

  readonly amount = signal(this.data.balance);
  readonly paidAt = signal(today());
  readonly method = signal<PaymentMethod | ''>('');
  readonly reference = signal('');
  readonly note = signal('');
  readonly proofFiles = signal<File[]>([]);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly loadingMethods = signal(true);

  constructor() {
    this.api.getNewData().subscribe({
      next: d => {
        const list = d.paymentMethods ?? [];
        this.methods.set(list);
        // Preseleccionar el primero si existe
        if (list.length && !this.method()) {
          this.method.set(list[0].value);
        }
        this.loadingMethods.set(false);
      },
      error: () => {
        // Fallback mínimo por si falla el endpoint
        this.methods.set([
          { value: 'CASH', label: 'Efectivo' },
          { value: 'TRANSFER', label: 'Transferencia' },
          { value: 'CHECK', label: 'Cheque' },
          { value: 'CARD', label: 'Tarjeta' },
          { value: 'OTHER', label: 'Otro' },
        ]);
        this.method.set('TRANSFER');
        this.loadingMethods.set(false);
      },
    });
  }

  save() {
    if (this.saving()) return;
    const err = this.validate();
    this.error.set(err);
    if (err) return;

    const reference = this.reference().trim();
    const note = this.note().trim();

    this.saving.set(true);
    this.api
      .registerPayment(
        this.data.id,
        {
          clientRequestId: this.clientRequestId,
          amount: Number(this.amount()),
          paidAt: this.paidAt(),
          method: this.method() as PaymentMethod,
          ...(reference ? { reference } : {}),
          ...(note ? { note } : {}),
        },
        this.proofFiles()[0] ?? null,
      )
      .subscribe({
        next: r => this.dialogRef.close(r),
        error: err => {
          this.saving.set(false);
          this.error.set(this.message(err));
        },
      });
  }

  cancel() {
    this.dialogRef.close();
  }

  private validate(): string | null {
    const raw = String(this.amount()).trim();
    const n = Number(raw);
    if (!raw || !Number.isFinite(n) || n <= 0) return 'Ingresa un monto mayor a 0';
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) return 'El monto admite hasta 2 decimales';
    if (!this.paidAt()) return 'Ingresa la fecha del pago';
    if (this.paidAt() > this.maxDate) return 'La fecha del pago no puede ser futura';
    if (!this.method()) return 'Selecciona el método de pago';
    if (this.reference().length > 100) return 'La referencia admite máximo 100 caracteres';
    if (this.note().length > 500) return 'La nota admite máximo 500 caracteres';
    return null;
  }

  private message(err: unknown): string {
    const e = err as { status?: number; error?: { message?: string | string[] } };
    if (e.status === 0) return 'No se pudo conectar con el servidor';
    const msg = e.error?.message;
    const text = Array.isArray(msg) ? msg.join(', ') : msg;
    if (e.status === 404) return 'El ingreso no existe';
    return text ?? 'No se pudo registrar el pago';
  }
}