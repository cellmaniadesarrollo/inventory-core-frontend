import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ProductsService } from '../../services/products.service';
import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { AuditEntry, BillingMode, CompatModel, NewDataResponse, PageMeta, ProductDetail, UpdateProductRequest } from '../../types/product.types';
import { ModelPicker } from '../model-picker/model-picker';
import { ImageLightboxDialog, LightboxData } from '../../../../shared/components/image-lightbox-dialog/image-lightbox-dialog';
import { CameraDialog } from '../../../../shared/components/camera-dialog/camera-dialog';


// 1. Tipos base
type EditKey =
  | 'name' | 'color' | 'quality' | 'upc' | 'description' | 'minStock' | 'warrantyDays'
  | 'basePrice' | 'hasTax' | 'billingMode' | 'billableInRepairOrders' | 'usages' | 'models';

type FieldKind = 'select' | 'text' | 'textarea' | 'number' | 'bool' | 'billing' | 'usages' | 'models';

interface Field { key: EditKey; label: string; kind: FieldKind; full?: boolean }

/** Imagen en espera de confirmación (aún no subida) */
interface PendingImage { file: File; url: string }

// 2. FIELDS primero
const FIELDS: Field[] = [
  { key: 'name', label: 'Nombre', kind: 'select' },
  { key: 'color', label: 'Color', kind: 'select' },
  { key: 'quality', label: 'Calidad', kind: 'select' },
  { key: 'upc', label: 'Código de barras (UPC)', kind: 'text' },
  { key: 'description', label: 'Descripción', kind: 'textarea', full: true },
  { key: 'basePrice', label: 'Precio base', kind: 'number' },
  { key: 'minStock', label: 'Stock mínimo', kind: 'number' },
  { key: 'warrantyDays', label: 'Garantía (días)', kind: 'number' },
  { key: 'billingMode', label: 'Facturación', kind: 'billing' },
  { key: 'hasTax', label: 'Incluye impuesto', kind: 'bool' },
  { key: 'billableInRepairOrders', label: 'Facturable en reparaciones', kind: 'bool' },
  { key: 'usages', label: 'Usos', kind: 'usages', full: true },
  { key: 'models', label: 'Modelos compatibles', kind: 'models', full: true },
];

// 3. Lo que depende de FIELDS
const field = (k: EditKey) => FIELDS.find(f => f.key === k)!;

const ICONS = {
  tag: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3zM6 6h.008v.008H6V6z',
  money: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z',
  box: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  doc: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  grid: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
  cube: 'M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9',
  photo: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
  clock: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  info: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z',
  plus: 'M12 4.5v15m7.5-7.5h-15',
  pencil: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125',
  star: 'M11.48 3.5a.56.56 0 011.04 0l2.13 5.11a.56.56 0 00.47.35l5.52.44c.5.04.7.66.32.99l-4.2 3.6a.56.56 0 00-.18.56l1.28 5.39a.56.56 0 01-.84.61l-4.73-2.89a.56.56 0 00-.59 0l-4.73 2.89a.56.56 0 01-.84-.61l1.28-5.39a.56.56 0 00-.18-.56l-4.2-3.6a.56.56 0 01.32-.99l5.52-.44a.56.56 0 00.47-.35L11.48 3.5z',
  trash: 'M14.74 9l-.35 9m-4.78 0L9.26 9m9.97-3.21c.34.05.68.11 1.02.17m-1.02-.17L18.16 19.67a2.25 2.25 0 01-2.24 2.08H8.08a2.25 2.25 0 01-2.24-2.08L4.77 5.79m14.46 0a48.11 48.11 0 00-3.48-.4m-12 .56c.34-.06.68-.12 1.02-.17m0 0a48.11 48.11 0 013.48-.4m7.5 0v-.92c0-1.18-.91-2.16-2.09-2.2a51.96 51.96 0 00-3.32 0c-1.18.04-2.09 1.02-2.09 2.2v.92m7.5 0a48.67 48.67 0 00-7.5 0',
} as const;

type IconName = keyof typeof ICONS;

interface Section { title: string; icon: IconName; fields: Field[]; wide?: boolean }

const SECTIONS: Section[] = [
  { title: 'Identificación', icon: 'tag', fields: [field('name'), field('color'), field('quality'), field('upc')] },
  { title: 'Precio y facturación', icon: 'money', fields: [field('basePrice'), field('billingMode'), field('hasTax'), field('billableInRepairOrders')] },
  { title: 'Inventario', icon: 'box', fields: [field('minStock'), field('warrantyDays')] },
  { title: 'Usos', icon: 'grid', fields: [field('usages')] },
  { title: 'Descripción', icon: 'doc', fields: [field('description')], wide: true },
];

// 4. El resto (no dependen de FIELDS / SECTIONS)
const ACTION_STYLES: Record<string, { dot: string; badge: string }> = {
  CREATED: { dot: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  UPDATED: { dot: 'bg-primary', badge: 'bg-primary-soft text-primary' },
  DELETED: { dot: 'bg-red-500', badge: 'bg-red-500/15 text-red-600 dark:text-red-400' },
};

const BILLING_LABELS: Record<string, string> = { yes: 'Sí', no: 'No', optional: 'Opcional' };

const ACTION_LABELS: Record<string, string> = {
  CREATED: 'Creado', UPDATED: 'Modificado', DELETED: 'Eliminado',
};

const FIELD_LABELS: Record<string, string> = {
  productNameId: 'Nombre', colorId: 'Color', qualityId: 'Calidad', upc: 'UPC',
  description: 'Descripción', basePrice: 'Precio base', minStock: 'Stock mínimo',
  warrantyDays: 'Garantía (días)', billingMode: 'Facturación', hasTax: 'Impuesto',
  billableInRepairOrders: 'Facturable en reparaciones', modelIds: 'Modelos',
  usageIds: 'Usos', status: 'Activo', code: 'Código', sku: 'SKU',
};

type TabId = 'data' | 'stock' | 'history';

const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'data', label: 'Datos', icon: 'info' },
  { id: 'stock', label: 'Inventario', icon: 'box' },
  { id: 'history', label: 'Historial', icon: 'clock' },
];

const STOCK_LABELS: Record<string, string> = { OUT: 'Sin stock', LOW: 'Stock bajo', OK: 'Con stock' };

const STOCK_CLASSES: Record<string, string> = {
  OUT: 'bg-red-500/15 text-red-600 dark:text-red-400',
  LOW: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  OK: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};

const ORIGIN_LABELS: Record<string, string> = { RECEIPT: 'Recepción' };

const UNIT_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Disponible', SOLD: 'Vendida', RESERVED: 'Reservada',
};

const MOVEMENT_LABELS: Record<string, string> = { RECEIPT_IN: 'Entrada por recepción' };
@Component({
  imports: [DatePipe, ModelPicker],
  selector: 'app-product-detail-dialog',
  styleUrl: './product-detail-dialog.css',
  templateUrl: './product-detail-dialog.html',
})
export class ProductDetailDialog {
  private readonly service = inject(ProductsService);
  private readonly dialogRef = inject(DialogRef<boolean>);
  private readonly dialog = inject(Dialog);
  private readonly input = inject<{ id: string }>(DIALOG_DATA);

  // Constantes para la plantilla
  readonly fields = FIELDS;
  readonly icons = ICONS;
  readonly sections = SECTIONS;
  readonly tabs = TABS;

  // Estado general
  readonly detail = signal<ProductDetail | null>(null);
  readonly options = signal<NewDataResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly tab = signal<TabId>('data');

  // Edición en línea
  readonly editing = signal<EditKey | null>(null);
  readonly draft = signal<any>(null);
  readonly confirming = signal(false);
  readonly saving = signal(false);
  readonly fieldError = signal<string | null>(null);

  // Historial
  readonly entries = signal<AuditEntry[]>([]);
  readonly historyMeta = signal<PageMeta | null>(null);
  readonly loadingMore = signal(false);

  // Eliminar producto
  readonly confirmingDelete = signal(false);
  readonly deleting = signal(false);

  // Imágenes existentes
  readonly imageBusyId = signal<string | null>(null);
  readonly confirmingImageDeleteId = signal<string | null>(null);

  // Imágenes nuevas (selector, arrastrar y cámara) pendientes de confirmar
  readonly uploadingImages = signal(false);
  readonly pending = signal<PendingImage[]>([]);
  readonly confirmingUpload = signal(false);
  readonly dragging = signal(false);

  private readonly MAX_IMAGE_BYTES = 5 * 1024 * 1024; // ajusta a tu MAX_IMAGE_SIZE del backend
  private changed = false;

  readonly inactive = computed(() => this.detail()?.status === false);
  readonly hasMore = computed(() => {
    const m = this.historyMeta();
    return !!m && m.page < m.totalPages;
  });

  // Imagen de portada para la cabecera
  readonly cover = computed(() => {
    const imgs = this.detail()?.images ?? [];
    return imgs.find(i => i.isPrimary) ?? imgs[0] ?? null;
  });

  constructor() {
    this.reload();
    // Libera las URLs blob de las vistas previas al cerrar el diálogo
    inject(DestroyRef).onDestroy(() => this.pending().forEach(p => URL.revokeObjectURL(p.url)));
  }

  // ===== Carga =====
  private reload() {
    this.service.getOne(this.input.id).subscribe({
      next: d => {
        this.detail.set(d);
        this.entries.set(d.history.items);
        this.historyMeta.set(d.history.meta);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.error.set(this.message(err, 'No se pudo cargar el producto'));
      },
    });
  }

  loadMoreHistory() {
    const m = this.historyMeta();
    if (!m || this.loadingMore()) return;
    this.loadingMore.set(true);
    this.service.history(this.input.id, m.page + 1, m.limit).subscribe({
      next: r => {
        this.entries.update(list => [...list, ...r.items]);
        this.historyMeta.set(r.meta);
        this.loadingMore.set(false);
      },
      error: () => this.loadingMore.set(false),
    });
  }

  // ===== Valor mostrado =====
  display(key: EditKey): string {
    const d = this.detail();
    if (!d) return '';
    const dash = '—';
    switch (key) {
      case 'name': return d.name.name;
      case 'color': return d.color?.name ?? dash;
      case 'quality': return d.quality?.name ?? dash;
      case 'upc': return d.upc ?? dash;
      case 'description': return d.description ?? dash;
      case 'basePrice': return Number(d.basePrice).toFixed(2);
      case 'minStock': return String(d.minStock);
      case 'warrantyDays': return String(d.warrantyDays);
      case 'billingMode': return BILLING_LABELS[d.billingMode] ?? d.billingMode;
      case 'hasTax': return d.hasTax ? 'Sí' : 'No';
      case 'billableInRepairOrders': return d.billableInRepairOrders ? 'Sí' : 'No';
      case 'usages': return d.usages.map(u => u.name).join(', ') || dash;
      case 'models': return d.models.map(m => `${m.brandName} · ${m.name}`).join(', ') || dash;
    }
  }

  // ===== Edición en línea =====
  startEdit(key: EditKey) {
    const d = this.detail();
    if (!d || this.inactive()) return;

    // Los catálogos se cargan solo la primera vez que se edita
    if (!this.options()) {
      this.service.getNewData().subscribe({
        next: o => this.options.set(o),
        error: err => this.fieldError.set(this.message(err, 'No se pudieron cargar las opciones')),
      });
    }

    const initial: Record<EditKey, any> = {
      name: d.name.id,
      color: d.color?.id ?? '',
      quality: d.quality?.id ?? '',
      upc: d.upc ?? '',
      description: d.description ?? '',
      basePrice: Number(d.basePrice),
      minStock: d.minStock,
      warrantyDays: d.warrantyDays,
      billingMode: d.billingMode,
      hasTax: d.hasTax,
      billableInRepairOrders: d.billableInRepairOrders,
      usages: d.usages.map(u => u.id),
      models: d.models.map(m => ({ ...m })),
    };
    this.editing.set(key);
    this.draft.set(initial[key]);
    this.confirming.set(false);
    this.fieldError.set(null);
  }

  cancelEdit() {
    this.editing.set(null);
    this.confirming.set(false);
    this.fieldError.set(null);
  }

  setDraft(value: any) {
    this.draft.set(value);
    this.confirming.set(false);
  }

  toggleUsage(id: string) {
    this.draft.update((list: string[]) =>
      list.includes(id) ? list.filter(x => x !== id) : [...list, id],
    );
    this.confirming.set(false);
  }

  /** Primer clic en Guardar: valida y pide confirmación. */
  askConfirm() {
    const err = this.validate(this.editing()!);
    this.fieldError.set(err);
    if (!err) this.confirming.set(true);
  }

  private validate(key: EditKey): string | null {
    const v = this.draft();
    switch (key) {
      case 'name': return v ? null : 'Selecciona un nombre';
      case 'usages': return v.length ? null : 'Selecciona al menos un uso';
      case 'upc': return String(v).length > 100 ? 'Máximo 100 caracteres' : null;
      case 'basePrice':
      case 'minStock':
      case 'warrantyDays':
        return Number.isFinite(Number(v)) && Number(v) >= 0 ? null : 'Debe ser un número mayor o igual a 0';
      default: return null;
    }
  }

  private buildPatch(key: EditKey): UpdateProductRequest {
    const v = this.draft();
    switch (key) {
      case 'name': return { productNameId: v };
      case 'color': return { colorId: v || null };
      case 'quality': return { qualityId: v || null };
      case 'upc': return { upc: String(v).trim() || null };
      case 'description': return { description: String(v).trim() || null };
      case 'basePrice': return { basePrice: Math.round(Number(v) * 100) / 100 };
      case 'minStock': return { minStock: Math.floor(Number(v)) };
      case 'warrantyDays': return { warrantyDays: Math.floor(Number(v)) };
      case 'billingMode': return { billingMode: v as BillingMode };
      case 'hasTax': return { hasTax: !!v };
      case 'billableInRepairOrders': return { billableInRepairOrders: !!v };
      case 'usages': return { usageIds: v };
      case 'models': return { modelIds: v.map((m: CompatModel) => m.id) };
    }
  }

  /** Segundo clic: confirma y envía solo ese campo. */
  confirmSave() {
    const key = this.editing();
    if (!key || this.saving()) return;
    this.saving.set(true);
    this.fieldError.set(null);

    this.service.update(this.input.id, this.buildPatch(key)).subscribe({
      next: () => {
        this.saving.set(false);
        this.changed = true;
        this.cancelEdit();
        this.flash('Cambio guardado');
        this.reload(); // refresca datos e historial
      },
      error: err => {
        this.saving.set(false);
        this.confirming.set(false);
        this.fieldError.set(this.message(err, 'No se pudo guardar el cambio'));
      },
    });
  }

  // ===== Eliminar producto =====
  confirmDelete() {
    if (this.deleting()) return;
    this.deleting.set(true);
    this.service.remove(this.input.id).subscribe({
      next: () => this.dialogRef.close(true),
      error: err => {
        this.deleting.set(false);
        this.confirmingDelete.set(false);
        this.error.set(this.message(err, 'No se pudo eliminar el producto'));
      },
    });
  }

  // ===== Historial: textos =====
  actionLabel(a: string) { return ACTION_LABELS[a] ?? a; }
  fieldLabel(k: string) { return FIELD_LABELS[k] ?? k; }
  actionStyle(a: string) { return ACTION_STYLES[a] ?? ACTION_STYLES['UPDATED']; }

  changeKeys(e: AuditEntry): string[] {
    return e.changes ? Object.keys(e.changes) : [];
  }

  formatValue(key: string, v: unknown): string {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    if (key === 'billingMode') return BILLING_LABELS[String(v)] ?? String(v);
    if (key === 'usageIds' && Array.isArray(v)) {
      const names = new Map<string, string>([
        ...(this.options()?.usages ?? []).map(u => [u.id, u.name] as [string, string]),
        ...(this.detail()?.usages ?? []).map(u => [u.id, u.name] as [string, string]),
      ]);
      return v.map(id => names.get(String(id)) ?? 'uso eliminado').join(', ') || '—';
    }
    if (Array.isArray(v)) return v.join(', ') || '—';
    return String(v);
  }

  // ===== Imágenes: agregar (selector, arrastrar y cámara) con confirmación =====

  /** Punto único de entrada: selector, drop y cámara pasan por aquí. */
  private addFiles(files: File[]) {
    if (!files.length || this.uploadingImages() || this.inactive()) return;

    const valid = files.filter(f => f.type.startsWith('image/') && f.size <= this.MAX_IMAGE_BYTES);
    const rejected = files.length - valid.length;
    this.error.set(rejected ? `${rejected} archivo(s) no son imágenes válidas o superan el tamaño máximo` : null);

    if (valid.length) {
      this.pending.update(list => [
        ...list,
        ...valid.map(file => ({ file, url: URL.createObjectURL(file) })),
      ]);
      this.confirmingUpload.set(false);
    }
  }

  onImagesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = ''; // permite volver a elegir el mismo archivo
    this.addFiles(files);
  }

  openCamera() {
    if (this.inactive() || this.uploadingImages()) return;
    this.dialog
      .open<File>(CameraDialog, { autoFocus: false, backdropClass: 'bg-black/80' })
      .closed.subscribe(file => { if (file) this.addFiles([file]); });
  }

  // Drag & drop
  onDragOver(e: DragEvent) {
    if (this.inactive() || this.uploadingImages() || !e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    this.dragging.set(true);
  }

  onDragLeave(e: DragEvent) {
    // Ignora los dragleave al pasar sobre elementos hijos
    if (!(e.currentTarget as Node).contains(e.relatedTarget as Node)) this.dragging.set(false);
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.dragging.set(false);
    this.addFiles(Array.from(e.dataTransfer?.files ?? []));
  }

  removePending(index: number) {
    this.pending.update(list => {
      URL.revokeObjectURL(list[index].url);
      return list.filter((_, i) => i !== index);
    });
    this.confirmingUpload.set(false);
  }

  cancelPending() {
    this.pending().forEach(p => URL.revokeObjectURL(p.url));
    this.pending.set([]);
    this.confirmingUpload.set(false);
  }

  /** Segundo clic: sube todo lo pendiente. */
  confirmUpload() {
    const files = this.pending().map(p => p.file);
    if (!files.length || this.uploadingImages()) return;

    this.uploadingImages.set(true);
    this.error.set(null);
    this.service.addImages(this.input.id, files).subscribe({
      next: () => {
        this.uploadingImages.set(false);
        this.cancelPending();
        this.changed = true;
        this.flash('Imágenes agregadas');
        this.reload();
      },
      error: err => {
        this.uploadingImages.set(false);
        this.confirmingUpload.set(false);
        this.error.set(this.message(err, 'No se pudieron subir las imágenes'));
      },
    });
  }

  // ===== Imágenes existentes =====
  makePrimary(imageId: string) {
    if (this.imageBusyId()) return;
    this.imageBusyId.set(imageId);
    this.service.setPrimaryImage(this.input.id, imageId).subscribe({
      next: () => {
        this.imageBusyId.set(null);
        this.changed = true;
        this.flash('Imagen principal actualizada');
        this.reload();
      },
      error: err => {
        this.imageBusyId.set(null);
        this.error.set(this.message(err, 'No se pudo cambiar la imagen principal'));
      },
    });
  }

  removeImage(imageId: string) {
    if (this.imageBusyId()) return;
    this.imageBusyId.set(imageId);
    this.service.removeImage(this.input.id, imageId).subscribe({
      next: () => {
        this.imageBusyId.set(null);
        this.confirmingImageDeleteId.set(null);
        this.changed = true;
        this.flash('Imagen eliminada');
        this.reload();
      },
      error: err => {
        this.imageBusyId.set(null);
        this.confirmingImageDeleteId.set(null);
        this.error.set(this.message(err, 'No se pudo eliminar la imagen'));
      },
    });
  }

  openImage(index: number) {
    const d = this.detail();
    if (!d) return;
    this.dialog.open<void, LightboxData>(ImageLightboxDialog, {
      data: {
        images: d.images.map(i => ({ url: i.url, fileName: i.fileName })),
        startIndex: index,
      },
      backdropClass: 'bg-black/80',
      panelClass: 'max-w-full',
      autoFocus: false,
    });
  }

  // ===== Utilidades =====
  close() { this.dialogRef.close(this.changed); }

  private flash(text: string) {
    this.notice.set(text);
    setTimeout(() => this.notice.set(null), 3000);
  }

  private message(err: unknown, fallback: string): string {
    const e = err as { status?: number; error?: { message?: string | string[] } };
    if (e.status === 0) return 'No se pudo conectar con el servidor';
    const msg = e.error?.message;
    return Array.isArray(msg) ? msg.join(', ') : (msg ?? fallback);
  }


  // ===== Inventario =====
  readonly unitStatuses = computed(() =>
    Object.entries(this.detail()?.units.byStatus ?? {}).map(([status, count]) => ({ status, count })),
  );

  stockLabel(s: string) { return STOCK_LABELS[s] ?? s; }
  stockClass(s: string) { return STOCK_CLASSES[s] ?? STOCK_CLASSES['OK']; }
  originLabel(o: string) { return ORIGIN_LABELS[o] ?? o; }
  unitStatusLabel(s: string) { return UNIT_STATUS_LABELS[s] ?? s; }
  movementLabel(t: string) { return MOVEMENT_LABELS[t] ?? t; }

  // Un solo precio si min = max; "—" si no hay existencias
  priceRange(min: string | null, max: string | null): string {
    if (min === null || max === null) return '—';
    const f = (v: string) => (Number.isNaN(Number(v)) ? v : Number(v).toFixed(2));
    return min === max ? f(min) : `${f(min)} – ${f(max)}`;
  }
}