import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Observable, map } from 'rxjs';
import { Autocomplete } from '../../../../shared/components/autocomplete/autocomplete';
import { ImageUpload } from '../../../../shared/components/image-upload/image-upload';
import { SupplierFormDialog } from '../../../suppliers/components/supplier-form-dialog/supplier-form-dialog';
import { Supplier } from '../../../suppliers/types/supplier.types';
import { ReceiptsService } from '../../services/receipts.service';
import {
  CreateReceiptRequest, ProductOption, Receipt, ReceiptNewDataResponse, SupplierOption, PaymentMethod,
  AccessKeyPreview, AccessKeyLine, AccessKeyLineSuggestion, CreateReceiptLine,
} from '../../types/receipt.types';
import { CreateProductResponse } from '../../../products/types/product.types';
import { ProductFormDialog } from '../../../products/components/product-form-dialog/product-form-dialog';
import { AccessKeyDialog } from '../access-key-dialog/access-key-dialog';
import { PRINTERS, PrinterType } from '../../../../shared/types/label.types';

type UnitGroup = FormArray<FormControl<string>>; // un equipo = 1 a 4 seriales

const newUnit = (): UnitGroup => new FormArray([new FormControl('', { nonNullable: true })]);

const newLine = () =>
  new FormGroup({
    affectsInventory: new FormControl(true, { nonNullable: true }),
    description: new FormControl('', { nonNullable: true }),
    product: new FormControl<ProductOption | null>(null),
    quantity: new FormControl<number | null>(1),
    unitCost: new FormControl<number | null>(null),
    discount: new FormControl(0, { nonNullable: true }),
    purchaseTaxCode: new FormControl('', { nonNullable: true }),
    purchaseTaxRate: new FormControl<number | null>(null),
    salePrice: new FormControl<number | null>(null),
    warrantyDays: new FormControl(0, { nonNullable: true }),
    hasTax: new FormControl(false, { nonNullable: true }),
    priceIncludesTax: new FormControl(false, { nonNullable: true }),
    billableInSales: new FormControl(true, { nonNullable: true }),
    billableInRepairOrders: new FormControl(false, { nonNullable: true }),
    units: new FormArray<UnitGroup>([]),
    images: new FormControl<File[]>([], { nonNullable: true }),
    source: new FormControl<AccessKeyLine | null>(null),
    printLabels: new FormControl(false, { nonNullable: true }),
    printCant: new FormControl<number | null>(null),
  });

const newPayment = () =>
  new FormGroup({
    amount: new FormControl<number | null>(null),
    paidAt: new FormControl(today(), { nonNullable: true }),
    method: new FormControl<PaymentMethod | ''>('', { nonNullable: true }),
    reference: new FormControl('', { nonNullable: true }),
    note: new FormControl('', { nonNullable: true }),
    proof: new FormControl<File[]>([], { nonNullable: true }), // máx. 1 archivo
  });

type LineGroup = ReturnType<typeof newLine>;
type PaymentGroup = ReturnType<typeof newPayment>;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

@Component({
  imports: [ReactiveFormsModule, DecimalPipe, Autocomplete, ImageUpload],
  selector: 'app-receipt-form-dialog',
  styleUrl: './receipt-form-dialog.css',
  templateUrl: './receipt-form-dialog.html',
})
export class ReceiptFormDialog {
  private readonly dialogRef = inject(DialogRef<Receipt>);
  private readonly dialog = inject(Dialog);
  private readonly api = inject(ReceiptsService);

  /** Se genera al abrir: si el guardado se reintenta, el backend lo trata como el mismo ingreso */
  private readonly clientRequestId = crypto.randomUUID();

  readonly options = signal<ReceiptNewDataResponse | null>(null);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly submitted = signal(false);
  // junto a las demás señales
  readonly accessKeyData = signal<AccessKeyPreview | null>(null);
  // Documento (factura, proforma...): un solo archivo, imagen o PDF
  readonly documentFiles = signal<File[]>([]);
  readonly docAccept = 'image/jpeg,image/png,image/webp,application/pdf';
  readonly proofAccept = 'image/jpeg,image/png,image/webp,application/pdf';

  readonly printers = PRINTERS;
  readonly printer = signal<PrinterType>('ZEBRA');

  readonly form = new FormGroup({
    supplier: new FormControl<SupplierOption | null>(null),
    documentTypeId: new FormControl('', { nonNullable: true }),
    documentNumber: new FormControl('', { nonNullable: true }),
    issueDate: new FormControl(today(), { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true }),
    lines: new FormArray<LineGroup>([]),
    payments: new FormArray<PaymentGroup>([]),
  });

  get lines() { return this.form.controls.lines; }
  get payments() { return this.form.controls.payments; }

  // ===== Funciones para los buscadores =====
  readonly searchSuppliers = (term: string): Observable<SupplierOption[]> =>
    this.api.searchSuppliers(term);

  readonly searchProducts = (term: string): Observable<ProductOption[]> =>
    this.api.searchProducts(term).pipe(map(r => r.items));

  readonly supplierLabel = (s: SupplierOption) => s.businessName;
  readonly supplierSub = (s: SupplierOption) =>
    `${s.identificationNumber} · #${s.code}${s.tradeName ? ' · ' + s.tradeName : ''}`;

  readonly productLabel = (p: ProductOption) => p.name;
  readonly productSub = (p: ProductOption) =>
    [p.sku, p.quality, ...p.models.slice(0, 3).map(m => `${m.brand} ${m.name}`)]
      .filter(Boolean)
      .join(' · ');

  constructor() {
    this.api.getNewData().subscribe({
      next: d => {
        this.options.set(d);
        // Preseleccionar fecha de emisión si viene en defaults
        if (d.defaults?.issueDate) {
          this.form.controls.issueDate.setValue(d.defaults.issueDate);
        }
      },
      error: err => this.error.set(this.message(err, 'No se pudieron cargar los datos iniciales')),
    });
  }

  setPrinter(v: string) { this.printer.set(v as PrinterType); }

  /** Marca la línea y precarga la cantidad de etiquetas con la de la línea */
  toggleLabel(line: LineGroup, checked: boolean) {
    const c = line.controls;
    c.printLabels.setValue(checked);
    if (checked && !c.printCant.value) {
      c.printCant.setValue(c.quantity.value && c.quantity.value >= 1 ? c.quantity.value : 1);
    }
  }

  /** Líneas con inventario y producto marcadas para imprimir */
  private labeledLines(): { index: number; line: LineGroup }[] {
    return this.lines.controls
      .map((line, index) => ({ index, line }))
      .filter(({ line }) =>
        line.controls.printLabels.value && line.controls.affectsInventory.value && !!line.controls.product.value);
  }

  labelCount() { return this.labeledLines().length; }

  // ===== Crear proveedor / producto desde el buscador =====
  createSupplier() {
    this.dialog
      .open<Supplier>(SupplierFormDialog, { width: '40rem', maxWidth: '95vw', autoFocus: 'first-tabbable' })
      .closed.subscribe(s => { if (s) this.form.controls.supplier.setValue(s); });
  }

  createProduct() {
    this.dialog
      .open<CreateProductResponse>(ProductFormDialog, {
        width: '48rem',
        maxWidth: '95vw',
        autoFocus: 'first-tabbable',
      })
      .closed.subscribe(created => {
        if (!created) return;
        if (created.option) this.addProduct(created.option);
        else this.error.set('Producto creado, pero no se pudo agregar. Búscalo en el buscador.');
      });
  }

  // ===== Líneas =====
  removeLine(i: number) {
    this.lines.removeAt(i);
  }

  isSerial(line: LineGroup) {
    return line.controls.product.value?.trackingMode === 'SERIAL';
  }

  /** Se llama al elegir un producto en el buscador */
  addProduct(p: ProductOption) {
    const existing = this.lines.controls.find(l => l.controls.product.value?.id === p.id);
    if (existing) {
      if (this.isSerial(existing)) this.addUnit(existing);
      else existing.controls.quantity.setValue((existing.controls.quantity.value ?? 0) + 1);
      return;
    }

    const line = newLine();
    this.applyProduct(line, p);
    this.lines.push(line);
    this.error.set(null);
  }

  private applyProduct(line: LineGroup, p: ProductOption) {
    const c = line.controls;
    const last = p.lastReceipt;
    const d = p.defaults;

    c.product.setValue(p);
    c.salePrice.setValue(Number(last?.salePrice ?? d.salePrice));
    c.warrantyDays.setValue(last?.warrantyDays ?? d.warrantyDays);
    c.hasTax.setValue(d.hasTax);
    c.priceIncludesTax.setValue(d.priceIncludesTax);
    c.billableInSales.setValue(last?.billableInSales ?? d.billableInSales);
    c.billableInRepairOrders.setValue(last?.billableInRepairOrders ?? d.billableInRepairOrders);

    if (last) {
      c.unitCost.setValue(Number(last.documentUnitCost));
      c.purchaseTaxCode.setValue(last.purchaseTaxCode ?? '');
      c.purchaseTaxRate.setValue(last.purchaseTaxRate !== null ? Number(last.purchaseTaxRate) : null);
    }

    if (p.trackingMode === 'SERIAL') {
      c.units.push(newUnit());
      c.quantity.setValue(1);
    }
  }

  private syncQty(line: LineGroup) {
    line.controls.quantity.setValue(line.controls.units.length);
  }

  addUnit(line: LineGroup) {
    line.controls.units.push(newUnit());
    this.syncQty(line);
  }

  removeUnit(line: LineGroup, i: number) {
    if (line.controls.units.length <= 1) return;
    line.controls.units.removeAt(i);
    this.syncQty(line);
  }

  addSerial(unit: UnitGroup) {
    if (unit.length < 4) unit.push(new FormControl('', { nonNullable: true }));
  }

  removeSerial(unit: UnitGroup, i: number) {
    if (unit.length > 1) unit.removeAt(i);
  }

  // ===== Pagos =====
  addPayment() {
    if (this.payments.length >= 50) return;
    this.payments.push(newPayment());
  }

  removePayment(i: number) {
    this.payments.removeAt(i);
  }

  paymentsTotal(): number {
    return this.payments.controls.reduce((sum, p) => sum + (Number(p.controls.amount.value) || 0), 0);
  }

  // ===== Totales =====
  lineSubtotal(line: LineGroup) {
    const v = line.getRawValue();
    return Math.max((v.quantity || 0) * (v.unitCost || 0) - (v.discount || 0), 0);
  }

  totals() {
    let subtotal = 0, tax = 0;
    for (const line of this.lines.controls) {
      const s = this.lineSubtotal(line);
      subtotal += s;
      tax += (s * (line.getRawValue().purchaseTaxRate || 0)) / 100;
    }
    return { subtotal, tax, total: subtotal + tax };
  }

  // ===== Guardado =====
  submit() {
    if (this.saving()) return;
    this.submitted.set(true);
    const err = this.validate();
    this.error.set(err);
    if (err) return;

    this.saving.set(true);

    const proofFiles = this.payments.controls.map(p => p.controls.proof.value[0] ?? null);

    this.api
      .create(this.buildRequest(), {
        document: this.documentFiles()[0] ?? null,
        lineImages: this.lines.controls.map(l => l.controls.images.value),
        proofs: proofFiles, // el servicio debe mapear a proof_0, proof_1, ...
      })
      .subscribe({
        next: r => this.dialogRef.close(r),
        error: e => {
          this.saving.set(false);
          this.error.set(this.message(e, 'No se pudo registrar el ingreso'));
        },
      });
  }

  cancel() { this.dialogRef.close(); }

  private validate(): string | null {
    const v = this.form.getRawValue();
    if (!v.supplier) return 'Selecciona un proveedor';
    if (!v.documentTypeId) return 'Selecciona el tipo de documento';
    if (!v.issueDate) return 'Ingresa la fecha de emisión';
    if (v.documentNumber.length > 50) return 'El número de documento admite máximo 50 caracteres';
    if (v.notes.length > 2000) return 'Las notas admiten máximo 2000 caracteres';
    if (!v.lines.length) return 'Agrega al menos un producto';

    const seen = new Set<string>();
    const codeTarget = new Map<string, string>();
    for (const [i, l] of v.lines.entries()) {
      const n = `Línea ${i + 1}: `;
      if (l.affectsInventory) {
        if (!l.product) return n + 'selecciona un producto';
      } else if (!l.description.trim()) {
        return n + 'ingresa la descripción';
      }

      // Un mismo código del proveedor no puede apuntar a destinos distintos
      const code = l.source?.supplierCode;
      if (code) {
        const target = l.affectsInventory ? l.product!.id : 'NON_INVENTORY';
        const prev = codeTarget.get(code);
        if (prev !== undefined && prev !== target) {
          return n + `el código ${code} apunta a destinos distintos dentro del ingreso`;
        }
        codeTarget.set(code, target);
      }

      if (l.affectsInventory && l.product!.trackingMode === 'SERIAL') {
        if (!l.units.length) return n + 'agrega al menos un equipo';
        for (const unit of l.units) {
          for (const raw of unit) {
            const s = raw.trim().toUpperCase();
            if (!s) return n + 'hay un IMEI/serial vacío';
            if (seen.has(s)) return `${n}el IMEI/serial ${raw.trim()} está repetido`;
            seen.add(s);
          }
        }
      } else if (l.quantity === null || !Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 100000) {
        return n + 'la cantidad debe ser un entero entre 1 y 100000';
      }

      if (l.unitCost === null || l.unitCost < 0 || l.unitCost > 1000000) return n + 'costo unitario no válido';
      if ((l.discount ?? 0) < 0 || (l.discount ?? 0) > (l.quantity ?? 0) * l.unitCost) return n + 'descuento no válido';
      if (l.purchaseTaxCode.length > 10) return n + 'el código de impuesto admite máximo 10 caracteres';
      if (l.purchaseTaxRate !== null && (l.purchaseTaxRate < 0 || l.purchaseTaxRate > 100)) return n + 'el IVA debe estar entre 0 y 100';
      if (l.affectsInventory) {
        if (l.salePrice === null || l.salePrice < 0) return n + 'precio de venta no válido';
        if (!Number.isInteger(l.warrantyDays) || l.warrantyDays < 0) return n + 'la garantía debe ser un entero mayor o igual a 0';
      }
    }

    // Pagos
    if (v.payments.length > 50) return 'Un ingreso admite hasta 50 pagos iniciales';

    const invoiceTotal = this.totals().total;
    let paidSum = 0;

    for (const [i, p] of v.payments.entries()) {
      const n = `Pago ${i + 1}: `;
      if (p.amount === null || !Number.isFinite(p.amount) || p.amount <= 0) {
        return n + 'el monto debe ser mayor a 0';
      }
      // hasta 2 decimales
      if (Math.abs(p.amount * 100 - Math.round(p.amount * 100)) > 1e-6) {
        return n + 'el monto admite hasta 2 decimales';
      }
      if (!p.paidAt) return n + 'ingresa la fecha de pago';
      if (p.paidAt > today()) return n + 'la fecha de pago no puede ser futura';
      if (!p.method) return n + 'selecciona el método de pago';
      if (p.reference.length > 100) return n + 'la referencia admite máximo 100 caracteres';
      if (p.note.length > 500) return n + 'la nota admite máximo 500 caracteres';

      paidSum += p.amount;
    }

    if (paidSum > invoiceTotal + 0.001) {
      return `Los pagos (${paidSum.toFixed(2)}) superan el total del ingreso (${invoiceTotal.toFixed(2)})`;
    }

    const labeled = this.labeledLines();
    if (labeled.length > 50) return 'Máximo 50 líneas con etiquetas por ingreso';
    for (const { index, line } of labeled) {
      const cant = line.controls.printCant.value;
      if (cant === null || !Number.isInteger(cant) || cant < 1 || cant > 999) {
        return `Línea ${index + 1}: la cantidad de etiquetas debe ser un entero entre 1 y 999`;
      }
    }

    return null;
  }

  private buildRequest(): CreateReceiptRequest {
    const v = this.form.getRawValue();
    const docNumber = v.documentNumber.trim();
    const notes = v.notes.trim();
    const accessKey = this.accessKeyData()?.key.accessKey;

    return {
      clientRequestId: this.clientRequestId,
      supplierId: v.supplier!.id,
      documentTypeId: v.documentTypeId,
      ...(docNumber ? { documentNumber: docNumber } : {}),
      issueDate: v.issueDate,
      ...(notes ? { notes } : {}),
      ...(accessKey ? { accessKey } : {}),
      lines: v.lines.map((l): CreateReceiptLine => {
        const src = l.source;
        const discount = l.discount ?? 0;
        const taxCode = l.purchaseTaxCode.trim();
        const common = {
          unitCost: l.unitCost!,
          ...(discount > 0 ? { discount } : {}),
          ...(taxCode ? { purchaseTaxCode: taxCode } : {}),
          ...(l.purchaseTaxRate !== null ? { purchaseTaxRate: l.purchaseTaxRate } : {}),
          ...(src?.supplierCode ? { supplierCode: src.supplierCode } : {}),
        };
        if (!l.affectsInventory) {
          return {
            affectsInventory: false,
            description: l.description.trim(),
            quantity: l.quantity!,
            ...common,
          };
        }
        const serial = l.product!.trackingMode === 'SERIAL';
        return {
          productId: l.product!.id,
          quantity: serial ? l.units.length : l.quantity!,
          salePrice: l.salePrice!,
          warrantyDays: l.warrantyDays,
          hasTax: l.hasTax,
          priceIncludesTax: l.priceIncludesTax,
          billableInSales: l.billableInSales,
          billableInRepairOrders: l.billableInRepairOrders,
          ...(serial ? { units: l.units.map(u => ({ serials: u.map(s => s.trim()) })) } : {}),
          ...(src ? { supplierDescription: src.description, supplierQuantity: src.quantity } : {}),
          ...common,
        };
      }),
      ...(v.payments.length
        ? {
          payments: v.payments.map(p => {
            const reference = p.reference.trim();
            const note = p.note.trim();
            return {
              amount: p.amount!,
              paidAt: p.paidAt,
              method: p.method as PaymentMethod,
              ...(reference ? { reference } : {}),
              ...(note ? { note } : {}),
            };
          }),
        }
        : {}),
      ...(this.labeledLines().length
        ? {
          labels: {
            printer: this.printer(),
            items: this.labeledLines().map(({ index, line }) => ({
              lineIndex: index,
              cant: line.controls.printCant.value!,
            })),
          },
        }
        : {}),
    };
  }

  private message(err: unknown, fallback: string): string {
    const e = err as { status?: number; error?: { message?: string | string[] } };
    if (e.status === 0) return 'No se pudo conectar con el servidor';
    const msg = e.error?.message;
    return Array.isArray(msg) ? msg.join(', ') : (msg ?? fallback);
  }

  // ===== Importar por clave de acceso =====
  readonly invoiceTotal = computed(() => {
    const t = this.accessKeyData()?.documentTotals;
    return t ? Number(t.total) : null;
  });

  /** Diferencia contra la factura; null si no hay factura o cuadra (±0.01) */
  totalsDiff(): number | null {
    const it = this.invoiceTotal();
    if (it === null) return null;
    const d = this.totals().total - it;
    return Math.abs(d) > 0.01 ? d : null;
  }

  readonly reasonLabel = (r: string | null) =>
    ({
      NO_MAPPING: 'Sin relación con un producto',
      NO_CODE: 'La factura no trae código',
      PRODUCT_INACTIVE: 'El producto relacionado está inactivo',
    } as Record<string, string>)[r ?? ''] ?? 'Sin producto';

  openAccessKeyLookup() {
    this.dialog
      .open<AccessKeyPreview>(AccessKeyDialog, {
        width: '36rem',
        maxWidth: '95vw',
        autoFocus: 'first-tabbable',
      })
      .closed.subscribe(p => {
        if (!p) return;
        this.accessKeyData.set(p);
        this.applyAccessKey(p);
      });
  }

  private applyAccessKey(p: AccessKeyPreview) {
    const f = this.form.controls;
    let notice: string | null = null;

    if (p.supplier) f.supplier.setValue(p.supplier);
    f.issueDate.setValue(p.key.issueDate);
    f.documentNumber.setValue(p.key.documentNumber);

    const type = this.matchDocumentType(p.key.documentType);
    if (type) f.documentTypeId.setValue(type.id);
    else notice = `No se encontró el tipo de documento "${p.key.documentType}" en el catálogo. Selecciónalo manualmente.`;

    if (p.lines.length) {
      if (this.lines.length && !confirm('Ya hay productos cargados. ¿Reemplazarlos por las líneas de la factura?')) {
        this.error.set(notice);
        return;
      }
      this.lines.clear();
      for (const line of p.lines) this.lines.push(this.buildImportedLine(line));
    }
    this.error.set(notice);
  }

  private matchDocumentType(label: string) {
    const norm = (s?: string) => (s ?? '').trim().toUpperCase();
    const target = norm(label);
    return this.options()?.documentTypes.find(t => norm(t.code) === target || norm(t.name) === target) ?? null;
  }

  private buildImportedLine(s: AccessKeyLine): LineGroup {
    const line = newLine();
    line.controls.source.setValue(s);
    const { status, product, suggestion } = s.match;
    if (status === 'NON_INVENTORY') {
      this.applyNonInventory(line, s);
    } else if (status === 'MAPPED' && product) {
      this.applyProduct(line, product);
      this.applyInvoiceValues(line, s, suggestion);
    } else {
      this.applyInvoiceValues(line, s, null); // UNMAPPED
    }
    return line;
  }

  private applyNonInventory(line: LineGroup, s: AccessKeyLine) {
    const c = line.controls;
    c.affectsInventory.setValue(false);
    c.product.setValue(null);
    c.units.clear();
    c.description.setValue(s.description);
    c.quantity.setValue(s.quantity);
    c.unitCost.setValue(s.unitPrice);
    c.discount.setValue(s.discount ?? 0);
    c.purchaseTaxCode.setValue(s.tax?.code ?? '');
    c.purchaseTaxRate.setValue(s.tax?.rate ?? null);
  }

  /** Una línea UNMAPPED que en realidad es gasto (transporte, etc.) */
  markNonInventory(line: LineGroup) {
    const src = line.controls.source.value;
    if (src) this.applyNonInventory(line, src);
  }

  /** Línea manual sin inventario */
  addNonInventoryLine() {
    const line = newLine();
    line.controls.affectsInventory.setValue(false);
    this.lines.push(line);
    this.error.set(null);
  }

  /** Asigna producto a una línea UNMAPPED, conservando los valores de la factura */
  assignProduct(line: LineGroup, p: ProductOption) {
    const src = line.controls.source.value;
    line.controls.affectsInventory.setValue(true);
    line.controls.units.clear();
    this.applyProduct(line, p);
    if (src) this.applyInvoiceValues(line, src, null);
    this.error.set(null);
  }

  /** Vuelve una línea (gasto o relacionada) al estado "por relacionar", conservando los valores de la factura */
  unassign(line: LineGroup) {
    const src = line.controls.source.value;
    const c = line.controls;
    c.affectsInventory.setValue(true);
    c.product.setValue(null);
    c.units.clear();
    c.images.setValue([]);
    if (src) {
      this.applyInvoiceValues(line, src, null);
    } else {
      c.quantity.setValue(1);
    }
    this.error.set(null);
  }

  /** Cambia el producto relacionado por otro, conservando los valores de la factura */
  reassignProduct(line: LineGroup, p: ProductOption) {
    const src = line.controls.source.value;
    line.controls.units.clear();
    this.applyProduct(line, p);
    if (src) this.applyInvoiceValues(line, src, null);
    this.error.set(null);
  }

  /** Marca como gasto una línea ya relacionada */
  markNonInventoryFromMapped(line: LineGroup) {
    const src = line.controls.source.value;
    if (src) {
      this.applyNonInventory(line, src);
    } else {
      const c = line.controls;
      c.affectsInventory.setValue(false);
      c.product.setValue(null);
      c.units.clear();
    }
  }

  /** La factura (y la suggestion, si existe) ganan sobre el último ingreso */
  private applyInvoiceValues(line: LineGroup, s: AccessKeyLine, sg: AccessKeyLineSuggestion | null) {
    const c = line.controls;
    const serial = c.product.value?.trackingMode === 'SERIAL';

    c.discount.setValue(s.discount ?? 0);
    c.purchaseTaxCode.setValue(s.tax?.code ?? '');
    c.purchaseTaxRate.setValue(s.tax?.rate ?? null);
    c.unitCost.setValue(sg ? sg.unitCost : s.unitPrice);

    // Cantidad: suggestion (ya convertida) o la de la factura; null = la escribe el usuario
    const qty = sg ? sg.quantity : s.quantity;

    if (serial) {
      // El XML no trae IMEI: un equipo vacío por unidad
      c.units.clear();
      const n = Math.max(1, Math.round(qty ?? 1));
      for (let i = 0; i < n; i++) c.units.push(newUnit());
      this.syncQty(line);
    } else {
      c.quantity.setValue(qty);
    }
  }
}