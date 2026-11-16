import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IssuersService } from '../../services/issuer.service';
import { Issuer, UpdateIssuerRequest } from '../../types/issuer.type';

@Component({
  selector: 'app-issuer-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './issuer-dialog.html',
  styleUrl: './issuer-dialog.css',
})
export class IssuerDialog {
  private readonly dialogRef = inject<DialogRef<Issuer>>(DialogRef);
  private readonly api = inject(IssuersService);
  /** null = crear; con valor = editar. */
  readonly issuer = inject<Issuer | null>(DIALOG_DATA);
  readonly isEdit = this.issuer !== null;

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = inject(NonNullableFormBuilder).group({
    ruc: ['', [Validators.required, Validators.pattern(/^\d{10}001$/)]],
    legalName: [this.issuer?.legalName ?? '', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(300)]],
    tradeName: [this.issuer?.tradeName ?? '', [Validators.maxLength(300)]],
    headquartersAddress: [
      this.issuer?.headquartersAddress ?? '',
      [Validators.required, Validators.pattern(/\S/), Validators.maxLength(300)],
    ],
    specialTaxpayer: [this.issuer?.specialTaxpayer ?? '', [Validators.pattern(/^(\d{3,5})?$/)]],
    accountingRequired: [this.issuer?.accountingRequired ?? false],
    environment: [this.issuer?.environment ?? 1],
    active: [this.issuer?.active ?? true],
  });

  constructor() {
    if (this.isEdit) {
      this.form.controls.ruc.setValue(this.issuer!.ruc);
      this.form.controls.ruc.disable(); // el RUC no se edita
    }
  }

  invalid(key: string): boolean {
    const c = this.form.get(key);
    return !!c && c.invalid && c.touched;
  }

  save() {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisa los campos marcados.');
      return;
    }
    const v = this.form.getRawValue();
    const opt = (s: string) => s.trim() || undefined;

    const request$ = this.isEdit
      ? this.api.update(this.issuer!.id, {
          legalName: v.legalName.trim(),
          tradeName: opt(v.tradeName),
          headquartersAddress: v.headquartersAddress.trim(),
          specialTaxpayer: opt(v.specialTaxpayer),
          accountingRequired: v.accountingRequired,
          environment: Number(v.environment) as 1 | 2,
          active: v.active,
        } satisfies UpdateIssuerRequest)
      : this.api.create({
          ruc: v.ruc.trim(),
          legalName: v.legalName.trim(),
          tradeName: opt(v.tradeName),
          headquartersAddress: v.headquartersAddress.trim(),
          specialTaxpayer: opt(v.specialTaxpayer),
          accountingRequired: v.accountingRequired,
          environment: Number(v.environment) as 1 | 2,
        });

    this.error.set(null);
    this.saving.set(true);
    request$.subscribe({
      next: (res) => this.dialogRef.close(res),
      error: (err) => {
        this.error.set(this.errorMessage(err, 'No se pudo guardar el emisor.'));
        this.saving.set(false);
      },
    });
  }

  close() {
    if (!this.saving()) this.dialogRef.close();
  }

  private errorMessage(err: any, fallback: string): string {
    const msg = err?.error?.message;
    return Array.isArray(msg) ? msg.join(', ') : (msg ?? fallback);
  }
}