import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { SignaturesService } from '../../services/signature.service';
import { BranchOption, Signature } from '../../types/signature.type';

@Component({
  selector: 'app-signature-branches-dialog',
  templateUrl: './signature-branches-dialog.html',
  styleUrl: './signature-branches-dialog.css',
})
export class SignatureBranchesDialog {
  private readonly dialogRef = inject<DialogRef<Signature>>(DialogRef);
  private readonly api = inject(SignaturesService);
  readonly signature = inject<Signature>(DIALOG_DATA);

  private readonly initial = this.signature.branches.map((b) => b.id);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly branches = signal<BranchOption[]>([]);
  readonly selected = signal<string[]>(this.initial);

  readonly changed = computed(() => {
    const now = this.selected();
    return now.length !== this.initial.length || now.some((id) => !this.initial.includes(id));
  });

  constructor() {
    this.api.getNewData().subscribe({
      next: (res) => {
        this.branches.set(res.branches);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(this.errorMessage(err, 'No se pudieron cargar las sucursales.'));
        this.loading.set(false);
      },
    });
  }

  /** Ocupada por OTRA firma: no se puede marcar hasta liberarla allá. */
  lockedBy(b: BranchOption): string | null {
    return b.signature && b.signature.id !== this.signature.id ? b.signature.subject : null;
  }

  isSelected(id: string) {
    return this.selected().includes(id);
  }

  toggle(b: BranchOption) {
    if (this.lockedBy(b)) return;
    this.selected.update((ids) => (ids.includes(b.id) ? ids.filter((x) => x !== b.id) : [...ids, b.id]));
  }

  save() {
    if (this.saving() || !this.changed()) return;
    this.error.set(null);
    this.saving.set(true);
    this.api.updateBranches(this.signature.id, { branchIds: this.selected() }).subscribe({
      next: (updated) => this.dialogRef.close(updated),
      error: (err) => {
        this.error.set(this.errorMessage(err, 'No se pudieron guardar los cambios.'));
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