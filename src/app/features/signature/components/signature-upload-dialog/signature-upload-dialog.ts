import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { IssuersService } from '../../services/issuer.service';
import { SignaturesService } from '../../services/signature.service';
import { Issuer } from '../../types/issuer.type';
import { BranchOption, SignatureCreated } from '../../types/signature.type';
import { IssuerDialog } from '../issuer-dialog/issuer-dialog';

const MAX_FILE_SIZE = 512 * 1024; // mismo límite que el gateway

@Component({
  selector: 'app-signature-upload-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './signature-upload-dialog.html',
  styleUrl: './signature-upload-dialog.css',
})
export class SignatureUploadDialog {
  private readonly dialogRef = inject<DialogRef<SignatureCreated>>(DialogRef);
  private readonly api = inject(SignaturesService);
  private readonly issuersApi = inject(IssuersService);

  /** Se genera UNA vez al abrir y se reutiliza en todo reintento. */
  private readonly clientRequestId = crypto.randomUUID();
  private readonly dialog = inject(Dialog);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly branches = signal<BranchOption[]>([]);
  readonly issuers = signal<Issuer[]>([]);
  readonly selected = signal<string[]>([]);
  readonly file = signal<File | null>(null);
  readonly showPassword = signal(false);

  readonly password = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/\S/)],
  });

  /** '' = sin emisor (opcional por ahora, igual que en el backend). */
  readonly issuerId = new FormControl('', { nonNullable: true });

  readonly availableCount = computed(() => this.branches().filter((b) => !b.signature).length);

  constructor() {
    this.api.getNewData().subscribe({
      next: (res) => {
        this.branches.set(res.branches);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(this.errorMessage(err, 'No se pudieron cargar las sucursales.'));
        this.loading.set(false);
      },
    });

    this.issuersApi.list().subscribe({
      next: (res) => this.issuers.set(res.items.filter((i) => i.active)),
      error: (err) => this.loadError.set(this.errorMessage(err, 'No se pudieron cargar los emisores.')),
    });
  }

  onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    this.file.set(input.files?.[0] ?? null);
    this.error.set(null);
  }

  isSelected(id: string): boolean {
    return this.selected().includes(id);
  }

  toggle(branch: BranchOption) {
    if (branch.signature) return;
    this.selected.update((ids) =>
      ids.includes(branch.id) ? ids.filter((x) => x !== branch.id) : [...ids, branch.id],
    );
  }

  togglePassword() {
    this.showPassword.update((v) => !v);
  }

  private validate(): string | null {
    const f = this.file();
    if (!f) return 'Selecciona el archivo de la firma (.p12 o .pfx).';
    if (!/\.(p12|pfx)$/i.test(f.name)) return 'La firma debe ser un archivo .p12 o .pfx.';
    if (f.size > MAX_FILE_SIZE) return 'El archivo de la firma es demasiado grande.';
    if (this.password.invalid) return 'Escribe la clave de la firma.';
    if (this.selected().length === 0) return 'Selecciona al menos una sucursal.';
    return null;
  }

  save() {
    if (this.saving()) return;
    const problem = this.validate();
    if (problem) {
      this.error.set(problem);
      return;
    }
    this.error.set(null);
    this.saving.set(true);

    this.api
      .create(
        {
          clientRequestId: this.clientRequestId,
          password: this.password.value,
          branchIds: this.selected(),
          issuerId: this.issuerId.value || undefined,
        },
        this.file()!,
      )
      .subscribe({
        next: (created) => this.dialogRef.close(created), // replayed: true también es éxito
        error: (err) => {
          this.error.set(this.errorMessage(err, 'No se pudo guardar la firma.'));
          this.saving.set(false);
        },
      });
  }

  close() {
    if (this.saving()) return;
    this.dialogRef.close();
  }

  private errorMessage(err: any, fallback: string): string {
    const msg = err?.error?.message;
    return Array.isArray(msg) ? msg.join(', ') : (msg ?? fallback);
  }

  createIssuer() {
    this.dialog
      .open<Issuer>(IssuerDialog, {
        width: '36rem',
        maxWidth: '95vw',
        data: null,
        autoFocus: 'first-tabbable',
        disableClose: true,
      })
      .closed.subscribe((created) => {
        if (!created) return;
        this.issuers.update((list) => [...list, created]);
        this.issuerId.setValue(created.id);
      });
  }
}