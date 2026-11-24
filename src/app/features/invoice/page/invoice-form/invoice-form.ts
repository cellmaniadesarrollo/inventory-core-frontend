// src/app/features/invoice/page/invoice-form/invoice-form.ts
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Dialog } from '@angular/cdk/dialog';
import { Router, RouterLink } from '@angular/router';
import {
  Subject,
  Subscription,
  catchError,
  debounceTime,
  distinctUntilChanged,
  forkJoin,
  map,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { ScanSearch } from '../../../../shared/components/scan-search/scan-search';
import { ScannedLabel } from '../../../../shared/utils/qr-label';
// (ASUMIDO) ruta y nombre de clase del diálogo; ajusta si difieren
import { ClientBillingDialog } from '../../../clients/components/client-billing-dialog/client-billing-dialog';
import { ClientsService } from '../../../clients/services/clients.service';
import { BillingClient, BillingDialogResult } from '../../../clients/types/clients.types';
import { InvoicesService } from '../../services/invoice.service';
import { SalesService } from '../../services/sales.service';
import { DiscountsService } from '../../services/discounts.service';
import { DiscountDialog } from '../../components/discount-dialog/discount-dialog';
import {
  CreateInvoiceRequest,
  DiscountOption,
  PaymentMethodOption,
  VatRateOption,
} from '../../types/invoice.type';
import {
  CreateSaleReceiptRequest,
  SaleOption,
  SaleSearchQuery,
  SaleSearchResponse,
} from '../../types/sale-product.type';

/** Comprador ya elegido (existente o recién creado) para mostrar como resumen. */
interface Buyer {
  idTypeCode: string;
  idNumber: string;
  name: string;
  address: string;
  email: string;
}

const cents = (v: number) => Math.round((Number.isFinite(v) ? v : 0) * 100 + Number.EPSILON);
const money = (c: number) => (c / 100).toFixed(2);

/** IVA fijo de las facturas. (ASUMIDO) código SRI '4' = 15%. */
const VAT_CODE = '4';
const VAT_PCT = 15;
/** Precio unitario con hasta 6 decimales (máximo que acepta el SRI). */
const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Traduce un BillingClient (búsqueda o diálogo) al comprador de la factura. */
function toBuyer(c: BillingClient): Buyer {
  return {
    idTypeCode: c.idType?.code ?? '05',
    idNumber: c.idNumber ?? '',
    name: [c.firstName, c.lastName].filter(Boolean).join(' ').trim(),
    address: c.address ?? '',
    email: c.mainEmail ?? '',
  };
}

@Component({
  selector: 'app-invoice-form',
  imports: [ReactiveFormsModule, RouterLink, ScanSearch],
  templateUrl: './invoice-form.html',
  styleUrl: './invoice-form.css',
})
export class InvoiceForm {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(InvoicesService);
  private readonly sales = inject(SalesService);
  private readonly clients = inject(ClientsService);
  private readonly discountsApi = inject(DiscountsService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);

  /** Se generan UNA vez y se reutilizan en todo reintento (idempotencia). */
  private readonly invoiceRequestId = crypto.randomUUID();
  private readonly receiptRequestId = crypto.randomUUID();

  /** Petición de búsqueda en curso; se cancela si llega una nueva. */
  private lookupSub?: Subscription;

  /** Texto que escribe el usuario en el buscador de comprador. */
  private readonly buyerTerm$ = new Subject<string>();

  /** Vienen de GET /customers/billing/form-catalogs (el mismo del feature clients). */
  readonly idTypes = signal<{ code: string; name: string }[]>([]);
  readonly methods = signal<PaymentMethodOption[]>([]);
  readonly rates = signal<VatRateOption[]>([]);
  /** Catálogo de descuentos activos (módulo discounts de billing). */
  readonly discounts = signal<DiscountOption[]>([]);
  readonly saving = signal(false);
  readonly looking = signal(false);
  readonly searching = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  /** Opciones elegibles (lote o unidad) cuando la búsqueda devuelve más de una. */
  readonly candidates = signal<SaleOption[]>([]);
  /** Comprador elegido (null = aún no se elige). */
  readonly buyer = signal<Buyer | null>(null);
  /** Clientes encontrados al buscar, para elegir uno. */
  readonly buyerResults = signal<Buyer[]>([]);
  /** true cuando se buscó y no hubo coincidencias. */
  readonly buyerEmpty = signal(false);

  readonly form = this.fb.group({
    buyerIdTypeCode: ['05'],
    buyerIdNumber: [''],
    buyerName: [''],
    buyerAddress: [''],
    buyerEmail: ['', [Validators.email]],
    paymentMethod: ['01'],
    lines: this.fb.array([] as ReturnType<InvoiceForm['newLine']>[]),
  });

  get lines(): FormArray {
    return this.form.controls.lines as unknown as FormArray;
  }

  /**
   * Los FormControl no notifican a la vista (zoneless): se espeja el valor en un signal.
   * Se usa getRawValue() porque los controles deshabilitados no aparecen en form.value.
   */
  private readonly value = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => this.form.getRawValue()),
    ),
    { initialValue: this.form.getRawValue() },
  );

  /** Vista previa informativa. El valor oficial lo calcula el servidor. */
  readonly preview = computed(() => {
    const inv = { sub: 0, vat: 0, disc: 0, count: 0 };
    const rec = { sub: 0, disc: 0, count: 0 };
    for (const l of (this.value().lines ?? []) as any[]) {
      const { base, discount: d } = this.calc(l);
      if (l.billable) {
        inv.sub += base;
        inv.disc += d;
        inv.count++;
        inv.vat += Math.round((base * VAT_PCT) / 100);
      } else {
        rec.sub += base; // (asumido) el recibo no desglosa IVA
        rec.disc += d;
        rec.count++;
      }
    }
    return {
      invoice: {
        count: inv.count,
        subtotal: money(inv.sub),
        discount: money(inv.disc),
        vat: money(inv.vat),
        total: money(inv.sub + inv.vat),
        totalCents: inv.sub + inv.vat,
      },
      receipt: { count: rec.count, discount: money(rec.disc), total: money(rec.sub), totalCents: rec.sub },
    };
  });

  constructor() {
    this.api.vatRates().subscribe({
      next: (res) => this.rates.set(res.items),
      error: () => this.error.set('No se pudieron cargar las tarifas de IVA.'),
    });
    this.api.paymentMethods().subscribe({
      next: (res) => this.methods.set(res.items),
      error: () => this.error.set('No se pudieron cargar las formas de pago.'),
    });
    // (ASUMIDO) GET /discounts devuelve { items: DiscountOption[] } solo con los activos.
    this.discountsApi.available().subscribe({
      next: (res) => this.discounts.set(res),
      error: () => this.error.set('No se pudieron cargar los descuentos.'),
    });
    this.clients.getCatalogs().subscribe({
      next: (res) => this.idTypes.set(res.idTypes.map((t) => ({ code: t.code, name: t.name }))),
      error: () => this.error.set('No se pudieron cargar los tipos de identificación.'),
    });

    // Autocompletado del comprador: debounce + cancela la petición anterior.
    this.buyerTerm$
      .pipe(
        map((t) => t.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        tap((t) => {
          this.buyerEmpty.set(false);
          if (t.length < 2) {
            this.buyerResults.set([]);
            this.searching.set(false);
          } else {
            this.searching.set(true);
          }
        }),
        switchMap((t) =>
          t.length < 2 ? of(null) : this.clients.searchByText(t).pipe(catchError(() => of(undefined))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((res) => {
        this.searching.set(false);
        if (res === null) return; // texto muy corto
        if (res === undefined) {
          this.notice.set('No se pudo buscar el cliente.');
          return;
        }
        const list = (res.items ?? []).map(toBuyer).filter((b) => b.idNumber || b.name);
        this.buyerResults.set(list);
        this.buyerEmpty.set(list.length === 0);
      });
  }

  // ---------- Teclado ----------

  /** Enter no debe enviar el formulario; solo el botón Guardar lo hace. */
  blockEnter(e: Event) {
    const t = e.target as HTMLElement;
    if (t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON') return;
    e.preventDefault();
  }

  // ---------- Cálculo de líneas ----------

  /**
   * Calcula bruto, descuento y base de una línea (en centavos).
   * Replica la regla del servidor (resolveForLine):
   * - PERCENT = bruto × %
   * - AMOUNT = monto fijo CON IVA, convertido a base sin IVA (monto / (1 + IVA))
   * Nunca supera el bruto. El valor oficial lo calcula el servidor.
   */
  private calc(l: any) {
    const gross = cents(Number(l.quantity) * Number(l.unitPrice));
    const dsc = l.discountId ? this.discounts().find((x) => x.id === l.discountId) : undefined;
    // Las líneas de factura llevan IVA; las de recibo no.
    const vatPct = l.billable ? VAT_PCT : 0;
    const raw = !dsc
      ? 0
      : dsc.valueKind === 'PERCENT'
        ? Math.round((gross * Number(dsc.value)) / 100)
        : Math.round((Number(dsc.value) * 100) / (1 + vatPct / 100));
    const d = Math.min(raw, gross);
    return { gross, discount: d, base: gross - d };
  }

  /** Subtotal (sin IVA) de la línea i, para mostrar en la fila. */
  lineSubtotal(i: number): string {
    const l = (this.value().lines ?? [])[i];
    return l ? money(this.calc(l).base) : '0.00';
  }

  private newLine(o?: SaleOption) {
    // hasTax = true → salePrice ya incluye el IVA: se separa (÷ 1.15) para obtener el precio sin IVA.
    // hasTax = false → salePrice es el precio sin IVA y el 15% se suma encima.
    // Los productos que van a recibo no llevan IVA: se deja el precio tal cual.
    const priceIncludesVat = !!o && o.lot.billableInSales && o.lot.hasTax;
    const unitPrice = o
      ? round6(Number(o.lot.salePrice) / (priceIncludesVat ? 1 + VAT_PCT / 100 : 1))
      : 0;

    const g = this.fb.group({
      productId: [o?.product.id ?? ''],
      lotId: [o?.lot.lotId ?? ''],
      unitId: [o?.unit?.unitId ?? ''],
      batch: [o ? String(o.lot.code) : ''],
      /** true = producto del sistema: solo cantidad y descuento son editables. */
      locked: [!!o],
      mainCode: [o?.product.sku ?? '', [Validators.required, Validators.pattern(/\S/)]],
      description: [
        o ? o.product.name + (o.unit ? ` (${o.unit.serial})` : '') : '',
        [Validators.required, Validators.pattern(/\S/)],
      ],
      quantity: [1, [Validators.required, Validators.min(0.000001)]],
      // Solo se copia al control; el cálculo oficial lo hace el servidor.
      unitPrice: [unitPrice, [Validators.required, Validators.min(0)]],
      /** Descuento elegido del catálogo ('' = ninguno). El servidor calcula el monto. */
      discountId: [''],
      // IVA fijo al 15% en toda línea de factura; no se puede cambiar.
      vatRateCode: [VAT_CODE, [Validators.required]],
      billable: [o?.lot.billableInSales ?? true],
    });
    g.get('vatRateCode')!.disable();

    if (o) {
      // Todo bloqueado excepto cantidad y descuento.
      ['mainCode', 'description', 'unitPrice', 'vatRateCode'].forEach((k) => g.get(k)!.disable());
      if (o.unit) {
        // Serial: una unidad = cantidad fija en 1.
        g.get('quantity')!.disable();
      } else {
        // Por lote: no se puede pasar de lo disponible.
        g.get('quantity')!.addValidators(Validators.max(o.lot.available));
      }
    }
    return g;
  }

  /** Línea manual (sin producto del sistema): va a la factura y es totalmente editable. */
  addManualLine() {
    this.lines.push(this.newLine());
  }

  removeLine(i: number) {
    this.lines.removeAt(i);
  }

  // ---------- Productos: QR y búsqueda escrita ----------

  onScan(label: ScannedLabel) {
    // (PENDIENTE) confirmar el formato del QR en labels/. Hoy se asume label.batch = número de lote.
    const lot = Number.parseInt(String(label.batch ?? ''), 10);
    this.lookup({
      q: label.sku,
      source: 'SCANNER',
      lotCode: Number.isInteger(lot) && lot >= 1 ? lot : undefined,
    });
  }

  onSearch(term: string) {
    this.lookup({ q: term, source: 'MANUAL' });
  }

  private lookup(query: SaleSearchQuery) {
    this.lookupSub?.unsubscribe(); // cancela la petición anterior (aborta el XHR)
    this.notice.set(null);
    this.error.set(null);
    this.candidates.set([]);
    this.looking.set(true);

    this.lookupSub = this.sales.search(query).subscribe({
      next: (res) => {
        this.looking.set(false);
        const options = this.toOptions(res);
        if (options.length === 0) this.notice.set('Sin resultados.');
        else if (options.length === 1) this.addOption(options[0]);
        else this.candidates.set(options);
      },
      error: (err) => {
        this.looking.set(false);
        // El gateway ya manda el mensaje en español: se muestra tal cual.
        const msg = err?.error?.message;
        this.error.set((Array.isArray(msg) ? msg.join(', ') : msg) ?? 'No se pudo consultar el producto.');
      },
    });
  }

  /** SERIAL → una opción por unidad; QUANTITY → una por lote (ya vienen del más antiguo al más nuevo). */
  private toOptions(res: SaleSearchResponse): SaleOption[] {
    const options: SaleOption[] = [];
    for (const item of res) {
      for (const lot of item.lots) {
        if (item.product.trackingMode === 'SERIAL') {
          for (const unit of lot.units) {
            options.push({ key: unit.unitId, product: item.product, lot, unit });
          }
        } else {
          options.push({ key: lot.lotId, product: item.product, lot, unit: null });
        }
      }
    }
    return options;
  }

  addOption(o: SaleOption) {
    this.candidates.set([]);
    const rows = (this.value().lines ?? []) as any[];
    const idx = rows.findIndex((l) =>
      o.unit ? l.unitId === o.unit.unitId : !l.unitId && l.lotId === o.lot.lotId,
    );

    if (idx < 0) {
      this.lines.push(this.newLine(o));
      return;
    }
    if (o.unit) {
      this.notice.set('Esa unidad ya está en el detalle.');
      return;
    }
    const q = this.lines.at(idx).get('quantity')!;
    if (Number(q.value) + 1 > o.lot.available) {
      this.notice.set(`El lote #${o.lot.code} solo tiene ${o.lot.available} disponibles.`);
      return;
    }
    q.setValue(Number(q.value) + 1);
  }

  // ---------- Comprador ----------

  /** Se llama en cada tecla del buscador de comprador. */
  onBuyerInput(term: string) {
    this.notice.set(null);
    this.buyerTerm$.next(term);
  }

  /** Enter: elige el primer resultado, si lo hay. */
  pickFirstBuyer() {
    const first = this.buyerResults()[0];
    if (first) this.selectBuyer(first);
  }

  /** Abre el diálogo de clientes para crear uno nuevo. */
  newBuyer() {
    this.notice.set(null);
    this.dialog
      .open<BillingDialogResult>(ClientBillingDialog, {
        /* (ASUMIDO) data/config del diálogo: ajusta con client-billing-dialog.ts */
      })
      .closed.subscribe((res) => {
        if (res?.client) this.selectBuyer(toBuyer(res.client));
      });
  }

  selectBuyer(b: Buyer) {
    this.buyerResults.set([]);
    this.buyerEmpty.set(false);
    this.setBuyer(b);
  }

  useFinalConsumer() {
    this.selectBuyer({
      idTypeCode: '07',
      idNumber: '9999999999999',
      name: 'CONSUMIDOR FINAL',
      address: '',
      email: '',
    });
  }

  /** Vuelve a la barra de búsqueda para elegir otro comprador. */
  clearBuyer() {
    this.buyer.set(null);
    this.buyerResults.set([]);
    this.buyerEmpty.set(false);
    this.form.patchValue({
      buyerIdTypeCode: '05',
      buyerIdNumber: '',
      buyerName: '',
      buyerAddress: '',
      buyerEmail: '',
    });
  }

  private setBuyer(b: Buyer) {
    this.buyer.set(b);
    this.form.patchValue({
      buyerIdTypeCode: b.idTypeCode,
      buyerIdNumber: b.idNumber,
      buyerName: b.name,
      buyerAddress: b.address,
      buyerEmail: b.email,
    });
  }

  idTypeName(code: string): string {
    return this.idTypes().find((t) => t.code === code)?.name ?? code;
  }

  rateLabel(r: VatRateOption): string {
    return r.name;
  }

  // ---------- Guardar ----------

  private validate(): string | null {
    const p = this.preview();
    if (p.invoice.count + p.receipt.count === 0) return 'Agrega al menos un producto.';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return 'Revisa los campos marcados.';
    }
    if (p.invoice.count > 0) {
      const v = this.form.getRawValue();
      if (!this.buyer() || !v.buyerIdNumber.trim() || !v.buyerName.trim()) {
        return 'Selecciona un comprador con identificación y nombre para la factura.';
      }
      if (this.rates().length === 0) return 'No hay tarifas de IVA cargadas.';
      if (p.invoice.totalCents <= 0) return 'El total de la factura debe ser mayor a cero.';
      if (v.buyerIdTypeCode === '07' && p.invoice.totalCents > 5000)
        this.notice.set('Consumidor final: el SRI limita el monto; verifica el tope vigente.');
    }
    return null;
  }

  save() {
    if (this.saving()) return;
    const problem = this.validate();
    if (problem) {
      this.error.set(problem);
      return;
    }
    this.error.set(null);

    // getRawValue incluye los controles deshabilitados (líneas bloqueadas).
    const v = this.form.getRawValue();
    const branchId = (this.auth.user() as any)?.branchId as string | undefined;
    if (!branchId) {
      this.error.set('Tu sesión no tiene sucursal asignada.');
      return;
    }
    this.saving.set(true);

    const opt = (s: string) => s.trim() || undefined;
    const all = v.lines as any[];
    const billable = all.filter((l) => l.billable);
    const rest = all.filter((l) => !l.billable);
    const p = this.preview();
    /** La fecha de emisión es la del momento de guardar; no se elige. */
    const issueDate = todayLocal();

    const invoice$ = billable.length
      ? this.api.create({
          clientRequestId: this.invoiceRequestId,
          branchId,
          issueDate,
          buyerIdTypeCode: v.buyerIdTypeCode as CreateInvoiceRequest['buyerIdTypeCode'],
          buyerIdNumber: v.buyerIdNumber.trim(),
          buyerName: v.buyerName.trim(),
          buyerAddress: opt(v.buyerAddress),
          buyerEmail: opt(v.buyerEmail),
          lines: billable.map((l) => ({
            mainCode: l.mainCode.trim(),
            description: l.description.trim(),
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
            discountId: l.discountId || undefined,
            vatRateCode: l.vatRateCode,
          })),
          payments: [
            {
              methodCode: v.paymentMethod as CreateInvoiceRequest['payments'][number]['methodCode'],
              amount: Number(p.invoice.total),
            },
          ],
        } as CreateInvoiceRequest)
      : of(null);

    const receipt$ = rest.length
      ? this.sales.createReceipt({
          clientRequestId: this.receiptRequestId,
          branchId,
          issueDate,
          buyerIdNumber: opt(v.buyerIdNumber),
          buyerName: opt(v.buyerName),
          paymentMethod: v.paymentMethod,
          total: Number(p.receipt.total),
          lines: rest.map((l) => ({
            productId: opt(l.productId),
            lotId: opt(l.lotId),
            unitId: opt(l.unitId),
            mainCode: l.mainCode.trim(),
            batch: opt(l.batch),
            description: l.description.trim(),
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
            discountId: l.discountId || undefined,
          })),
        } satisfies CreateSaleReceiptRequest)
      : of(null);

    // Ambos llevan clientRequestId: si uno falla, reintentar no duplica el otro.
    forkJoin([invoice$, receipt$]).subscribe({
      next: () => this.router.navigate(['/facturas']),
      error: (err) => {
        const msg = err?.error?.message;
        this.error.set(
          (Array.isArray(msg) ? msg.join(', ') : msg) ?? 'No se pudo guardar. Puedes reintentar sin duplicar.',
        );
        this.saving.set(false);
      },
    });
  }

  invalid(c: any): boolean {
    return !!c && c.invalid && c.touched;
  }

  /** Abre el diálogo, agrega el descuento al selector y lo selecciona en las líneas sin descuento. */
  newDiscount() {
    this.dialog.open<DiscountOption>(DiscountDialog).closed.subscribe((d) => {
      if (!d) return;
      this.discounts.update((list) => [...list, d]);
      for (const line of this.lines.controls) {
        const ctrl = line.get('discountId')!;
        if (!ctrl.value) ctrl.setValue(d.id);
      }
    });
  }
}