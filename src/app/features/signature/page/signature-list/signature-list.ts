import { Dialog } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, switchMap, tap } from 'rxjs';
import { SignatureUploadDialog } from '../../components/signature-upload-dialog/signature-upload-dialog';
import { SignaturesService } from '../../services/signature.service';
import { Signature, SignatureCreated } from '../../types/signature.type';

type ExpiryState = 'expired' | 'soon' | 'ok';

const EXPIRY_LABEL: Record<ExpiryState, string> = {
  expired: 'Vencida',
  soon: 'Por vencer',
  ok: 'Vigente',
};

const EXPIRY_CLASS: Record<ExpiryState, string> = {
  expired: 'bg-red-500/10 text-red-700 dark:text-red-300',
  soon: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  ok: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
};

const SOON_DAYS = 30;

@Component({
  selector: 'app-signature-list',
  imports: [DatePipe],
  templateUrl: './signature-list.html',
  styleUrl: './signature-list.css',
})
export class SignatureList {
  private readonly api = inject(SignaturesService);
  private readonly dialog = inject(Dialog);

  readonly items = signal<Signature[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly flash = signal<string | null>(null);
  private readonly reloadTick = signal(0);

  constructor() {
    toObservable(this.reloadTick)
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(() =>
          this.api.list().pipe(
            catchError((err) => {
              const msg = err?.error?.message;
              this.error.set(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'No se pudo cargar el listado.'));
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((res) => {
        this.items.set(res.items);
        this.error.set(null);
        this.loading.set(false);
      });
  }

  reload() {
    this.reloadTick.update((n) => n + 1);
  }

  openUpload() {
    this.dialog
      .open<SignatureCreated>(SignatureUploadDialog, {
        width: '40rem',
        maxWidth: '95vw',
        autoFocus: 'first-tabbable',
        disableClose: true,
      })
      .closed.subscribe((created) => {
        if (!created) return;
        this.showFlash(`Firma de ${created.subject} guardada.`);
        this.reload();
      });
  }

  private showFlash(text: string) {
    this.flash.set(text);
    setTimeout(() => this.flash.set(null), 4000);
  }

  private expiryState(s: Signature): ExpiryState {
    const left = new Date(s.expiresAt).getTime() - Date.now();
    if (left <= 0) return 'expired';
    return left <= SOON_DAYS * 24 * 60 * 60 * 1000 ? 'soon' : 'ok';
  }

  expiryLabel(s: Signature): string {
    return EXPIRY_LABEL[this.expiryState(s)];
  }

  expiryClass(s: Signature): string {
    return EXPIRY_CLASS[this.expiryState(s)];
  }
}