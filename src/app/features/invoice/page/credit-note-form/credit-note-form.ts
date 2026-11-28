import { Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { InvoicesService } from '../../services/invoice.service';
import { Invoice, InvoiceDetail, VatRateOption } from '../../types/invoice.type';

const EPS = 0.0000005;
const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD en hora local

@Component({
  selector: 'app-credit-note-form',
  imports: [ReactiveFormsModule],
  templateUrl: './credit-note-form.html',
})
export class CreditNoteForm {
  private readonly api = inject(InvoicesService);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly fb = inject(FormBuilder);

  readonly invoice = signal<InvoiceDetail | null>(null);
  readonly candidates = signal<Invoice[]>([]);
  readonly rates = signal<VatRateOption[]>([]);
  readonly loading = signal(true);
  readonly loadingInvoice = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly done = signal<{ number: string; status: string } | null>(null);
  readonly query = signal('');

  /** Se mantiene si el usuario reintenta; cambia al cambiar de factura. */
  private requestId = crypto.randomUUID();

  readonly form = this.fb.nonNullable.group({
    issueDate: [today(), [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]],
    reason: ['', [Validators.required, Validators.maxLength(300)]],
  });

  readonly lines = new FormArray<FormGroup>([]);

  readonly number = computed(() => {
    const i = this.invoice();
    return i ? `${i.series.slice(0, 3)}-${i.series.slice(3)}-${i.sequence}` : '';
  });

  readonly canCredit = computed(() => this.invoice()?.statusCode === 'AUT');
  readonly hasPending = computed(() =>
    (this.invoice()?.lines ?? []).some((l) => Number(l.pendingQuantity) > EPS),
  );

  private norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  numberOf(c: Invoice): string {
    return `${c.series.slice(0, 3)}-${c.series.slice(3)}-${c.sequence}`;
  }

  /** Coincidencias por nombre, cédula/RUC o número de factura (mínimo 2 caracteres). */
  readonly results = computed(() => {
    const q = this.norm(this.query().trim());
    if (q.length < 2) return [];
    return this.candidates()
      .filter(
        (c) =>
          this.norm(c.buyerName).includes(q) ||
          (c.buyerIdNumber ?? '').includes(q) ||
          this.numberOf(c).includes(q),
      )
      .slice(0, 8);
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    forkJoin([this.api.vatRates(), this.api.list()]).subscribe({
      next: ([vat, list]) => {
        this.rates.set(vat.items);
        this.candidates.set(
          list.items.filter((d) => d.documentTypeCode === '01' && d.statusCode === 'AUT'),
        );
        this.loading.set(false);
        if (id) this.select(id);
      },
      error: () => {
        this.error.set('No se pudo cargar la información.');
        this.loading.set(false);
      },
    });
  }

  onSearch(e: Event) {
    this.query.set((e.target as HTMLInputElement).value);
  }

  /** Quita la factura elegida para buscar otra. */
  clearInvoice() {
    this.invoice.set(null);
    this.lines.clear();
    this.query.set('');
    this.error.set(null);
  }

  select(id: string) {
    if (!id) return;
    this.query.set('');
    this.loadingInvoice.set(true);
    this.error.set(null);
    this.api.get(id).subscribe({
      next: (inv) => {
        this.invoice.set(inv);
        this.requestId = crypto.randomUUID();
        this.lines.clear();
        inv.lines.forEach((l) =>
          this.lines.push(this.lineGroup(l.id, Number(l.pendingQuantity ?? l.quantity))),
        );
        this.loadingInvoice.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la factura.');
        this.loadingInvoice.set(false);
      },
    });
  }

  private lineGroup(sourceLineId: string, pending: number): FormGroup {
    const g = this.fb.nonNullable.group({
      sourceLineId: [sourceLineId],
      quantity: [
        pending > EPS ? pending : 0,
        [Validators.required, Validators.min(0), Validators.max(Math.max(pending, 0))],
      ],
    });
    // Línea ya devuelta por completo: no se puede editar
    if (pending <= EPS) g.controls.quantity.disable();
    return g;
  }

  pending(i: number): number {
    return Number(this.invoice()?.lines[i]?.pendingQuantity ?? 0);
  }

  /** Devolver todo lo pendiente / nada. */
  setAll(all: boolean) {
    this.lines.controls.forEach((g, i) => {
      if (this.pending(i) > EPS) g.patchValue({ quantity: all ? this.pending(i) : 0 });
    });
  }

  /** Aproximado: el backend recalcula con su propia función. */
  get estimate() {
    const inv = this.invoice();
    if (!inv) return null;
    let subtotal = 0;
    let vat = 0;
    this.lines.getRawValue().forEach((g, i) => {
      const l = inv.lines[i];
      const qty = Number(g['quantity']) || 0;
      if (qty <= 0) return;
      const disc = (Number(l.discount) * qty) / Number(l.quantity);
      const base = Math.max(0, qty * Number(l.unitPrice) - disc);
      const pct = this.rates().find((r) => r.code === l.vatRateCode)?.percentage ?? 0;
      subtotal += base;
      vat += (base * pct) / 100;
    });
    return { subtotal, vat, total: subtotal + vat };
  }

  submit() {
    const inv = this.invoice();
    if (!inv || this.saving()) return;

    const picks = this.lines
      .getRawValue()
      .map((g) => ({ sourceLineId: g['sourceLineId'] as string, quantity: Number(g['quantity']) }))
      .filter((p) => p.quantity > 0);

    if (this.form.invalid || this.lines.invalid) {
      this.form.markAllAsTouched();
      this.lines.markAllAsTouched();
      return;
    }
    if (!picks.length) {
      this.error.set('Indica al menos una cantidad a devolver.');
      return;
    }

    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);

    this.api
      .createCreditNote({
        clientRequestId: this.requestId,
        modifiedDocumentId: inv.id,
        issueDate: v.issueDate,
        reason: v.reason.trim(),
        lines: picks,
        // returnStock: v.returnStock || undefined,
      })
      .subscribe({
        next: (nc) => {
          this.saving.set(false);
          this.done.set({
            number: `${nc.series.slice(0, 3)}-${nc.series.slice(3)}-${nc.sequence}`,
            status: nc.statusCode,
          });
        },
        error: (e) => {
          this.saving.set(false);
          const msg = e?.error?.message;
          this.error.set(
            e?.status === 403
              ? 'No tienes permisos para emitir notas de crédito.'
              : Array.isArray(msg) ? msg.join(' ') : (msg ?? 'No se pudo emitir la nota de crédito.'),
          );
        },
      });
  }

  cancel() {
    this.location.back();
  }
}