import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ImageUpload } from '../../../../shared/components/image-upload/image-upload';
import { StockVouchersService } from '../../services/stock-vouchers.service';
import {
  CreateStockVoucherLine,
  CreateStockVoucherRequest,
  StockVoucherCreated,
  StockVoucherNewDataResponse,
  StockVoucherReturnDialogData,
  VoucherDetailLine,
} from '../../types/stock-voucher.types';

const newReturnLine = (origin: VoucherDetailLine) =>
  new FormGroup({
    origin: new FormControl<VoucherDetailLine>(origin, { nonNullable: true }),
    selected: new FormControl(false, { nonNullable: true }),
    quantity: new FormControl<number | null>(origin.pending ?? null), // por cantidad
    unitIds: new FormControl<string[]>([], { nonNullable: true }),    // seriales
    images: new FormControl<File[]>([], { nonNullable: true }),
    photosOpen: new FormControl(false, { nonNullable: true }),
  });
type ReturnLineGroup = ReturnType<typeof newReturnLine>;

@Component({
  imports: [ReactiveFormsModule, ImageUpload],
  selector: 'app-stock-voucher-return-dialog',
  styleUrl: './stock-voucher-return-dialog.css',
  templateUrl: './stock-voucher-return-dialog.html',
})
export class StockVoucherReturnDialog {
  private readonly dialogRef = inject(DialogRef<StockVoucherCreated>);
  private readonly api = inject(StockVouchersService);
  readonly data = inject<StockVoucherReturnDialogData>(DIALOG_DATA);
  readonly voucher = this.data.voucher;

  /** Una sola vez al abrir; se reutiliza en todo reintento */
  readonly clientRequestId = crypto.randomUUID();

  readonly options = signal<StockVoucherNewDataResponse | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly submitted = signal(false);

  readonly reasonId = new FormControl('', { nonNullable: true });
  readonly note = new FormControl('', { nonNullable: true });
  private readonly reasonIdValue = toSignal(this.reasonId.valueChanges, { initialValue: '' });

  /** Solo motivos de retorno (IN) */
  readonly inReasons = computed(() => this.options()?.reasons.filter(r => r.direction === 'IN') ?? []);

  /** Solo líneas con algo pendiente de devolver */
  readonly lines = new FormArray<ReturnLineGroup>(
    this.voucher.lines.filter(l => (l.pending ?? 0) > 0).map(newReturnLine),
  );

  constructor() {
    if (this.lines.length === 1) this.lines.at(0).controls.selected.setValue(true);

    this.api.getNewData().subscribe({
      next: d => {
        this.options.set(d);
        const ins = d.reasons.filter(r => r.direction === 'IN');
        if (ins.length === 1) this.reasonId.setValue(ins[0].id);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.error.set(this.message(err, 'No se pudieron cargar los datos iniciales'));
      },
    });
  }

  cancel() { this.dialogRef.close(); }

  private message(err: unknown, fallback: string): string {
    const e = err as { status?: number; error?: { message?: string | string[] } };
    if (e.status === 0) return 'No se pudo conectar con el servidor';
    const msg = e.error?.message;
    return Array.isArray(msg) ? msg.join(', ') : (msg ?? fallback);
  }

  // ---------- Helpers de línea ----------
  isSerial(line: ReturnLineGroup) { return line.controls.origin.value.units.length > 0; }

  /** Equipos que aún no han regresado */
  pendingUnits(line: ReturnLineGroup) {
    return line.controls.origin.value.units.filter(u => !u.returned);
  }

  toggleLine(line: ReturnLineGroup) {
    line.controls.selected.setValue(!line.controls.selected.value);
  }

  setQuantity(line: ReturnLineGroup, raw: string) {
    line.controls.quantity.setValue(raw === '' ? null : Number(raw));
  }

  isUnitPicked(line: ReturnLineGroup, unitId: string) {
    return line.controls.unitIds.value.includes(unitId);
  }

  toggleUnit(line: ReturnLineGroup, unitId: string) {
    const ids = line.controls.unitIds.value;
    line.controls.unitIds.setValue(ids.includes(unitId) ? ids.filter(x => x !== unitId) : [...ids, unitId]);
  }

  lineQty(line: ReturnLineGroup): number {
    return this.isSerial(line) ? line.controls.unitIds.value.length : (line.controls.quantity.value ?? 0);
  }

  togglePhotos(line: ReturnLineGroup) {
    line.controls.photosOpen.setValue(!line.controls.photosOpen.value);
  }

  // ---------- Guardado ----------
  submit() {
    if (this.saving()) return;
    this.submitted.set(true);
    const err = this.validate();
    this.error.set(err);
    if (err) return;

    const lines: CreateStockVoucherLine[] = [];
    const lineImages: File[][] = [];
    for (const l of this.lines.controls) {
      if (!l.controls.selected.value) continue;
      lines.push({
        originLineId: l.controls.origin.value.id,
        quantity: this.lineQty(l),
        ...(this.isSerial(l) ? { unitIds: l.controls.unitIds.value } : {}),
      });
      lineImages.push(l.controls.images.value); // mismo recorrido: índices alineados
    }

    const note = this.note.value.trim();
    const body: CreateStockVoucherRequest = {
      clientRequestId: this.clientRequestId,
      reasonId: this.reasonId.value,
      originVoucherId: this.voucher.id, // empleado y orden se heredan en el backend
      ...(note ? { note } : {}),
      lines,
    };

    this.saving.set(true);
    this.api.create(body, lineImages).subscribe({
      next: v => this.dialogRef.close(v), // replayed: true también es éxito
      error: e => {
        this.saving.set(false);
        this.error.set(this.message(e, 'No se pudo registrar el retorno'));
      },
    });
  }

  private validate(): string | null {
    if (!this.reasonId.value) return 'Selecciona el motivo del retorno';
    if (this.note.value.length > 500) return 'La nota admite máximo 500 caracteres';

    const selected = this.lines.controls.filter(l => l.controls.selected.value);
    if (!selected.length) return 'Marca al menos una línea para devolver';

    for (const l of selected) {
      const o = l.controls.origin.value;
      const n = `Línea ${o.lineNo} (${o.productSku}): `;
      const pending = o.pending ?? 0;
      if (this.isSerial(l)) {
        if (!l.controls.unitIds.value.length) return n + 'marca al menos un equipo';
      } else {
        const q = l.controls.quantity.value;
        if (q === null || !Number.isInteger(q) || q < 1) return n + 'la cantidad debe ser un entero mayor a 0';
        if (q > pending) return n + `solo quedan ${pending} pendiente(s) por devolver`;
      }
    }
    return null;
  }
}