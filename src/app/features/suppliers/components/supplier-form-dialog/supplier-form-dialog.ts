import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SuppliersService } from '../../services/suppliers.service';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  CreateSupplierRequest,
  IdentificationType,
  Supplier,
  SupplierFormDialogData,
  SupplierNewDataResponse,
} from '../../types/supplier.types';

@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-supplier-form-dialog',
  styleUrl: './supplier-form-dialog.css',
  templateUrl: './supplier-form-dialog.html',
})
export class SupplierFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(SuppliersService);
  private readonly dialogRef = inject(DialogRef<Supplier>);
  private readonly input = inject<SupplierFormDialogData | null>(DIALOG_DATA, { optional: true });

  readonly draftSource = this.input?.draft?.source ?? null;

  readonly data = signal<SupplierNewDataResponse | null>(null);
  readonly loadingData = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  // `\S` exige al menos un carácter que no sea espacio (el backend recorta los textos)
  readonly form = this.fb.nonNullable.group({
    identificationType: ['', Validators.required],
    identificationNumber: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(50)]],
    businessName: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)]],
    tradeName: ['', Validators.maxLength(200)],
    countryId: ['', Validators.required],
    address: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(255)]],
    phone: ['', Validators.maxLength(30)],
    email: ['', [Validators.email, Validators.maxLength(150)]],
  });

  constructor() {
    this.applyDraft();

    if (this.input?.formData) {
      this.data.set(this.input.formData);
      this.loadingData.set(false);
    } else {
      this.loadData();
    }
  }

  private applyDraft() {
    const d = this.input?.draft;
    if (!d) return;

    this.form.patchValue({
      identificationType: d.identificationType,
      identificationNumber: d.identificationNumber ?? '',
      businessName: d.businessName ?? '',
      tradeName: d.tradeName ?? '',
      countryId: d.countryId ?? '',
      address: d.address ?? '',
      phone: d.phone ?? '',
      email: d.email ?? '',
    });
  }

  loadData() {
    this.loadingData.set(true);
    this.error.set(null);

    this.service.getNewData().subscribe({
      next: d => {
        this.data.set(d);
        this.loadingData.set(false);
      },
      error: err => {
        this.loadingData.set(false);
        this.error.set(this.message(err, 'No se pudieron cargar los datos iniciales'));
      },
    });
  }

  submit() {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const body: CreateSupplierRequest = {
      identificationType: v.identificationType as IdentificationType,
      identificationNumber: v.identificationNumber.trim(),
      businessName: v.businessName.trim(),
      tradeName: v.tradeName.trim() || undefined,
      countryId: v.countryId,
      address: v.address.trim(),
      phone: v.phone.trim() || undefined,
      email: v.email.trim() || undefined,
    };

    this.saving.set(true);
    this.error.set(null);

    this.service.create(body).subscribe({
      next: supplier => this.dialogRef.close(supplier),
      error: err => {
        this.saving.set(false);
        this.error.set(this.message(err, 'No se pudo guardar el proveedor'));
      },
    });
  }

  close() {
    this.dialogRef.close();
  }

  private message(err: unknown, fallback: string): string {
    const e = err as { status?: number; error?: { message?: string | string[] } };
    if (e.status === 0) return 'No se pudo conectar con el servidor';
    const msg = e.error?.message;
    return Array.isArray(msg) ? msg.join(', ') : (msg ?? fallback);
  }
}