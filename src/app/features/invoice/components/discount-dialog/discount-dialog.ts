import { Component, inject, signal } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DiscountsService } from '../../services/discounts.service';
import { CreateDiscountRequest, DiscountOption } from '../../types/invoice.type';

@Component({
  selector: 'app-discount-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './discount-dialog.html',
})
export class DiscountDialog {
  protected readonly ref = inject<DialogRef<DiscountOption>>(DialogRef);
  private readonly api = inject(DiscountsService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.pattern(/\S/)]],
    valueKind: ['AMOUNT' as CreateDiscountRequest['valueKind']],
    value: [0, [Validators.required, Validators.min(0.01)]],
  });

  save() {
    if (this.saving()) return;
    const v = this.form.getRawValue();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Completa el nombre y un valor mayor a cero.');
      return;
    }
    if (v.valueKind === 'PERCENT' && v.value > 100) {
      this.error.set('El porcentaje no puede superar 100.');
      return;
    }

    this.error.set(null);
    this.saving.set(true);

  this.api
    .create({ ...v, type: 'NORMAL', name: v.name.trim(), value: Number(v.value) })
    .subscribe({
      next: (d) => this.ref.close(d),
      error: (err) => {
        const msg = err?.error?.message;
        this.error.set((Array.isArray(msg) ? msg.join(', ') : msg) ?? 'No se pudo crear el descuento.');
        this.saving.set(false);
      },
    });
  }
}