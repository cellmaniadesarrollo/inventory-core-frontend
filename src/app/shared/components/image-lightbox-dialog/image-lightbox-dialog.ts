import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';

export interface LightboxImage {
  url: string;
  fileName: string;
}

export interface LightboxData {
  images: LightboxImage[];
  startIndex: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const BUTTON_STEP = 0.5;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
const TAP_MOVE_TOLERANCE = 6;
const SWIPE_MIN_DISTANCE = 60;

@Component({
  imports: [],
  selector: 'app-image-lightbox-dialog',
  styleUrl: './image-lightbox-dialog.css',
  templateUrl: './image-lightbox-dialog.html',
  host: { '(window:keydown)': 'onKeydown($event)' },
})
export class ImageLightboxDialog {
  private readonly dialogRef = inject(DialogRef);
  readonly data = inject<LightboxData>(DIALOG_DATA);

  private readonly wrapperRef = viewChild.required<ElementRef<HTMLElement>>('wrapper');
  private readonly imgRef = viewChild.required<ElementRef<HTMLImageElement>>('img');

  readonly currentIndex = signal(this.data.startIndex ?? 0);
  readonly downloading = signal(false);

  readonly scale = signal(1);
  readonly tx = signal(0);
  readonly ty = signal(0);
  readonly smooth = signal(false); // solo en botones y doble tap, nunca durante gestos

  readonly currentImage = computed(() => this.data.images[this.currentIndex()]);
  readonly hasMultiple = this.data.images.length > 1;
  readonly transform = computed(() => `translate(${this.tx()}px, ${this.ty()}px) scale(${this.scale()})`);
  readonly zoomLabel = computed(() => `${Math.round(this.scale() * 100)}%`);
  readonly canZoomIn = computed(() => this.scale() < MAX_SCALE);
  readonly canZoomOut = computed(() => this.scale() > MIN_SCALE);

  // Estado de gestos (no necesita ser reactivo)
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchStartDist = 0;
  private pinchStartScale = 1;
  private downPos = { x: 0, y: 0 };
  private moved = false;
  private multiTouch = false;
  private lastTapTime = 0;
  private lastTapPos = { x: 0, y: 0 };

  // ===== Navegación =====
  anterior() {
    this.resetZoom(false);
    const total = this.data.images.length;
    this.currentIndex.update(i => (i === 0 ? total - 1 : i - 1));
  }

  siguiente() {
    this.resetZoom(false);
    this.currentIndex.update(i => (i + 1) % this.data.images.length);
  }

  cerrar() {
    this.dialogRef.close();
  }

  // ===== Zoom =====
  zoomIn() {
    this.smooth.set(true);
    this.zoomTo(this.scale() + BUTTON_STEP, 0, 0);
  }

  zoomOut() {
    this.smooth.set(true);
    this.zoomTo(this.scale() - BUTTON_STEP, 0, 0);
  }

  resetZoom(smooth = true) {
    this.smooth.set(smooth);
    this.scale.set(1);
    this.tx.set(0);
    this.ty.set(0);
  }

  /** Cambia la escala manteniendo fijo el punto (px, py) medido desde el centro del visor. */
  private zoomTo(newScale: number, px: number, py: number) {
    const next = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);
    const ratio = next / this.scale();
    this.tx.set(px - (px - this.tx()) * ratio);
    this.ty.set(py - (py - this.ty()) * ratio);
    this.scale.set(next);
    this.clampPan();
  }

  private clampPan() {
    if (this.scale() <= MIN_SCALE) {
      this.tx.set(0);
      this.ty.set(0);
      return;
    }
    const wrap = this.wrapperRef().nativeElement;
    const img = this.imgRef().nativeElement;
    const maxX = Math.max(0, (img.offsetWidth * this.scale() - wrap.clientWidth) / 2);
    const maxY = Math.max(0, (img.offsetHeight * this.scale() - wrap.clientHeight) / 2);
    this.tx.update(v => Math.min(Math.max(v, -maxX), maxX));
    this.ty.update(v => Math.min(Math.max(v, -maxY), maxY));
  }

  private toCenter(clientX: number, clientY: number) {
    const rect = this.wrapperRef().nativeElement.getBoundingClientRect();
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  }

  // ===== Rueda del mouse =====
  onWheel(event: WheelEvent) {
    event.preventDefault();
    this.smooth.set(false);
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    const p = this.toCenter(event.clientX, event.clientY);
    this.zoomTo(this.scale() * factor, p.x, p.y);
  }

  // ===== Gestos (Pointer Events) =====
  onPointerDown(event: PointerEvent) {
    this.wrapperRef().nativeElement.setPointerCapture(event.pointerId);
    this.smooth.set(false);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size === 1) {
      this.moved = false;
      this.multiTouch = false;
      this.downPos = { x: event.clientX, y: event.clientY };
    } else if (this.pointers.size === 2) {
      this.multiTouch = true;
      this.moved = true;
      this.pinchStartDist = this.pointerDistance();
      this.pinchStartScale = this.scale();
    }
  }

  onPointerMove(event: PointerEvent) {
    const prev = this.pointers.get(event.pointerId);
    if (!prev) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size === 2 && this.pinchStartDist > 0) {
      const mid = this.pointerMidpoint();
      const p = this.toCenter(mid.x, mid.y);
      this.zoomTo(this.pinchStartScale * (this.pointerDistance() / this.pinchStartDist), p.x, p.y);
      return;
    }

    if (this.pointers.size === 1) {
      const dist = Math.hypot(event.clientX - this.downPos.x, event.clientY - this.downPos.y);
      if (dist > TAP_MOVE_TOLERANCE) this.moved = true;

      if (this.scale() > MIN_SCALE) {
        this.tx.update(v => v + event.clientX - prev.x);
        this.ty.update(v => v + event.clientY - prev.y);
        this.clampPan();
      }
    }
  }

  onPointerUp(event: PointerEvent, cancelled = false) {
    if (!this.pointers.has(event.pointerId)) return;

    const wasSingle = this.pointers.size === 1;
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) this.pinchStartDist = 0;
    if (!wasSingle || cancelled) return;

    const dx = event.clientX - this.downPos.x;
    const dy = event.clientY - this.downPos.y;

    if (!this.moved) {
      this.handleTap(event);
      return;
    }

    if (
      !this.multiTouch &&
      this.scale() === MIN_SCALE &&
      this.hasMultiple &&
      Math.abs(dx) > SWIPE_MIN_DISTANCE &&
      Math.abs(dx) > Math.abs(dy) * 1.5
    ) {
      dx > 0 ? this.anterior() : this.siguiente();
    }
  }

  private handleTap(event: PointerEvent) {
    const now = Date.now();
    const isDouble =
      now - this.lastTapTime < DOUBLE_TAP_MS &&
      Math.hypot(event.clientX - this.lastTapPos.x, event.clientY - this.lastTapPos.y) < 30;

    if (isDouble) {
      this.lastTapTime = 0;
      this.smooth.set(true);
      if (this.scale() > MIN_SCALE) {
        this.resetZoom(true);
      } else {
        const p = this.toCenter(event.clientX, event.clientY);
        this.zoomTo(DOUBLE_TAP_SCALE, p.x, p.y);
      }
    } else {
      this.lastTapTime = now;
      this.lastTapPos = { x: event.clientX, y: event.clientY };
    }
  }

  private pointerDistance() {
    const [a, b] = Array.from(this.pointers.values());
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private pointerMidpoint() {
    const [a, b] = Array.from(this.pointers.values());
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  // ===== Descarga =====
  async descargar() {
    if (this.downloading()) return;
    const image = this.currentImage();
    this.downloading.set(true);

    try {
      // Blob: el atributo "download" no funciona con URLs de otro dominio
      const response = await fetch(image.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = this.buildFileName(image.fileName, blob.type);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      // Sin CORS en el bucket: abre la imagen en otra pestaña como respaldo
      console.warn('No se pudo descargar como blob, abriendo en pestaña nueva:', error);
      window.open(image.url, '_blank', 'noopener');
    } finally {
      this.downloading.set(false);
    }
  }

  private buildFileName(name: string | undefined, mime: string): string {
    const base = (name || 'imagen').trim();
    if (/\.[a-z0-9]{2,5}$/i.test(base)) return base;
    const ext = mime.split('/')[1]?.split('+')[0] || 'jpg';
    return `${base}.${ext}`;
  }

  // ===== Teclado (Escape lo maneja CDK) =====
  onKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowLeft': if (this.hasMultiple) this.anterior(); break;
      case 'ArrowRight': if (this.hasMultiple) this.siguiente(); break;
      case '+':
      case '=': this.zoomIn(); break;
      case '-': this.zoomOut(); break;
      case '0': this.resetZoom(); break;
    }
  }
}
