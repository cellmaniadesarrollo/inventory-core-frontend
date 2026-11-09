import { Component, computed, inject, signal } from '@angular/core';
import { IdentificationType, SupplierDetail, SupplierNewDataResponse, UpdateSupplierRequest } from '../../types/supplier.types';
import { DatePipe } from '@angular/common';
import { SuppliersService } from '../../services/suppliers.service';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

type EditKey = 'businessName' | 'tradeName' | 'countryId' | 'address' | 'phone' | 'email';
type FieldKind = 'text' | 'select' | 'textarea';

interface Field {
  key: EditKey;
  label: string;
  kind: FieldKind;
  max?: number;
  required?: boolean;
  inputType?: string;
  full?: boolean;
}

const FIELDS: Record<EditKey, Field> = {
  businessName: { key: 'businessName', label: 'Razón social', kind: 'text', max: 200, required: true },
  tradeName: { key: 'tradeName', label: 'Nombre comercial', kind: 'text', max: 200 },
  countryId: { key: 'countryId', label: 'País', kind: 'select', required: true },
  address: { key: 'address', label: 'Dirección', kind: 'textarea', max: 255, required: true, full: true },
  phone: { key: 'phone', label: 'Teléfono', kind: 'text', max: 30, inputType: 'tel' },
  email: { key: 'email', label: 'Correo electrónico', kind: 'text', max: 150, inputType: 'email' },
};

const ICONS = {
  building: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
  tag: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3zM6 6h.008v.008H6V6z',
  phone: 'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z',
  lock: 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z',
  pencil: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125',
} as const;

type IconName = keyof typeof ICONS;

interface Section { title: string; icon: IconName; fields: Field[]; wide?: boolean }

const SECTIONS: Section[] = [
  { title: 'Datos generales', icon: 'building', fields: [FIELDS.businessName, FIELDS.tradeName, FIELDS.countryId] },
  { title: 'Contacto y ubicación', icon: 'phone', fields: [FIELDS.phone, FIELDS.email, FIELDS.address], wide: true },
];

const ID_LABELS: Record<IdentificationType, string> = {
  RUC: 'RUC', CEDULA: 'Cédula', PASSPORT: 'Pasaporte', FOREIGN_ID: 'Identificación del exterior',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
@Component({
  imports: [DatePipe],
  selector: 'app-supplier-detail-dialog',
  styleUrl: './supplier-detail-dialog.css',
  templateUrl: './supplier-detail-dialog.html',
})
export class SupplierDetailDialog {
  private readonly service = inject(SuppliersService);
  private readonly dialogRef = inject(DialogRef<boolean>);
  private readonly input = inject<{ id: string }>(DIALOG_DATA);

  readonly icons = ICONS;
  readonly sections = SECTIONS;

  // Estado general
  readonly detail = signal<SupplierDetail | null>(null);
  readonly options = signal<SupplierNewDataResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  // Edición en línea
  readonly editing = signal<EditKey | null>(null);
  readonly draft = signal('');
  readonly confirming = signal(false);
  readonly saving = signal(false);
  readonly fieldError = signal<string | null>(null);

  // Activar / desactivar
  readonly confirmingStatus = signal(false);
  readonly changingStatus = signal(false);

  private changed = false;

  readonly inactive = computed(() => this.detail()?.status === false);

  constructor() {
    this.reload();
  }

  // ===== Carga =====
  private reload() {
    this.service.getOne(this.input.id).subscribe({
      next: d => {
        this.detail.set(d);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.error.set(this.message(err, 'No se pudo cargar el proveedor'));
      },
    });
  }

  // ===== Textos =====
  idTypeLabel(t: IdentificationType) { return ID_LABELS[t] ?? t; }

  display(key: EditKey): string {
    const d = this.detail();
    if (!d) return '';
    const dash = '—';
    switch (key) {
      case 'businessName': return d.businessName;
      case 'tradeName': return d.tradeName || dash;
      case 'countryId': return d.country?.name ?? dash;
      case 'address': return d.address;
      case 'phone': return d.phone || dash;
      case 'email': return d.email || dash;
    }
  }

  // ===== Edición en línea =====
  startEdit(key: EditKey) {
    const d = this.detail();
    if (!d) return;

    // Los países se cargan solo la primera vez que se edita ese campo
    if (key === 'countryId' && !this.options()) {
      this.service.getNewData().subscribe({
        next: o => this.options.set(o),
        error: err => this.fieldError.set(this.message(err, 'No se pudieron cargar los países')),
      });
    }

    const initial: Record<EditKey, string> = {
      businessName: d.businessName,
      tradeName: d.tradeName ?? '',
      countryId: d.countryId,
      address: d.address,
      phone: d.phone ?? '',
      email: d.email ?? '',
    };
    this.editing.set(key);
    this.draft.set(initial[key]);
    this.confirming.set(false);
    this.fieldError.set(null);
  }

  cancelEdit() {
    this.editing.set(null);
    this.confirming.set(false);
    this.fieldError.set(null);
  }

  setDraft(value: string) {
    this.draft.set(value);
    this.confirming.set(false);
  }

  /** Primer clic en Guardar: valida y pide confirmación. */
  askConfirm() {
    const err = this.validate(this.editing()!);
    this.fieldError.set(err);
    if (!err) this.confirming.set(true);
  }

  private validate(key: EditKey): string | null {
    const f = FIELDS[key];
    const v = this.draft().trim();
    if (f.required && !v) return `${f.label} es obligatorio`;
    if (f.max && v.length > f.max) return `Máximo ${f.max} caracteres`;
    if (key === 'email' && v && !EMAIL_RE.test(v)) return 'Correo electrónico no válido';
    return null;
  }

  private buildPatch(key: EditKey): UpdateSupplierRequest {
    const v = this.draft().trim();
    switch (key) {
      case 'businessName': return { businessName: v };
      case 'address': return { address: v };
      case 'countryId': return { countryId: v };
      case 'tradeName': return { tradeName: v || null };
      case 'phone': return { phone: v || null };
      case 'email': return { email: v || null };
    }
  }

  /** Segundo clic: confirma y envía solo ese campo. */
  confirmSave() {
    const key = this.editing();
    if (!key || this.saving()) return;
    this.saving.set(true);
    this.fieldError.set(null);

    this.service.update(this.input.id, this.buildPatch(key)).subscribe({
      next: d => {
        this.saving.set(false);
        this.changed = true;
        this.detail.set(d); // el PATCH devuelve el proveedor completo
        this.cancelEdit();
        this.flash('Cambio guardado');
      },
      error: err => {
        this.saving.set(false);
        this.confirming.set(false);
        this.fieldError.set(this.message(err, 'No se pudo guardar el cambio'));
      },
    });
  }

  // ===== Activar / desactivar =====
  confirmToggleStatus() {
    const d = this.detail();
    if (!d || this.changingStatus()) return;
    this.changingStatus.set(true);

    this.service.setStatus(this.input.id, !d.status).subscribe({
      next: updated => {
        this.changingStatus.set(false);
        this.confirmingStatus.set(false);
        this.changed = true;
        this.detail.set(updated);
        this.error.set(null);
        this.flash(updated.status ? 'Proveedor activado' : 'Proveedor desactivado');
      },
      error: err => {
        this.changingStatus.set(false);
        this.confirmingStatus.set(false);
        this.error.set(this.message(err, 'No se pudo cambiar el estado'));
      },
    });
  }

  // ===== Utilidades =====
  close() { this.dialogRef.close(this.changed); }

  private flash(text: string) {
    this.notice.set(text);
    setTimeout(() => this.notice.set(null), 3000);
  }

  private message(err: unknown, fallback: string): string {
    const e = err as { status?: number; error?: { message?: string | string[] } };
    if (e.status === 0) return 'No se pudo conectar con el servidor';
    const msg = e.error?.message;
    return Array.isArray(msg) ? msg.join(', ') : (msg ?? fallback);
  }
}
