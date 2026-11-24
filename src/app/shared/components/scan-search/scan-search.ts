// src/app/shared/components/scan-search/scan-search.ts
import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Dialog } from '@angular/cdk/dialog';
import { QrScannerDialog } from '../qr-scanner-dialog/qr-scanner-dialog';
import { ScannedLabel, parseLabelQr } from '../../utils/qr-label';

/**
 * Buscador con texto + botón de cámara.
 * - Texto normal -> (searched)
 * - QR o lector USB que "escribe" el formato S:...,BT:... -> (scanned)
 */
@Component({
  selector: 'app-scan-search',
  imports: [FormsModule],
  templateUrl: './scan-search.html',
})
export class ScanSearch {
  private readonly dialog = inject(Dialog);

  readonly placeholder = input('Buscar por SKU o escanear QR');
  readonly scanned = output<ScannedLabel>();
  readonly searched = output<string>();

  readonly term = signal('');

  submit() {
    const text = this.term().trim();
    if (!text) return;
    const parsed = parseLabelQr(text);
    if (parsed) {
      this.scanned.emit(parsed);
      this.term.set('');
    } else {
      this.searched.emit(text);
    }
  }

  openScanner() {
    this.dialog
      .open<ScannedLabel, void, QrScannerDialog>(QrScannerDialog, {
        width: '28rem',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .closed.subscribe((res: ScannedLabel | undefined) => {
        if (res) this.scanned.emit(res);
      });
  }
}