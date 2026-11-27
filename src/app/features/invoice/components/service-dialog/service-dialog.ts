import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, startWith } from 'rxjs';
import { ServicesCatalogService } from '../../services/services-catalogs.service';
import { BillingService, ServiceType } from '../../types/billing-service.type';

export interface ServiceDialogData {
  types: ServiceType[];
  service?: BillingService;
  /** Solo el admin puede crear tipos nuevos. */
  canCreateType?: boolean;
}

const VAT = 1.15;
const round2 = (v: number) => Math.round(v * 100) / 100;
const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

@Component({
  selector: 'app-service-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './service-dialog.html',
})
export class ServiceDialog {
  protected readonly ref = inject<DialogRef<BillingService | boolean>>(DialogRef);
  protected readonly data = inject<ServiceDialogData>(DIALOG_DATA);
  private readonly api = inject(ServicesCatalogService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly canCreateType = this.data.canCreateType === true;
  readonly types = signal(this.data.types.filter((t) => t.isActive));
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  private typeCreated = false;

  readonly form = this.fb.group({
    serviceTypeId: [this.data.service?.serviceTypeId ?? '', Validators.required],
    name: [this.data.service?.name ?? '', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(160)]],
    description: [this.data.service?.description ?? '', Validators.maxLength(500)],
    /** Lo que escribe el usuario: precio CON IVA. Se guarda dividido para 1.15. */
    price: [this.initialPrice(), [Validators.required, Validators.min(0.01)]],
  });

  private readonly value = toSignal(
    this.form.valueChanges.pipe(startWith(null), map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  /** Subtotal (sin IVA) que se guardará. */
  readonly subtotal = () => this.toSubtotal(Number(this.value().price));

  private initialPrice(): number {
    const s = this.data.service;
    return s ? round2(Number(s.subtotal) * VAT) : 0;
  }

  private toSubtotal(price: number): number {
    return Number.isFinite(price) ? round6(price / VAT) : 0;
  }

  addType(input: HTMLInputElement) {
    if (!this.canCreateType) return;
    const name = input.value.trim();
    if (!name) return;
    this.api.createType(name).subscribe({
      next: (t) => {
        this.typeCreated = true;
        this.types.update((list) => [...list, t]);
        this.form.controls.serviceTypeId.setValue(t.id);
        input.value = '';
      },
      error: (err) => this.fail(err, 'No se pudo crear el tipo.'),
    });
  }

  cancel() {
    this.ref.close(this.typeCreated);
  }

  save() {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Completa tipo, nombre y un precio mayor a cero.');
      return;
    }
    const v = this.form.getRawValue();
    const body = {
      serviceTypeId: v.serviceTypeId,
      name: v.name.trim(),
      description: v.description.trim(),
      subtotal: this.toSubtotal(Number(v.price)).toFixed(6),
    };
    this.error.set(null);
    this.saving.set(true);

    // Al crear no se envía el código: lo genera el servidor.
    const request$ = this.data.service
      ? this.api.update(this.data.service.id, body)
      : this.api.create(body);

    request$.subscribe({
      next: (saved) => this.ref.close(saved),
      error: (err) => {
        this.fail(err, 'No se pudo guardar el servicio.');
        this.saving.set(false);
      },
    });
  }

  private fail(err: any, fallback: string) {
    const msg = err?.error?.message;
    this.error.set((Array.isArray(msg) ? msg.join(', ') : msg) ?? fallback);
  }
}