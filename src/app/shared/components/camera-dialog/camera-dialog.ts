import { DialogRef } from '@angular/cdk/dialog';
import { Component, DestroyRef, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';

type Facing = 'environment' | 'user';

/**
 * Modal de cámara. Se abre con Dialog (CDK) y devuelve un File JPEG al cerrar,
 * o undefined si se cancela.
 *
 *   this.dialog.open<File>(CameraDialog).closed.subscribe(file => ...)
 */
@Component({
  selector: 'app-camera-dialog',
  imports: [],
  templateUrl: './camera-dialog.html',
  styleUrl: './camera-dialog.css',
})
export class CameraDialog {
  private readonly dialogRef = inject(DialogRef<File>);
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  private stream: MediaStream | null = null;
  private destroyed = false;

  readonly status = signal<'starting' | 'live' | 'error'>('starting');
  readonly error = signal<string | null>(null);
  readonly facing = signal<Facing>('environment');
  readonly multipleCameras = signal(false);
  readonly photo = signal<File | null>(null);

  constructor() {
    afterNextRender(() => this.start());
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.stop();
    });
  }

  async start() {
    this.stop();
    this.photo.set(null);
    this.status.set('starting');
    this.error.set(null);

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.fail('La cámara requiere una conexión segura (HTTPS) o localhost.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.facing(), width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });

      // El diálogo se cerró mientras esperábamos el permiso
      if (this.destroyed) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      this.stream = stream;
      const el = this.video().nativeElement;
      el.srcObject = stream;
      await el.play();

      const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
      this.multipleCameras.set(cams.length > 1);
      this.status.set('live');
    } catch (err) {
      this.fail(this.describe(err));
    }
  }

  flip() {
    this.facing.update(f => (f === 'environment' ? 'user' : 'environment'));
    this.start();
  }

  async capture() {
    const el = this.video().nativeElement;
    if (!el.videoWidth) return;

    // Limita a 1920 px por lado para mantener el archivo liviano
    const scale = Math.min(1, 1920 / Math.max(el.videoWidth, el.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(el.videoWidth * scale);
    canvas.height = Math.round(el.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(el, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) {
      this.error.set('No se pudo capturar la foto');
      return;
    }

    el.pause(); // congela el último fotograma como vista previa
    this.error.set(null);
    this.photo.set(new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }));
  }

  retake() {
    this.photo.set(null);
    this.video().nativeElement.play();
  }

  use() {
    const file = this.photo();
    if (file) this.dialogRef.close(file);
  }

  cancel() {
    this.dialogRef.close();
  }

  private stop() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
  }

  private fail(message: string) {
    this.error.set(message);
    this.status.set('error');
  }

  private describe(err: unknown): string {
    switch ((err as DOMException)?.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return 'Permiso de cámara denegado. Actívalo en la configuración del navegador.';
      case 'NotFoundError':
      case 'OverconstrainedError':
        return 'No se encontró ninguna cámara.';
      case 'NotReadableError':
        return 'La cámara está siendo usada por otra aplicación.';
      default:
        return 'No se pudo iniciar la cámara.';
    }
  }
}