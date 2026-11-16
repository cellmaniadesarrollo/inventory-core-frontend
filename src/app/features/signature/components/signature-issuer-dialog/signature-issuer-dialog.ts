import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { IssuersService } from '../../services/issuer.service';
import { SignaturesService } from '../../services/signature.service';
import { Issuer } from '../../types/issuer.type';
import { Signature } from '../../types/signature.type';
import { IssuerDialog } from '../issuer-dialog/issuer-dialog';

@Component({
  selector: 'app-signature-issuer-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './signature-issuer-dialog.html',
  styleUrl: './signature-issuer-dialog.css',
})
export class SignatureIssuerDialog {
  private readonly dialogRef = inject<DialogRef<Signature>>(DialogRef);
  private readonly dialog = inject(Dialog);
  private readonly api = inject(SignaturesService);
  private readonly issuersApi = inject(IssuersService);
  readonly signature = inject<Signature>(DIALOG_DATA);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly issuers = signal<Issuer[]>([]);

  readonly issuerId = new FormControl(this.signature.issuerId ?? '', { nonNullable: true });

  /** Emisor elegido en el select (para el botón Editar). */
  readonly selectedId = signal(this.issuerId.value);
  readonly current = computed(() => this.issuers().find((i) => i.id === this.selectedId()) ?? null);

  constructor() {
    this.issuerId.valueChanges.subscribe((v) => this.selectedId.set(v));

    this.issuersApi.list().subscribe({
      next: (res) => {
        // activos, más el actual aunque esté inactivo, para no perderlo del select
        this.issuers.set(res.items.filter((i) => i.active || i.id === this.signature.issuerId));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(this.errorMessage(err, 'No se pudieron cargar los emisores.'));
        this.loading.set(false);
      },
    });
  }

  createIssuer() {
    this.openIssuerDialog(null);
  }

  editIssuer() {
    const i = this.current();
    if (i) this.openIssuerDialog(i);
  }

  private openIssuerDialog(data: Issuer | null) {
    this.dialog
      .open<Issuer>(IssuerDialog, {
        width: '36rem',
        maxWidth: '95vw',
        data,
        autoFocus: 'first-tabbable',
        disableClose: true,
      })
      .closed.subscribe((saved) => {
        if (!saved) return;
        this.issuers.update((list) =>
          list.some((i) => i.id === saved.id)
            ? list.map((i) => (i.id === saved.id ? { ...i, ...saved } : i))
            : [...list, saved],
        );
        if (!data) this.issuerId.setValue(saved.id);
      });
  }

  save() {
    if (this.saving()) return;
    this.error.set(null);
    this.saving.set(true);
    this.api.updateIssuer(this.signature.id, { issuerId: this.issuerId.value || null }).subscribe({
      next: (res) => this.dialogRef.close(res),
      error: (err) => {
        this.error.set(this.errorMessage(err, 'No se pudo cambiar el emisor.'));
        this.saving.set(false);
      },
    });
  }

  close() {
    if (!this.saving()) this.dialogRef.close();
  }

  private errorMessage(err: any, fallback: string): string {
    const msg = err?.error?.message;
    return Array.isArray(msg) ? msg.join(', ') : (msg ?? fallback);
  }
}