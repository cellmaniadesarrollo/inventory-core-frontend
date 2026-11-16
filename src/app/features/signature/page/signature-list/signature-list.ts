import { Dialog } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, switchMap, tap } from 'rxjs';
import { SignatureBranchesDialog } from '../../components/signature-branches-dialog/signature-branches-dialog';
import { SignatureIssuerDialog } from '../../components/signature-issuer-dialog/signature-issuer-dialog';
import { SignatureUploadDialog } from '../../components/signature-upload-dialog/signature-upload-dialog';
import { IssuersService } from '../../services/issuer.service';
import { SignaturesService } from '../../services/signature.service';
import { Issuer } from '../../types/issuer.type';
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
  private readonly issuersApi = inject(IssuersService);
  private readonly dialog = inject(Dialog);

  readonly items = signal<Signature[]>([]);
  readonly issuers = signal<Issuer[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly flash = signal<string | null>(null);
  private readonly reloadTick = signal(0);

  /** id → "RUC · Razón social". */
  private readonly issuerMap = computed(
    () => new Map(this.issuers().map((i) => [i.id, `${i.ruc} · ${i.legalName}`])),
  );

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

    this.loadIssuers();
  }

  reload() {
    this.loadIssuers();
    this.reloadTick.update((n) => n + 1);
  }

  private loadIssuers() {
    this.issuersApi.list().subscribe({ next: (res) => this.issuers.set(res.items) });
  }

  issuerLabel(id?: string | null): string | null {
    return id ? (this.issuerMap().get(id) ?? 'Emisor desconocido') : null;
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

  editBranches(s: Signature) {
    this.dialog
      .open<Signature>(SignatureBranchesDialog, {
        width: '36rem',
        maxWidth: '95vw',
        data: s,
        autoFocus: 'first-tabbable',
        disableClose: true,
      })
      .closed.subscribe((updated) => {
        if (!updated) return;
        this.showFlash(`Sucursales de ${updated.subject} actualizadas.`);
        this.reload();
      });
  }

  editIssuer(s: Signature) {
    this.dialog
      .open<Signature>(SignatureIssuerDialog, {
        width: '32rem',
        maxWidth: '95vw',
        data: s,
        autoFocus: 'first-tabbable',
        disableClose: true,
      })
      .closed.subscribe((updated) => {
        if (!updated) return;
        this.showFlash(`Emisor de ${updated.subject} actualizado.`);
        this.reload();
      });
  }
}