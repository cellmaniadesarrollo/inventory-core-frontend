import { Component, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { InvoicesService } from '../../services/invoice.service';
import { InvoiceDetail, InvoiceDetailLine, VatRateOption } from '../../types/invoice.type';

const ID_TYPES = [
  { code: '04', label: 'RUC' },
  { code: '05', label: 'Cédula' },
  { code: '06', label: 'Pasaporte' },
  { code: '07', label: 'Consumidor final' },
  { code: '08', label: 'Identificación del exterior' },
];

@Component({
  selector: 'app-invoice-fix',
  imports: [ReactiveFormsModule],
  templateUrl: './invoice-fix.html',
})
export class InvoiceFix {
  private readonly api = inject(InvoicesService);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly fb = inject(FormBuilder);
  private readonly id = this.route.snapshot.paramMap.get('id')!;

  readonly idTypes = ID_TYPES;
  readonly invoice = signal<InvoiceDetail | null>(null);
  readonly rates = signal<VatRateOption[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    buyerIdTypeCode: ['', [Validators.required, Validators.maxLength(2)]],
    buyerIdNumber: ['', [Validators.required, Validators.maxLength(20)]],
    buyerName: ['', [Validators.required, Validators.maxLength(300)]],
    buyerAddress: ['', [Validators.maxLength(300)]],
    buyerEmail: ['', [Validators.email]],
  });

  readonly lines = new FormArray<FormGroup>([]);

  constructor() {
    forkJoin([this.api.get(this.id), this.api.vatRates()]).subscribe({
      next: ([inv, vat]) => {
        this.invoice.set(inv);
        this.rates.set(vat.items);
        this.form.patchValue({
          buyerIdTypeCode: inv.buyerIdTypeCode ?? '',
          buyerIdNumber: inv.buyerIdNumber ?? '',
          buyerName: inv.buyerName ?? '',
          buyerAddress: inv.buyerAddress ?? '',
          buyerEmail: inv.buyerEmail ?? '',
        });
        inv.lines.forEach((l) => this.lines.push(this.lineGroup(l)));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la factura.');
        this.loading.set(false);
      },
    });
  }

  private lineGroup(l: InvoiceDetailLine): FormGroup {
    return this.fb.nonNullable.group({
      id: [l.id],
      mainCode: [l.mainCode, [Validators.required, Validators.maxLength(25)]],
      description: [l.description, [Validators.required, Validators.maxLength(300)]],
      unitPrice: [+l.unitPrice, [Validators.required, Validators.min(0)]],
      vatRateCode: [l.vatRateCode ?? '', [Validators.required]],
    });
  }

  get number(): string {
    const i = this.invoice();
    return i ? `${i.series.slice(0, 3)}-${i.series.slice(3)}-${i.sequence}` : '';
  }

  get canCorrect(): boolean {
    return ['DEVUELTO', 'NAT'].includes(this.invoice()?.statusCode ?? '');
  }

  /** Cálculo aproximado para mostrar; el backend recalcula con su propia función. */
  get estimate() {
    const inv = this.invoice();
    if (!inv) return null;
    let subtotal = 0;
    let vat = 0;
    this.lines.getRawValue().forEach((g, i) => {
      const l = inv.lines[i];
      const base = Math.max(0, +l.quantity * (+g['unitPrice'] || 0) - +l.discount);
      const pct = this.rates().find((r) => r.code === g['vatRateCode'])?.percentage ?? 0;
      subtotal += base;
      vat += (base * pct) / 100;
    });
    return { subtotal, vat, total: subtotal + vat };
  }

  submit() {
    if (this.form.invalid || this.lines.invalid || this.saving()) {
      this.form.markAllAsTouched();
      this.lines.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);

    this.api
      .correct(this.id, {
        buyerIdTypeCode: v.buyerIdTypeCode,
        buyerIdNumber: v.buyerIdNumber.trim(),
        buyerName: v.buyerName.trim(),
        buyerAddress: v.buyerAddress.trim() || undefined,
        buyerEmail: v.buyerEmail.trim() || undefined,
        lines: this.lines.getRawValue().map((g) => ({
          id: g['id'],
          mainCode: String(g['mainCode']).trim(),
          description: String(g['description']).trim(),
          unitPrice: Number(g['unitPrice']),
          vatRateCode: g['vatRateCode'],
        })),
      })
      .subscribe({
        next: () => this.location.back(),
        error: (e) => {
          this.saving.set(false);
          const msg = e?.error?.message;
          this.error.set(
            e?.status === 403
              ? 'No tienes permisos para corregir facturas.'
              : Array.isArray(msg) ? msg.join(' ') : (msg ?? 'No se pudo reenviar la factura.'),
          );
        },
      });
  }

  cancel() {
    this.location.back();
  }
}