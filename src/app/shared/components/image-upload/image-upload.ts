import { Dialog } from '@angular/cdk/dialog';
import { Component, DestroyRef, computed, inject, input, model, signal } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { CameraDialog } from '../camera-dialog/camera-dialog';
interface PreviewItem {
  file: File;
  url: string;
  safeUrl: SafeUrl;
  isPdf: boolean;
}


/**
 * Subida de imágenes reutilizable: arrastrar y soltar, selector de archivos y cámara.
 *
 * Uso:
 *   readonly images = signal<File[]>([]);
 *   <app-image-upload [(files)]="images" [max]="5" />
 *
 * `files` es de salida: el componente publica la lista de File; el padre la envía por FormData.
 */
@Component({
  selector: 'app-image-upload',
  imports: [],
  templateUrl: './image-upload.html',
  styleUrl: './image-upload.css',
})
export class ImageUpload {
  private readonly dialog = inject(Dialog);
  private readonly sanitizer = inject(DomSanitizer);

  readonly files = model<File[]>([]);

  readonly multiple = input(true);
  readonly max = input(5);
  readonly maxSizeMb = input(5);
  readonly accept = input('image/jpeg,image/png,image/webp');
  readonly camera = input(true);

  readonly items = signal<PreviewItem[]>([]);
  readonly dragging = signal(false);
  readonly error = signal<string | null>(null);
  private dragDepth = 0;

  readonly limit = computed(() => (this.multiple() ? this.max() : 1));
  readonly canAddMore = computed(() => !this.multiple() || this.items().length < this.max());
  readonly cameraAvailable = computed(
    () => this.camera() && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
  );
  readonly label = input('Arrastra las imágenes aquí');

  readonly typesLabel = computed(() =>
    this.accept()
      .split(',')
      .map(t => t.trim().split('/')[1].toUpperCase()) // image/jpeg → JPEG, application/pdf → PDF
      .join(', '),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.items().forEach(i => URL.revokeObjectURL(i.url)));
  }

  // ===== Selector de archivos =====
  onFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    this.addFiles(Array.from(input.files ?? []));
    input.value = ''; // permite volver a elegir el mismo archivo
  }

  // ===== Drag & drop =====
  onDragEnter(e: DragEvent) {
    e.preventDefault();
    this.dragDepth++;
    this.dragging.set(true);
  }

  onDragOver(e: DragEvent) {
    e.preventDefault(); // necesario para permitir el drop
  }

  onDragLeave() {
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) this.dragging.set(false);
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.dragDepth = 0;
    this.dragging.set(false);
    this.addFiles(Array.from(e.dataTransfer?.files ?? []));
  }

  // ===== Cámara =====
  openCamera() {
    if (!this.canAddMore()) return;
    const ref = this.dialog.open<File>(CameraDialog, {
      width: '40rem',
      maxWidth: '95vw',
      autoFocus: 'dialog',
    });
    ref.closed.subscribe(file => {
      if (file) this.addFiles([file]);
    });
  }

  // ===== Lista =====
  remove(item: PreviewItem) {
    URL.revokeObjectURL(item.url);
    this.items.update(list => list.filter(i => i !== item));
    this.files.set(this.items().map(i => i.file));
    this.error.set(null);
  }

  size(file: File): string {
    return file.size >= 1024 * 1024
      ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
      : `${Math.max(1, Math.round(file.size / 1024))} KB`;
  }

  private addFiles(incoming: File[]) {
    this.error.set(null);
    const allowed = this.accept().split(',').map(t => t.trim());
    const maxBytes = this.maxSizeMb() * 1024 * 1024;
    const keep = this.multiple() ? this.items() : [];
    const added: PreviewItem[] = [];
    const errors: string[] = [];

    for (const file of incoming) {
      if (!allowed.includes(file.type)) {
        errors.push(`"${file.name}": formato no permitido`);
        continue;
      }
      if (file.size > maxBytes) {
        errors.push(`"${file.name}" supera ${this.maxSizeMb()} MB`);
        continue;
      }
      if (keep.length + added.length >= this.limit()) {
        errors.push(`Máximo ${this.limit()} imagen${this.limit() === 1 ? '' : 'es'}`);
        break;
      }
      const url = URL.createObjectURL(file);
      added.push({
        file, url,
        safeUrl: this.sanitizer.bypassSecurityTrustUrl(url),
        isPdf: file.type === 'application/pdf',
      });
    }

    if (added.length) {
      if (!this.multiple()) this.items().forEach(i => URL.revokeObjectURL(i.url));
      this.items.set([...keep, ...added]);
      this.files.set(this.items().map(i => i.file));
    }
    if (errors.length) this.error.set(errors.join(' · '));
  }
}