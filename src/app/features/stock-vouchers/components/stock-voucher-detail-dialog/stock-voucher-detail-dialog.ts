import { DialogRef, DIALOG_DATA, Dialog } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, switchMap, tap } from 'rxjs';
import { ImageLightboxDialog, LightboxData } from '../../../../shared/components/image-lightbox-dialog/image-lightbox-dialog';
import { StockVoucherReturnDialog } from '../stock-voucher-return-dialog/stock-voucher-return-dialog';
import { StockVouchersService } from '../../services/stock-vouchers.service';
import {
  StockVoucherCreated,
  StockVoucherDetailDialogData,
  StockVoucherReturnDialogData,
  VoucherDetail,
  VoucherDetailLine,
} from '../../types/stock-voucher.types';

const ORDER_NOT_RETURNABLE_STATUS = 8; // ENTREGADA

@Component({
  imports: [DatePipe],
  selector: 'app-stock-voucher-detail-dialog',
  styleUrl: './stock-voucher-detail-dialog.css',
  templateUrl: './stock-voucher-detail-dialog.html',
})
export class StockVoucherDetailDialog {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly dialog = inject(Dialog);
  private readonly api = inject(StockVouchersService);
  private readonly input = inject<StockVoucherDetailDialogData>(DIALOG_DATA);

  /** Vale que se está viendo; cambiarlo recarga (para saltar entre salida y retorno) */
  readonly currentId = signal(this.input.id);
  readonly detail = signal<VoucherDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private readonly reloadTick = signal(0);
  readonly notice = signal<string | null>(null);

  readonly isOut = computed(() => this.detail()?.direction === 'OUT');

  /** Habilita el botón "Registrar retorno" (el servidor lo valida igual) */
  readonly canReturn = computed(() => {
    const d = this.detail();
    if (!d || d.direction !== 'OUT' || !d.reason?.isReturnable) return false;
    if (d.order?.statusId === ORDER_NOT_RETURNABLE_STATUS) return false;
    return d.lines.some(l => (l.pending ?? 0) > 0);
  });

  private changed = false;

  constructor() {
    toObservable(computed(() => ({ id: this.currentId(), t: this.reloadTick() })))
      .pipe(
        tap(() => { this.loading.set(true); this.error.set(null); }),
        switchMap(({ id }) =>
          this.api.getOne(id).pipe(
            catchError(err => {
              const msg = err?.error?.message;
              this.error.set(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'No se pudo cargar el movimiento.'));
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(d => {
        this.detail.set(d);
        this.loading.set(false);
      });
  }

  goTo(id: string) { this.currentId.set(id); }

  reload() { this.reloadTick.update(n => n + 1); }

  close() { this.dialogRef.close(this.changed); }

  openReturn() {
    const voucher = this.detail();
    if (!voucher || !this.canReturn()) return;

    this.dialog
      .open<StockVoucherCreated>(StockVoucherReturnDialog, {
        data: { voucher } satisfies StockVoucherReturnDialogData,
        width: '44rem',
        maxWidth: '95vw',
        autoFocus: 'first-tabbable',
        disableClose: true,
      })
      .closed.subscribe(created => {
        if (!created) return;
        this.changed = true; // el listado se recarga al cerrar el detalle
        this.notice.set(`Retorno registrado: #${created.code}`);
        setTimeout(() => this.notice.set(null), 5000);
        this.reload(); // el detalle muestra Devuelto/Pendiente y el nuevo retorno
      });
  }

  /** La firma puede fallar y venir la key cruda de S3 */
  isUrl(u: string) { return u.startsWith('http'); }

  openPhoto(line: VoucherDetailLine, index: number) {
    const valid = line.attachments.filter(a => this.isUrl(a.url));
    if (!valid.length) return;

    // El índice de la plantilla cuenta todas las fotos; aquí solo las que tienen URL válida
    const clicked = line.attachments[index];
    const startIndex = Math.max(0, valid.findIndex(a => a.id === clicked?.id));

    const data: LightboxData = {
      images: valid.map(a => ({ url: a.url, fileName: a.originalName })),
      startIndex,
    };

    this.dialog.open(ImageLightboxDialog, {
      data,
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

  fmtSize(bytes: number) {
    return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}