import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { Subject, catchError, debounceTime, distinctUntilChanged, filter, map, of, switchMap, tap } from 'rxjs';
import { ClientsService } from '../../services/clients.service';
import {
  BillingCatalogsResponse,
  BillingClient,
  BillingDialogResult,
  UpdateBillingRequest,
} from '../../types/clients.types';

@Component({
  selector: 'app-client-billing-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './client-billing-dialog.html',
  styleUrl: './client-billing-dialog.css',
})
export class ClientBillingDialog {
  private readonly dialogRef = inject<DialogRef<BillingDialogResult>>(DialogRef);
  private readonly api = inject(ClientsService);
  /** null = crear; con valor = editar. */
  readonly client = inject<BillingClient | null>(DIALOG_DATA);
  readonly isEdit = this.client !== null;

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly searching = signal(false);
  readonly error = signal<string | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly catalogs = signal<BillingCatalogsResponse>({ idTypes: [], personTypes: [], genders: [] });

  /** Registro encontrado al escribir el número (solo al crear). */
  readonly existing = signal<BillingClient | null>(null);
  private readonly current = computed(() => this.client ?? this.existing());
  private readonly lookup$ = new Subject<string>();

  private readonly emailPhoneAddress = [
    { key: 'mainEmail', label: 'Correo', type: 'email', full: true },
    { key: 'cellphone', label: 'Celular', type: 'tel', full: false },
    { key: 'phone', label: 'Teléfono', type: 'tel', full: false },
    { key: 'address', label: 'Dirección', type: 'text', full: true },
  ] as const;

  private readonly naturalFields = [
    { key: 'firstName', label: 'Nombres', type: 'text', full: false },
    { key: 'lastName', label: 'Apellidos', type: 'text', full: false },
    ...this.emailPhoneAddress,
  ] as const;

  private readonly juridicaFields = [
    { key: 'firstName', label: 'Razón social', type: 'text', full: false },
    { key: 'tradeName', label: 'Nombre comercial', type: 'text', full: false },
    ...this.emailPhoneAddress,
  ] as const;

  isJuridica(): boolean {
    const id = this.form.controls.personTypeId.getRawValue();
    const name = this.catalogs().personTypes.find((p) => p.id === id)?.name ?? '';
    return name.toUpperCase().startsWith('JUR');
  }

  fields() {
    return this.isJuridica() ? this.juridicaFields : this.naturalFields;
  }

  private readonly editable = [
    'genderId', 'firstName', 'lastName', 'tradeName', 'mainEmail', 'cellphone', 'phone', 'address', 'isActive',
  ] as const;

  /** Valida el número según el tipo elegido (códigos SRI: 04 RUC, 05 cédula, 06 pasaporte). */
  private readonly idNumberValidator: ValidatorFn = (control) => {
    const value = String(control.value ?? '').trim();
    if (!value) return null; // required se encarga
    const typeId = control.parent?.get('idTypeId')?.value;
    const code = this.catalogs().idTypes.find((t) => t.id === typeId)?.code;
    if (code === '05') return /^\d{10}$/.test(value) ? null : { idNumber: 'La cédula debe tener 10 dígitos.' };
    if (code === '04') return /^\d{10}001$/.test(value) ? null : { idNumber: 'El RUC debe tener 13 dígitos y terminar en 001.' };
    if (code === '06') return /^[A-Za-z0-9]{5,20}$/.test(value) ? null : { idNumber: 'El pasaporte admite letras y números (5 a 20).' };
    return null;
  };

  readonly form = inject(NonNullableFormBuilder).group({
    idTypeId: [this.client?.idType?.id ?? 0, [Validators.min(1)]],
    idNumber: ['', [Validators.required, this.idNumberValidator]],
    personTypeId: [this.client?.personType?.id ?? 0, [Validators.min(1)]],
    genderId: [this.client?.gender?.id ?? 0],
    firstName: [this.client?.firstName ?? '', [Validators.required, Validators.pattern(/\S/)]],
    lastName: [this.client?.lastName ?? ''],
    tradeName: [this.client?.tradeName ?? ''],
    mainEmail: [this.client?.mainEmail ?? '', [Validators.required, Validators.email]],
    cellphone: [this.client?.cellphone ?? '', [Validators.required, Validators.pattern(/\S/)]],
    phone: [this.client?.phone ?? ''],
    address: [this.client?.address ?? '', [Validators.required, Validators.pattern(/\S/)]],
    isActive: [this.client?.isActive ?? true],
  });

  constructor() {
    if (this.isEdit) {
      this.form.controls.idTypeId.disable();
      this.form.controls.idNumber.disable();
      this.form.controls.personTypeId.disable();
    } else {
      // si cambian el tipo de identificación a mano, se revalida el número
      this.form.controls.idTypeId.valueChanges
        .pipe(takeUntilDestroyed())
        .subscribe(() => this.form.controls.idNumber.updateValueAndValidity());

      // al cambiar el tipo de persona, se vacía el campo que se oculta
      this.form.controls.personTypeId.valueChanges
        .pipe(takeUntilDestroyed())
        .subscribe(() => {
          if (this.isJuridica()) this.form.controls.lastName.setValue('');
          else this.form.controls.tradeName.setValue('');
        });

      // búsqueda al escribir el número
      this.lookup$
        .pipe(
          debounceTime(400),
          distinctUntilChanged(),
          tap(() => this.clearExisting()),
          filter((v) => v.length >= 3 && this.form.controls.idNumber.valid),
          tap(() => this.searching.set(true)),
          switchMap((v) =>
            this.api.search(v).pipe(
              map((res) => ({ v, res })),
              catchError(() => of({ v, res: null })),
            ),
          ),
          takeUntilDestroyed(),
        )
        .subscribe(({ v, res }) => {
          this.searching.set(false);
          const list = Array.isArray(res) ? res : res ? [res] : [];
          const match = list.find((c) => c.idNumber === v);
          if (match) this.fillFrom(match);
        });
    }

    this.api.getCatalogs().subscribe({
      next: (res) => {
        this.catalogs.set(res);
        if (!this.isEdit) {
          // por defecto: persona natural
          const natural = res.personTypes.find((p) => p.name.toUpperCase() === 'NATURAL');
          if (natural) this.form.controls.personTypeId.setValue(natural.id);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(this.errorMessage(err, 'No se pudieron cargar los catálogos.'));
        this.loading.set(false);
      },
    });
  }

  invalid(key: string): boolean {
    const c = this.form.get(key);
    return !!c && c.invalid && c.touched;
  }

  private fillFrom(c: BillingClient) {
    this.existing.set(c);
    // emitEvent: false para que el cambio de tipo de persona no vacíe campos recién llenados
    this.form.patchValue(
      {
        idTypeId: c.idType?.id ?? 0,
        personTypeId: c.personType?.id ?? 0,
        genderId: c.gender?.id ?? 0,
        firstName: c.firstName ?? '',
        lastName: c.lastName ?? '',
        tradeName: c.tradeName ?? '',
        mainEmail: c.mainEmail ?? '',
        cellphone: c.cellphone ?? '',
        phone: c.phone ?? '',
        address: c.address ?? '',
        isActive: c.isActive,
      },
      { emitEvent: false },
    );
    // el tipo de documento y de persona no se editan en un registro existente
    this.form.controls.idTypeId.disable({ emitEvent: false });
    this.form.controls.personTypeId.disable({ emitEvent: false });
  }

  private clearExisting() {
    if (!this.existing()) return;
    this.existing.set(null);
    this.form.controls.idTypeId.enable({ emitEvent: false });
    this.form.controls.personTypeId.enable({ emitEvent: false });
  }

  /** Qué hace el botón principal. */
  action(): 'save' | 'select' | 'update' {
    if (this.isEdit || !this.existing()) return 'save';
    return Object.keys(this.changes()).length ? 'update' : 'select';
  }

  label(): string {
    const a = this.action();
    return a === 'select' ? 'Seleccionar' : a === 'update' ? 'Actualizar' : 'Guardar';
  }

  /** Campos modificados respecto al registro actual (sin distinguir mayúsculas: el backend guarda en mayúsculas). */
  private changes(): UpdateBillingRequest {
    const c = this.current();
    const before: Record<string, unknown> = {
      ...(c as unknown as Record<string, unknown>),
      genderId: c?.gender?.id ?? 0,
    };
    const now = this.form.getRawValue() as Record<string, unknown>;
    const norm = (x: unknown) => (typeof x === 'string' ? x.trim().toUpperCase() : x);
    const out: Record<string, unknown> = {};
    for (const k of this.editable) {
      const prev = before[k] ?? '';
      const raw = now[k];
      if (norm(raw) !== norm(prev)) out[k] = typeof raw === 'string' ? raw.trim() : raw;
    }
    if (!out['genderId']) delete out['genderId']; // 0 = sin especificar, no se envía
    return out as UpdateBillingRequest;
  }

  save() {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisa los campos marcados.');
      return;
    }
    const v = this.form.getRawValue();
    const opt = (s: string) => s.trim() || undefined;
    const found = this.existing();

    // Existe y no cambió nada: solo se selecciona
    if (!this.isEdit && found && this.action() === 'select') {
      this.dialogRef.close({ action: 'selected', client: found });
      return;
    }

    let request$;
    let action: BillingDialogResult['action'];
    if (this.isEdit || found) {
      const changes = this.changes();
      if (Object.keys(changes).length === 0) {
        this.error.set('No hay cambios para guardar.');
        return;
      }
      request$ = this.api.update(this.current()!.id, changes);
      action = 'updated';
    } else {
      request$ = this.api.create({
        idTypeId: v.idTypeId,
        idNumber: v.idNumber.trim(),
        personTypeId: v.personTypeId,
        genderId: v.genderId || undefined,
        firstName: v.firstName.trim(),
        lastName: opt(v.lastName),
        tradeName: opt(v.tradeName),
        mainEmail: v.mainEmail.trim(),
        cellphone: opt(v.cellphone),
        phone: opt(v.phone),
        address: v.address.trim(),
      });
      action = 'created';
    }

    this.error.set(null);
    this.saving.set(true);
    request$.subscribe({
      next: (client) => this.dialogRef.close({ action, client }),
      error: (err) => {
        this.error.set(this.errorMessage(err, 'No se pudo guardar.'));
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

  onIdNumberInput() {
    const v = this.form.controls.idNumber.value.trim();
    this.lookup$.next(v);
    let code: string | null = null;
    if (/^\d{10}$/.test(v)) code = '05'; // cédula
    else if (/^\d{10}001$/.test(v)) code = '04'; // RUC
    else if (/[A-Za-z]/.test(v)) code = '06'; // pasaporte (tiene letras)
    if (!code) return;
    const type = this.catalogs().idTypes.find((t) => t.code === code);
    if (type) this.form.controls.idTypeId.setValue(type.id);
  }
}