import { ChangeDetectorRef, Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  CreateStockVoucherLine,
  CreateStockVoucherRequest,
  Employee,
  OrderSearchItem,
  StockLot,
  StockVoucherCreated,
  StockVoucherFormDialogData,
  StockVoucherNewDataResponse,
} from '../../types/stock-voucher.types';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { StockVouchersService } from '../../services/stock-vouchers.service';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ImageUpload } from '../../../../shared/components/image-upload/image-upload';
import { Autocomplete } from '../../../../shared/components/autocomplete/autocomplete';
import {
  catchError,
  map,
  Observable,
  of,
  shareReplay,
} from 'rxjs';
import { ProductOption } from '../../../receipts/types/receipt.types';
import { DatePipe } from '@angular/common';
/** Producto mínimo de una línea (cubre el que viene de la lista y el del buscador) */
interface LineProduct {
  id: string;
  name: string;
  sku: string;
  trackingMode: string;
}

/** Selección de un lote dentro de una línea */
const newPick = (lot: StockLot) =>
  new FormGroup({
    lot: new FormControl<StockLot>(lot, { nonNullable: true }),
    quantity: new FormControl<number | null>(null),                // productos por cantidad
    unitIds: new FormControl<string[]>([], { nonNullable: true }), // productos serializados
  });

const newVoucherLine = (product: LineProduct) =>
  new FormGroup({
    product: new FormControl<LineProduct>(product, { nonNullable: true }),
    lots: new FormControl<StockLot[] | null>(null),
    loadError: new FormControl<string | null>(null),
    picks: new FormArray<PickGroup>([]),
    images: new FormControl<File[]>([], { nonNullable: true }), // fotos del producto, máx. 5
    photosOpen: new FormControl(false, { nonNullable: true }),  // solo UI: mostrar el cargador
  });

type PickGroup = ReturnType<typeof newPick>;
type VoucherLineGroup = ReturnType<typeof newVoucherLine>;
@Component({
  imports: [ReactiveFormsModule, ImageUpload, Autocomplete, DatePipe],
  selector: 'app-stock-voucher-form-dialog',
  styleUrl: './stock-voucher-form-dialog.css',
  templateUrl: './stock-voucher-form-dialog.html',
})
export class StockVoucherFormDialog {
  private readonly dialogRef = inject(DialogRef<StockVoucherCreated>);
  private readonly api = inject(StockVouchersService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly input = inject<StockVoucherFormDialogData | null>(DIALOG_DATA, { optional: true });

  /** Se genera una sola vez al abrir y se reutiliza en todo reintento (se usa en el paso 4) */
  readonly clientRequestId = crypto.randomUUID();

  readonly options = signal<StockVoucherNewDataResponse | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly submitted = signal(false);
  readonly showProductSearch = signal(!this.input?.product);
  readonly reasonId = new FormControl('', { nonNullable: true });
  readonly note = new FormControl('', { nonNullable: true });
  private readonly reasonIdValue = toSignal(this.reasonId.valueChanges, { initialValue: '' });

  /** Solo motivos de salida: los de retorno (IN) se usan desde el detalle del vale */
  readonly outReasons = computed(
    () => this.options()?.reasons.filter(r => r.direction === 'OUT') ?? [],
  );
  readonly selectedReason = computed(
    () => this.outReasons().find(r => r.id === this.reasonIdValue()) ?? null,
  );

  readonly order = new FormControl<OrderSearchItem | null>(null);
  readonly orderSearchError = signal<string | null>(null);

  private readonly orderValue = toSignal(this.order.valueChanges, { initialValue: null });

  /** La orden elegida existe, pero no admite salidas (estado 8, 9 o 10) */
  readonly orderBlocked = computed(() => {
    const o = this.orderValue();
    return !!o && !o.canIssue;
  });

  readonly searchOrders = (term: string): Observable<OrderSearchItem[]> => {
    this.orderSearchError.set(null);
    return this.api.searchOrders(term).pipe(
      catchError(err => {
        this.orderSearchError.set(this.message(err, 'No se pudo buscar la orden'));
        return of([]);
      }),
    );
  };

  readonly orderLabel = (o: OrderSearchItem) =>
    `#${o.orderNumber} · ${o.customerName ?? 'Sin cliente'}`;
  readonly orderSub = (o: OrderSearchItem) =>
    [o.device, o.orderType, o.status.name, o.canIssue ? null : 'No admite salidas']
      .filter(Boolean)
      .join(' · ');

  constructor() {
    this.api.getNewData().subscribe({
      next: d => {
        this.options.set(d);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.error.set(this.message(err, 'No se pudieron cargar los datos iniciales'));
      },
    });

    // Limpiar la orden cuando cambia el motivo (así no queda una orden de un motivo que ya no la usa)
    this.reasonId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.order.setValue(null);
      this.orderSearchError.set(null);
    });

    // Producto elegido en la lista de productos: crea su línea y carga los lotes
    if (this.input?.product) this.addLineProduct(this.input.product);
  }

  cancel() {
    this.dialogRef.close();
  }

  private message(err: unknown, fallback: string): string {
    const e = err as { status?: number; error?: { message?: string | string[] } };
    if (e.status === 0) return 'No se pudo conectar con el servidor';
    const msg = e.error?.message;
    return Array.isArray(msg) ? msg.join(', ') : (msg ?? fallback);
  }

  readonly employee = new FormControl<Employee | null>(null);

  /** Una sola petición, ordenada por nombre. Si falla, el siguiente intento reintenta */
  private readonly employees$ = this.api.getEmployees().pipe(
    map(list => [...list].sort((a, b) => a.name.localeCompare(b.name, 'es'))),
    shareReplay(1),
  );

  readonly searchEmployees = (term: string): Observable<Employee[]> => {
    const q = this.normalize(term);
    return this.employees$.pipe(
      map(list =>
        list
          .filter(e => !q || this.normalize(`${e.name} ${e.username}`).includes(q))
          .slice(0, 20),
      ),
      catchError(err => {
        this.error.set(this.message(err, 'No se pudo cargar la lista de empleados'));
        return of([]);
      }),
    );
  };

  readonly employeeLabel = (e: Employee) => e.name;
  readonly employeeSub = (e: Employee) => `@${e.username}`;

  /** Sin tildes ni mayúsculas: "maria" encuentra "María" */
  private normalize(s: string): string {
    return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
  }
  readonly voucherLines = new FormArray<VoucherLineGroup>([]);

  readonly searchProducts = (term: string): Observable<ProductOption[]> =>
    this.api.searchProducts(term).pipe(map(r => r.items));
  readonly productLabel = (p: ProductOption) => p.name;
  readonly productSub = (p: ProductOption) =>
    [p.sku, p.quality, ...p.models.slice(0, 3).map(m => `${m.brand} ${m.name}`)]
      .filter(Boolean)
      .join(' · ');

  /** Agrega una línea y carga sus lotes */
  addLineProduct(p: LineProduct) {
    if (this.voucherLines.controls.some(l => l.controls.product.value.id === p.id)) {
      this.error.set('Ese producto ya está en el movimiento');
      return;
    }
    const line = newVoucherLine({ id: p.id, name: p.name, sku: p.sku, trackingMode: p.trackingMode });
    this.voucherLines.push(line);
    this.error.set(null);
    this.loadLots(line);
  }

  removeVoucherLine(i: number) {
    this.voucherLines.removeAt(i);
  }

  loadLots(line: VoucherLineGroup) {
    line.controls.lots.setValue(null);
    line.controls.loadError.setValue(null);
    this.api.getLots(line.controls.product.value.id).subscribe({
      next: lots => {
        line.controls.lots.setValue(lots);
        const usable = lots.filter(l => l.available > 0);
        if (usable.length === 1 && line.controls.picks.length === 0) {
          this.toggleLot(line, usable[0]);
        }
        this.cdr.markForCheck(); // zoneless: los FormControl no notifican a la vista
      },
      error: err => {
        line.controls.lots.setValue([]);
        line.controls.loadError.setValue(this.message(err, 'No se pudieron cargar los lotes'));
        this.cdr.markForCheck();
      },
    });
  }

  isSerialLine(line: VoucherLineGroup) {
    return line.controls.product.value.trackingMode === 'SERIAL';
  }

  pickFor(line: VoucherLineGroup, lot: StockLot): PickGroup | undefined {
    return line.controls.picks.controls.find(p => p.controls.lot.value.lotId === lot.lotId);
  }

  isPicked(line: VoucherLineGroup, lot: StockLot) {
    return !!this.pickFor(line, lot);
  }

  /** Marca o desmarca un lote en la línea */
  toggleLot(line: VoucherLineGroup, lot: StockLot) {
    const existing = this.pickFor(line, lot);
    if (existing) {
      line.controls.picks.removeAt(line.controls.picks.controls.indexOf(existing));
      return;
    }
    if (lot.available <= 0) return;
    const pick = newPick(lot);
    if (!this.isSerialLine(line)) pick.controls.quantity.setValue(1);
    line.controls.picks.push(pick);
  }

  setQuantity(pick: PickGroup, raw: string) {
    const n = raw === '' ? null : Number(raw);
    pick.controls.quantity.setValue(n);
  }

  isUnitPicked(pick: PickGroup, unitId: string) {
    return pick.controls.unitIds.value.includes(unitId);
  }

  toggleUnit(pick: PickGroup, unitId: string) {
    const ids = pick.controls.unitIds.value;
    pick.controls.unitIds.setValue(
      ids.includes(unitId) ? ids.filter(x => x !== unitId) : [...ids, unitId],
    );
  }

  /** Cantidad efectiva: equipos marcados (serial) o la escrita (cantidad) */
  pickQty(line: VoucherLineGroup, pick: PickGroup): number {
    return this.isSerialLine(line)
      ? pick.controls.unitIds.value.length
      : (pick.controls.quantity.value ?? 0);
  }

  lineTotalQty(line: VoucherLineGroup): number {
    return line.controls.picks.controls.reduce((s, p) => s + this.pickQty(line, p), 0);
  }

  togglePhotos(line: VoucherLineGroup) {
    line.controls.photosOpen.setValue(!line.controls.photosOpen.value);
  }

  // ===== Guardado =====
  submit() {
    if (this.saving()) return;
    this.submitted.set(true);
    const err = this.validate();
    this.error.set(err);
    if (err) return;

    const reason = this.selectedReason()!;
    const { lines, lineImages } = this.buildPayload();
    const note = this.note.value.trim();

    const body: CreateStockVoucherRequest = {
      clientRequestId: this.clientRequestId, // se reutiliza en todo reintento
      reasonId: reason.id,
      employeeId: this.employee.value!.id,
      ...(reason.orderLink === 'REQUIRED' ? { orderId: this.order.value!.id } : {}),
      ...(note ? { note } : {}),
      lines,
    };

    this.saving.set(true);
    this.api.create(body, lineImages).subscribe({
      // replayed: true también es éxito
      next: voucher => this.dialogRef.close(voucher),
      error: e => {
        this.saving.set(false);
        this.error.set(this.message(e, 'No se pudo registrar el movimiento'));
      },
    });
  }

  /** lines y fotos en un solo recorrido: los índices siempre coinciden */
  private buildPayload() {
    const lines: CreateStockVoucherLine[] = [];
    const lineImages: File[][] = [];

    for (const line of this.voucherLines.controls) {
      const serial = this.isSerialLine(line);
      line.controls.picks.controls.forEach((p, k) => {
        lines.push({
          lotId: p.controls.lot.value.lotId,
          quantity: this.pickQty(line, p),
          ...(serial ? { unitIds: p.controls.unitIds.value } : {}),
        });
        // las fotos del producto van en su primera línea (lote)
        lineImages.push(k === 0 ? line.controls.images.value : []);
      });
    }
    return { lines, lineImages };
  }

  private validate(): string | null {
    const reason = this.selectedReason();
    if (!reason) return 'Selecciona el motivo';
    if (!this.employee.value) return 'Selecciona el empleado';

    if (reason.orderLink === 'REQUIRED') {
      const o = this.order.value;
      if (!o) return 'Selecciona la orden';
      if (!o.canIssue) {
        return `La orden #${o.orderNumber} está en estado ${o.status.name} y no admite salidas`;
      }
    }

    if (this.note.value.length > 500) return 'La nota admite máximo 500 caracteres';
    if (!this.voucherLines.length) return 'Agrega al menos un repuesto';
    if (this.voucherLines.length > 100) return 'Un movimiento admite hasta 100 líneas';

    for (const [i, line] of this.voucherLines.controls.entries()) {
      const n = `Repuesto ${i + 1} (${line.controls.product.value.name}): `;
      if (line.controls.lots.value === null) return n + 'espera a que carguen los lotes';
      if (!line.controls.picks.length) return n + 'elige al menos un lote';

      const serial = this.isSerialLine(line);
      for (const p of line.controls.picks.controls) {
        const lot = p.controls.lot.value;
        const code = `lote #${lot.code}`;
        if (serial) {
          if (!p.controls.unitIds.value.length) return `${n}marca al menos un equipo del ${code}`;
          if (p.controls.unitIds.value.length > lot.available) {
            return `${n}el ${code} solo tiene ${lot.available} disponible(s)`;
          }
        } else {
          const q = p.controls.quantity.value;
          if (q === null || !Number.isInteger(q) || q < 1 || q > 100000) {
            return `${n}la cantidad del ${code} debe ser un entero entre 1 y 100000`;
          }
          if (q > lot.available) return `${n}el ${code} solo tiene ${lot.available} disponible(s)`;
        }
      }
    }
    return null;
  }
}