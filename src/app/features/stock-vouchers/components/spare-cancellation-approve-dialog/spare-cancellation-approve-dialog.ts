import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ApproveCancellationRequest, SpareCancellationApproveDialogData, SpareCancellationApproveResult } from '../../types/spare-cancellation.types';
import { SpareCancellationsService } from '../../services/spare-cancellations.service';
import { StockVouchersService } from '../../services/stock-vouchers.service';
import { StockVoucherNewDataResponse } from '../../types/stock-voucher.types';

@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-spare-cancellation-approve-dialog',
  styleUrl: './spare-cancellation-approve-dialog.css',
  templateUrl: './spare-cancellation-approve-dialog.html',
})
export class SpareCancellationApproveDialog {
  private readonly dialogRef = inject<DialogRef<SpareCancellationApproveResult>>(DialogRef);
  private readonly cancellations = inject(SpareCancellationsService);
  private readonly vouchers = inject(StockVouchersService);
  readonly data = inject<SpareCancellationApproveDialogData>(DIALOG_DATA);
  readonly item = this.data.item;

  readonly options = signal<StockVoucherNewDataResponse | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly submitted = signal(false);

  readonly reasonId = new FormControl('', { nonNullable: true });
  readonly note = new FormControl('', { nonNullable: true });

  /** Retorno con orden obligatoria: la salida original siempre tiene orden */
  readonly reasons = computed(() =>
    this.options()?.reasons.filter(r => r.direction === 'IN' && r.orderLink === 'REQUIRED') ?? [],
  );

  constructor() {
    this.vouchers.getNewData().subscribe({
      next: d => {
        this.options.set(d);
        const list = d.reasons.filter(r => r.direction === 'IN' && r.orderLink === 'REQUIRED');
        if (list.length === 1) this.reasonId.setValue(list[0].id);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.error.set(this.message(err, 'No se pudieron cargar los motivos'));
      },
    });
  }

  private message(err: unknown, fallback: string): string {
    const e = err as { status?: number; error?: { message?: string | string[] } };
    if (e.status === 0) return 'No se pudo conectar con el servidor';
    const msg = e.error?.message;
    return Array.isArray(msg) ? msg.join(', ') : (msg ?? fallback);
  }

  private validate(): string | null {
    if (!this.reasonId.value) return 'Selecciona el motivo del retorno';
    if (this.note.value.length > 500) return 'La nota admite máximo 500 caracteres';
    return null;
  }

  submit() {
    if (this.saving() || this.loading()) return;
    this.submitted.set(true);
    const invalid = this.validate();
    this.error.set(invalid);
    if (invalid) return;

    const note = this.note.value.trim();
    const body: ApproveCancellationRequest = {
      reasonId: this.reasonId.value,
      ...(note ? { note } : {}),
    };

    this.saving.set(true);
    this.cancellations.approve(this.item.id, body).subscribe({
      next: res => this.dialogRef.close({ kind: 'approved', code: res.code, replayed: res.replayed }), // replayed: éxito
      error: err => {
        this.saving.set(false);
        const text = this.message(err, 'No se pudo aprobar la solicitud');
        if (err?.status === 409) {
          this.dialogRef.close({ kind: 'conflict', message: text }); // la fila ya cambió: el listado recarga
          return;
        }
        this.error.set(text);
      },
    });
  }

  close() {
    if (this.saving()) return;
    this.dialogRef.close();
  }
}
