import { DialogRef } from '@angular/cdk/dialog';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { ProductsService } from '../../services/products.service';
import {
  BillingMode,
  CreateProductRequest,
  CreateProductResponse,
  NewDataResponse,
  ProductModel,
  TrackingMode,
} from '../../types/product.types';
import { ImageUpload } from '../../../../shared/components/image-upload/image-upload';

interface BrandColor {
  chip: string;
  dot: string;
}

// Las clases van completas en el texto para que Tailwind las detecte
const BRAND_COLORS: BrandColor[] = [
  { chip: 'bg-blue-500/15 text-blue-700 ring-blue-500/30 dark:text-blue-300', dot: 'bg-blue-500' },
  { chip: 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300', dot: 'bg-emerald-500' },
  { chip: 'bg-violet-500/15 text-violet-700 ring-violet-500/30 dark:text-violet-300', dot: 'bg-violet-500' },
  { chip: 'bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300', dot: 'bg-amber-500' },
  { chip: 'bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300', dot: 'bg-rose-500' },
  { chip: 'bg-cyan-500/15 text-cyan-700 ring-cyan-500/30 dark:text-cyan-300', dot: 'bg-cyan-500' },
  { chip: 'bg-fuchsia-500/15 text-fuchsia-700 ring-fuchsia-500/30 dark:text-fuchsia-300', dot: 'bg-fuchsia-500' },
  { chip: 'bg-orange-500/15 text-orange-700 ring-orange-500/30 dark:text-orange-300', dot: 'bg-orange-500' },
];

export interface SelectedModel extends ProductModel {
  brandName: string;
  color: BrandColor;
}

@Component({
  imports: [ReactiveFormsModule, CdkOverlayOrigin, CdkConnectedOverlay, CdkScrollable, ImageUpload],
  selector: 'app-product-form-dialog',
  styleUrl: './product-form-dialog.css',
  templateUrl: './product-form-dialog.html',
})
export class ProductFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ProductsService);
  private readonly dialogRef = inject(DialogRef<CreateProductResponse>);

  // ===== Estado general =====
  readonly data = signal<NewDataResponse | null>(null);
  readonly loadingData = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  // ===== Formulario =====
  readonly form = this.fb.nonNullable.group({
    productNameId: ['', Validators.required],
    productTypeId: ['', Validators.required],
    colorId: [''],
    qualityId: [''],
    upc: ['', Validators.maxLength(100)],
    description: [''],
    trackingMode: ['QUANTITY' as TrackingMode],
    basePrice: [0, [Validators.min(0)]],
    hasTax: [true],
    billingMode: ['no' as BillingMode],
    billableInRepairOrders: [false],
  });

  private readonly typeId = toSignal(this.form.controls.productTypeId.valueChanges, {
    initialValue: '',
  });

  // Equipo completo: un solo modelo y seguimiento SERIAL
  readonly isDevice = computed(
    () => this.data()?.types.find(t => t.id === this.typeId())?.kind === 'DEVICE',
  );

  // ===== Modelos (combobox) =====
  readonly brandId = signal<number | null>(null);
  readonly brandName = computed(
    () => this.data()?.brands.find(b => b.id === this.brandId())?.name ?? '',
  );
  readonly brandColor = signal<BrandColor>(BRAND_COLORS[0]);
  private readonly brandColors = new Map<number, BrandColor>();

  readonly search = new FormControl('', { nonNullable: true });
  readonly models = signal<ProductModel[]>([]);
  readonly loadingModels = signal(false);
  readonly selected = signal<SelectedModel[]>([]);

  readonly open = signal(false);
  readonly activeIndex = signal(-1);
  readonly boxWidth = signal(0);

  private readonly box = viewChild<ElementRef<HTMLElement>>('box');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly overlay = viewChild(CdkConnectedOverlay);

  private modelsSub?: Subscription;
  private scrollBase = 0;
  private ignoreScrollUntil = 0;

  readonly images = signal<File[]>([]);
  // Lista flotante: debajo del campo; si no cabe, arriba
  readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  ];

  constructor() {
    this.service.getNewData().subscribe({
      next: d => {
        this.data.set(d);
        const sellable = d.usages.find(u => u.code === 'SELLABLE');
        if (sellable) this.selectedUsageIds.set([sellable.id]);
        this.loadingData.set(false);
      },
      error: err => {
        this.loadingData.set(false);
        this.error.set(this.message(err, 'No se pudieron cargar los datos iniciales'));
      },
    });

    // Búsqueda de modelos con debounce
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.loadModels());

    // Tipo DEVICE: seguimiento SERIAL bloqueado y un solo modelo
    effect(() => {
      const trackingMode = this.form.controls.trackingMode;
      if (this.isDevice()) {
        trackingMode.setValue('SERIAL');
        trackingMode.disable({ emitEvent: false });
        this.selected.update(list => list.slice(0, 1));
      } else {
        trackingMode.enable({ emitEvent: false });
      }
    });

    // Recalcula la posición del panel cuando cambia su contenido (arriba o abajo)
    effect(() => {
      this.models();
      this.loadingModels();
      this.open();
      setTimeout(() => this.overlay()?.overlayRef?.updatePosition());
    });
  }

  // ===== Marca y carga de modelos =====
  private colorFor(brandId: number): BrandColor {
    let color = this.brandColors.get(brandId);
    if (!color) {
      color = BRAND_COLORS[this.brandColors.size % BRAND_COLORS.length];
      this.brandColors.set(brandId, color);
    }
    return color;
  }

  onBrandChange(value: string) {
    const id = value ? Number(value) : null;
    this.brandId.set(id);
    this.search.setValue('', { emitEvent: false });
    this.closePanel();

    if (id === null) {
      this.models.set([]);
      return;
    }
    this.brandColor.set(this.colorFor(id));
    this.loadModels(); // precarga; el panel se abre solo al hacer focus en el campo
  }

  private loadModels() {
    this.modelsSub?.unsubscribe();
    const id = this.brandId();
    if (id === null) {
      this.models.set([]);
      return;
    }
    this.loadingModels.set(true);
    this.modelsSub = this.service.getModels(id, this.search.value.trim() || undefined).subscribe({
      next: list => {
        this.models.set(list);
        this.activeIndex.set(list.length ? 0 : -1);
        this.loadingModels.set(false);
      },
      error: () => this.loadingModels.set(false),
    });
  }

  // ===== Panel flotante =====
  focusSearch() {
    this.searchInput()?.nativeElement.focus();
    this.openPanel();
  }

  openPanel() {
    if (this.brandId() === null) return;
    this.boxWidth.set(this.box()?.nativeElement.offsetWidth ?? 0);
    if (!this.open()) {
      this.rebaseScroll();
      this.open.set(true);
    }
  }

  closePanel() {
    this.open.set(false);
    this.activeIndex.set(-1);
  }

  // Si el overlay se desconecta sin que lo cerremos nosotros, cerramos y quitamos el foco
  onDetach() {
    if (!this.open()) return;
    this.closePanel();
    this.searchInput()?.nativeElement.blur();
  }

  onOutsideClick(e: MouseEvent) {
    if (!this.box()?.nativeElement.contains(e.target as Node)) this.closePanel();
  }

  // Guarda la posición de scroll actual e ignora los scrolls causados por la propia UI
  private rebaseScroll() {
    this.scrollBase = this.scroller()?.nativeElement.scrollTop ?? 0;
    this.ignoreScrollUntil = Date.now() + 300;
  }

  // Scroll del usuario en el cuerpo del modal: cierra la lista y quita el foco del input
  onModalScroll(e: Event) {
    if (!this.open()) return;
    const top = (e.target as HTMLElement).scrollTop;
    if (Date.now() < this.ignoreScrollUntil) {
      this.scrollBase = top;
      return;
    }
    if (Math.abs(top - this.scrollBase) > 8) {
      this.closePanel();
      this.searchInput()?.nativeElement.blur();
    }
  }

  onKeydown(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.open()) this.openPanel();
        this.moveActive(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.moveActive(-1);
        break;
      case 'Enter': {
        e.preventDefault(); // evita enviar el formulario
        const m = this.models()[this.activeIndex()];
        if (this.open() && m) this.toggleModel(m);
        break;
      }
      case 'Escape':
        if (this.open()) {
          e.preventDefault();
          e.stopPropagation(); // cierra la lista, no el modal
          this.closePanel();
        }
        break;
      case 'Tab':
        this.closePanel();
        break;
      case 'Backspace': {
        const list = this.selected();
        if (!this.search.value && list.length) this.removeModel(list[list.length - 1].id);
        break;
      }
    }
  }

  private moveActive(delta: number) {
    const n = this.models().length;
    if (!n) return;
    const i = this.activeIndex();
    const next = i < 0 ? (delta > 0 ? 0 : n - 1) : (i + delta + n) % n;
    this.activeIndex.set(next);
    setTimeout(() =>
      document.getElementById('model-opt-' + this.models()[next]?.id)?.scrollIntoView({ block: 'nearest' }),
    );
  }

  // ===== Selección de modelos =====
  isSelected(m: ProductModel) {
    return this.selected().some(s => s.id === m.id);
  }

  toggleModel(m: ProductModel) {
    this.rebaseScroll();
    if (this.isSelected(m)) {
      this.removeModel(m.id);
    } else {
      const item: SelectedModel = { ...m, brandName: this.brandName(), color: this.brandColor() };
      if (this.isDevice()) {
        this.selected.set([item]);
        this.closePanel();
      } else {
        this.selected.update(list => [...list, item]);
      }
    }
    this.searchInput()?.nativeElement.focus({ preventScroll: true });
  }

  removeModel(id: number) {
    this.rebaseScroll();
    this.selected.update(list => list.filter(s => s.id !== id));
  }

  // ===== Guardado =====
  submit() {
    this.usagesTouched.set(true);
    if (this.form.invalid || this.saving() || this.selectedUsageIds().length === 0) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.isDevice() && this.selected().length !== 1) {
      this.error.set('Un equipo completo debe tener exactamente un modelo');
      return;
    }

    const v = this.form.getRawValue();
    const body: CreateProductRequest = {
      productNameId: v.productNameId,
      productTypeId: v.productTypeId,
      colorId: v.colorId || undefined,
      qualityId: v.qualityId || undefined,
      upc: v.upc.trim() || undefined,
      description: v.description.trim() || undefined,
      trackingMode: v.trackingMode,
      basePrice: Math.round((Number(v.basePrice) || 0) * 100) / 100,
      hasTax: v.hasTax,
      billingMode: v.billingMode,
      billableInRepairOrders: v.billableInRepairOrders,
      usageIds: this.selectedUsageIds(),
      modelIds: this.selected().map(m => m.id),
    };

    this.saving.set(true);
    this.error.set(null);

    this.service.create(body, this.images()).subscribe({
      next: res => this.dialogRef.close(res),
      error: err => {
        this.saving.set(false);
        this.error.set(this.message(err, 'No se pudo guardar el producto'));
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


  // ===== Usos =====
  readonly selectedUsageIds = signal<string[]>([]);
  readonly usagesTouched = signal(false);
  readonly usagesInvalid = computed(() => this.usagesTouched() && this.selectedUsageIds().length === 0);

  isUsageSelected(id: string) {
    return this.selectedUsageIds().includes(id);
  }

  toggleUsage(id: string) {
    this.usagesTouched.set(true);
    this.selectedUsageIds.update(list =>
      list.includes(id) ? list.filter(x => x !== id) : [...list, id],
    );
  }
}