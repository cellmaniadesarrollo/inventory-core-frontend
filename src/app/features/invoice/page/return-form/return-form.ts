import { Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SalesService } from '../../services/sales.service';
import { ReceiptDetail, ReceiptListItem } from '../../types/sale-product.type';

const EPS = 0.0000005;
const today = () => new Date().toLocaleDateString('en-CA');

@Component({
  selector: 'app-return-form',
  imports: [ReactiveFormsModule],
  templateUrl: './return-form.html',
})
export class ReturnForm {
  private readonly api = inject(SalesService);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly fb = inject(FormBuilder);

  readonly receipt = signal<ReceiptDetail | null>(null);
  readonly candidates = signal<ReceiptListItem[]>([]);
  readonly loading = signal(true);
  readonly loadingReceipt = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly done = signal<{ number: string } | null>(null);
  readonly query = signal('');

  /** Se mantiene si el usuario reintenta; cambia al cambiar de recibo. */
  private requestId = crypto.randomUUID();

  readonly form = this.fb.nonNullable.group({
    issueDate: [today(), [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]],
  });

  readonly lines = new FormArray<FormGroup>([]);

  readonly canReturn = computed(() => this.receipt()?.statusCode === 'EMITIDO');
  readonly hasPending = computed(() =>
    (this.receipt()?.lines ?? []).some((l) => Number(l.pendingQuantity) > EPS),
  );

  private norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  /** Coincidencias por nombre, cédula o número de recibo (mínimo 2 caracteres). */
  readonly results = computed(() => {
    const q = this.norm(this.query().trim());
    if (q.length < 2) return [];
    return this.candidates()
      .filter(
        (c) =>
          this.norm(c.buyerName).includes(q) ||
          (c.buyerIdNumber ?? '').includes(q) ||
          this.norm(c.number).includes(q),
      )
      .slice(0, 8);
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    this.api.listReceipts().subscribe({
      next: (res) => {
        this.candidates.set(
          (res.items ?? []).filter((r) => r.kind === 'RECIBO' && r.statusCode === 'EMITIDO'),
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

  clearReceipt() {
    this.receipt.set(null);
    this.lines.clear();
    this.query.set('');
    this.error.set(null);
  }

  select(id: string) {
    if (!id) return;
    this.query.set('');
    this.loadingReceipt.set(true);
    this.error.set(null);
    this.api.getReceipt(id).subscribe({
      next: (r) => {
        this.receipt.set(r);
        this.requestId = crypto.randomUUID();
        this.lines.clear();
        r.lines.forEach((l) =>
          this.lines.push(this.lineGroup(l.id, Number(l.pendingQuantity ?? l.quantity))),
        );
        this.loadingReceipt.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el recibo.');
        this.loadingReceipt.set(false);
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
    if (pending <= EPS) g.controls.quantity.disable();
    return g;
  }

  pending(i: number): number {
    return Number(this.receipt()?.lines[i]?.pendingQuantity ?? 0);
  }

  setAll(all: boolean) {
    this.lines.controls.forEach((g, i) => {
      if (this.pending(i) > EPS) g.patchValue({ quantity: all ? this.pending(i) : 0 });
    });
  }

  /** Aproximado, sin IVA (el recibo no lo desglosa). El backend recalcula. */
  get estimate() {
    const r = this.receipt();
    if (!r) return null;
    let total = 0;
    this.lines.getRawValue().forEach((g, i) => {
      const l = r.lines[i];
      const qty = Number(g['quantity']) || 0;
      if (qty <= 0) return;
      const disc = (Number(l.discount) * qty) / Number(l.quantity);
      total += Math.max(0, qty * Number(l.unitPrice) - disc);
    });
    return total;
  }

  submit() {
    const r = this.receipt();
    if (!r || this.saving()) return;

    if (this.form.invalid || this.lines.invalid) {
      this.form.markAllAsTouched();
      this.lines.markAllAsTouched();
      return;
    }

    const picks = this.lines
      .getRawValue()
      .map((g) => ({ sourceLineId: g['sourceLineId'] as string, quantity: Number(g['quantity']) }))
      .filter((p) => p.quantity > 0);

    if (!picks.length) {
      this.error.set('Indica al menos una cantidad a devolver.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.api
      .createReturn({
        clientRequestId: this.requestId,
        relatedReceiptId: r.id,
        issueDate: this.form.getRawValue().issueDate,
        lines: picks,
      })
      .subscribe({
        next: (ret) => {
          this.saving.set(false);
          this.done.set({ number: ret.number });
        },
        error: (e) => {
          this.saving.set(false);
          const msg = e?.error?.message;
          this.error.set(
            e?.status === 403
              ? 'No tienes permisos para registrar retornos.'
              : Array.isArray(msg) ? msg.join(' ') : (msg ?? 'No se pudo registrar el retorno.'),
          );
        },
      });
  }

  cancel() {
    this.location.back();
  }
}