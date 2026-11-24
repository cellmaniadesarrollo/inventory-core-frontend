// src/app/shared/components/qr-scanner-dialog/qr-scanner-dialog.ts
import { Component, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { ScannedLabel, parseLabelQr } from '../../utils/qr-label';

@Component({
  selector: 'app-qr-scanner-dialog',
  templateUrl: './qr-scanner-dialog.html',
})
export class QrScannerDialog implements OnInit, OnDestroy {
  private readonly ref = inject<DialogRef<ScannedLabel, QrScannerDialog>>(DialogRef);
  private readonly videoEl = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  readonly error = signal<string | null>(null);
  readonly hint = signal<string | null>(null);

  private stream: MediaStream | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private busy = false;

  async ngOnInit() {
    const Detector = (window as any).BarcodeDetector;
    if (!Detector) {
      this.error.set('Este navegador no soporta lectura de QR. Escribe el código o usa un lector.');
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
    } catch {
      this.error.set('No se pudo acceder a la cámara. Revisa los permisos.');
      return;
    }
    const video = this.videoEl().nativeElement;
    video.srcObject = this.stream;
    await video.play().catch(() => undefined);

    const detector = new Detector({ formats: ['qr_code'] });
    this.timer = setInterval(async () => {
      if (this.busy || video.readyState < 2) return;
      this.busy = true;
      try {
        const codes = await detector.detect(video);
        for (const c of codes) {
          const parsed = parseLabelQr(String(c.rawValue ?? ''));
          if (parsed) {
            this.ref.close(parsed);
            return;
          }
          this.hint.set('QR leído, pero no es una etiqueta válida (faltan S o BT).');
        }
      } catch {
        /* fotograma sin resultado */
      } finally {
        this.busy = false;
      }
    }, 250);
  }

  close() {
    this.ref.close();
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
  }
}