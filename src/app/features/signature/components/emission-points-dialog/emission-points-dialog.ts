import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { EmissionPointService } from '../../services/emission-point.service';
import { EmissionPoint, EmployeeOption } from '../../types/emission-point.type';

export interface EmissionPointsDialogData {
  branchId: string;
  branchName: string;
  establishmentCode: string | null;
}

@Component({
  selector: 'app-emission-points-dialog',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './emission-points-dialog.html',
  styleUrl: './emission-points-dialog.css',
})
export class EmissionPointsDialog implements OnInit {
  private readonly api = inject(EmissionPointService);
  private readonly ref = inject(DialogRef<void>);
  readonly data = inject<EmissionPointsDialogData>(DIALOG_DATA);

  readonly items = signal<EmissionPoint[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  // Asignación de empleados
  readonly employees = signal<EmployeeOption[]>([]);
  readonly employeesError = signal<string | null>(null);
  readonly assigningId = signal<string | null>(null);
  readonly selected = signal<Set<string>>(new Set());
  readonly loadingUsers = signal(false);

  readonly form = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{1,3}$/)],
    }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
  });

  ngOnInit() {
    this.load();
    this.api.listEmployees().subscribe({
      next: (list) => this.employees.set(list),
      error: () => this.employeesError.set('No se pudo cargar la lista de empleados.'),
    });
  }

  load() {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.list(this.data.branchId).subscribe({
      next: (r) => {
        this.items.set(r.items);
        this.loading.set(false);
      },
      error: (e) => {
        this.loadError.set(this.errorMessage(e, 'No se pudieron cargar los puntos de emisión.'));
        this.loading.set(false);
      },
    });
  }

  add() {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    const { code, name } = this.form.getRawValue();
    this.api.create(this.data.branchId, { code: code.padStart(3, '0'), name: name.trim() }).subscribe({
      next: () => {
        this.form.reset({ code: '', name: '' });
        this.saving.set(false);
        this.load();
      },
      error: (e) => {
        this.error.set(this.errorMessage(e, 'No se pudo crear el punto de emisión.'));
        this.saving.set(false);
      },
    });
  }

  makeDefault(p: EmissionPoint) {
    this.patch(p, { isDefault: true });
  }

  toggleActive(p: EmissionPoint) {
    this.patch(p, { active: !p.active });
  }

  private patch(p: EmissionPoint, body: { isDefault?: boolean; active?: boolean }) {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.api.update(p.id, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: (e) => {
        this.error.set(this.errorMessage(e, 'No se pudo actualizar el punto de emisión.'));
        this.saving.set(false);
      },
    });
  }

  // ---------- Empleados ----------

  toggleAssign(p: EmissionPoint) {
    if (this.saving()) return;
    if (this.assigningId() === p.id) {
      this.assigningId.set(null);
      return;
    }
    this.assigningId.set(p.id);
    this.error.set(null);
    this.loadingUsers.set(true);
    this.selected.set(new Set());
    this.api.getUsers(p.id).subscribe({
      next: (r) => {
        this.selected.set(new Set(r.userIds));
        this.loadingUsers.set(false);
      },
      error: (e) => {
        this.error.set(this.errorMessage(e, 'No se pudieron cargar los empleados asignados.'));
        this.loadingUsers.set(false);
        this.assigningId.set(null);
      },
    });
  }

  isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  toggleUser(id: string) {
    this.selected.update((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  saveUsers(p: EmissionPoint) {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.api.setUsers(p.id, [...this.selected()]).subscribe({
      next: () => {
        this.saving.set(false);
        this.assigningId.set(null);
      },
      error: (e) => {
        this.error.set(this.errorMessage(e, 'No se pudieron guardar los empleados.'));
        this.saving.set(false);
      },
    });
  }

  close() {
    if (!this.saving()) this.ref.close();
  }

  private errorMessage(err: any, fallback: string): string {
    const m = err?.error?.message;
    if (Array.isArray(m)) return m.join(', ');
    return typeof m === 'string' && m ? m : fallback;
  }
}