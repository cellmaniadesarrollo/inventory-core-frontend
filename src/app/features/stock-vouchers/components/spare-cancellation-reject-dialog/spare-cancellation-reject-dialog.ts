import { Component, inject, signal } from '@angular/core';
import { SpareCancellationsService } from '../../services/spare-cancellations.service';
import { SpareCancellationRejectDialogData, SpareCancellationRejectResult } from '../../types/spare-cancellation.types';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
const MIN = 3;
const MAX = 500;
@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-spare-cancellation-reject-dialog',
  styleUrl: './spare-cancellation-reject-dialog.css',
  templateUrl: './spare-cancellation-reject-dialog.html',
})
export class SpareCancellationRejectDialog {
  private readonly api = inject(SpareCancellationsService);
  private readonly dialogRef = inject<DialogRef<SpareCancellationRejectResult>>(DialogRef);
  readonly data = inject<SpareCancellationRejectDialogData>(DIALOG_DATA);

  readonly min = MIN;
  readonly max = MAX;
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly reason = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/\S/)],
  });
  /** FormControl no notifica a la vista (zoneless): el contador sale de este signal */
  readonly text = toSignal(this.reason.valueChanges, { initialValue: '' });

  /** Devuelve el mensaje de error o null si todo está bien */
  private validate(): string | null {
    const len = this.reason.value.trim().length;
    if (len < MIN) return `Escribe el motivo del rechazo (mínimo ${MIN} caracteres).`;
    if (len > MAX) return `El motivo no puede superar los ${MAX} caracteres.`;
    return null;
  }

  submit() {
    if (this.saving()) return;
    const invalid = this.validate();
    if (invalid) { this.error.set(invalid); return; }

    this.saving.set(true);
    this.error.set(null);

    this.api.reject(this.data.item.id, this.reason.value).subscribe({
      next: res => this.dialogRef.close({ kind: 'rejected', replayed: res.replayed }), // replayed: éxito
      error: err => {
        this.saving.set(false);
        const msg = err?.error?.message;
        const text = Array.isArray(msg) ? msg.join(', ') : (msg ?? 'No se pudo rechazar la solicitud.');
        if (err?.status === 409) {
          // la fila ya cambió de estado: se cierra y el listado muestra el mensaje y recarga
          this.dialogRef.close({ kind: 'conflict', message: text });
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
