import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AccessKeyLine, AccessKeyPreview, SupplierSearchItem } from '../../types/receipt.types';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { ReceiptsService } from '../../services/receipts.service';
import { SupplierFormDialog } from '../../../suppliers/components/supplier-form-dialog/supplier-form-dialog';
import { Supplier, SupplierFormDialogData } from '../../../suppliers/types/supplier.types';
import { DecimalPipe } from '@angular/common';

@Component({
  imports: [ReactiveFormsModule, DecimalPipe],
  selector: 'app-access-key-dialog',
  styleUrl: './access-key-dialog.css',
  templateUrl: './access-key-dialog.html',
})
export class AccessKeyDialog {
  private readonly dialogRef = inject(DialogRef<AccessKeyPreview>);
  private readonly dialog = inject(Dialog);
  private readonly api = inject(ReceiptsService);

  readonly keyControl = new FormControl('', { nonNullable: true });
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly preview = signal<AccessKeyPreview | null>(null);
  readonly dragging = signal(false);

  readonly summary = computed(() => {
    const l = this.preview()?.lines ?? [];
    const count = (s: string) => l.filter(x => x.match.status === s).length;
    return { total: l.length, mapped: count('MAPPED'), nonInventory: count('NON_INVENTORY'), unmapped: count('UNMAPPED') };
  });
  private readonly STATUS = {
    MAPPED: { label: 'Relacionado', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
    UNMAPPED: { label: 'Por asignar', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
    NON_INVENTORY: { label: 'Sin inventario', cls: 'bg-surface-hover text-body' },
  } as const;
  statusLabel(l: AccessKeyLine) { return this.STATUS[l.match.status].label; }
  statusClass(l: AccessKeyLine) { return this.STATUS[l.match.status].cls; }

  readonly reasonLabel = (r: string | null) =>
    ({
      NO_MAPPING: 'Aún no se ha relacionado con un producto',
      NO_CODE: 'La factura no trae código',
      PRODUCT_INACTIVE: 'El producto relacionado fue desactivado',
    } as Record<string, string>)[r ?? ''] ?? '';

  /** El factor convierte unidades del proveedor a unidades propias (caja x10 → 10) */
  hasFactor(l: AccessKeyLine) {
    const f = Number(l.match.mapping?.unitFactor);
    return !!f && f !== 1;
  }
  /** Solo dígitos (acepta pegar con espacios o guiones) */
  readonly digits = (raw: string) => raw.replace(/\D/g, '');

  readonly canAccept = computed(() => {
    const p = this.preview();
    return !!p && p.canImport && !!p.supplier;
  });

  onInput() {
    // Si cambia la clave, el resultado anterior deja de ser válido
    if (this.preview()) this.preview.set(null);
    this.error.set(null);
  }

  search() {
    if (this.loading()) return;
    const accessKey = this.digits(this.keyControl.value);
    if (accessKey.length !== 49) {
      this.error.set('La clave de acceso debe tener 49 dígitos');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.preview.set(null);

    this.api.previewAccessKey(accessKey).subscribe({
      next: p => {
        this.preview.set(p);
        this.loading.set(false);

        // Proveedor no registrado → abrir el alta con el borrador
        if (p.canImport && !p.supplier && p.supplierDraft) this.createSupplier();
      },
      error: e => {
        this.loading.set(false);
        this.error.set(this.message(e, 'No se pudo consultar la clave de acceso'));
      },
    });
  }

  createSupplier() {
    const p = this.preview();
    if (!p?.supplierDraft) return;

    const data: SupplierFormDialogData = {
      draft: p.supplierDraft,
      formData: p.supplierForm ?? undefined,
    };

    this.dialog
      .open<Supplier>(SupplierFormDialog, {
        width: '40rem',
        maxWidth: '95vw',
        autoFocus: 'first-tabbable',
        data,
      })
      .closed.subscribe(s => {
        if (!s) return;
        this.refreshAfterSupplier(p, {
          id: s.id,
          code: s.code,
          identificationType: s.identificationType,
          identificationNumber: s.identificationNumber,
          businessName: s.businessName,
          tradeName: s.tradeName ?? null,
          status: s.status,
          label: `${s.identificationNumber}\n${s.businessName}`,
        });
      });
  }

  /** Repite el preview para traer mapeos y sugerencias del proveedor recién creado */
  private refreshAfterSupplier(prev: AccessKeyPreview, supplier: SupplierSearchItem) {
    const fallback: AccessKeyPreview = { ...prev, supplier, supplierDraft: null, supplierForm: null };
    this.loading.set(true);
    this.error.set(null);
    this.preview.set(null); // evita aceptar un preview a medias
    this.api.previewAccessKey(prev.key.accessKey).subscribe({
      next: p => {
        this.preview.set(p.supplier ? p : { ...p, supplier });
        this.loading.set(false);
      },
      error: e => {
        this.preview.set(fallback);
        this.loading.set(false);
        this.error.set(this.message(e, 'No se pudieron cargar las sugerencias') + '. Las líneas quedarán sin relacionar.');
      },
    });
  }

  accept() {
    const p = this.preview();
    if (p && this.canAccept()) this.dialogRef.close(p);
  }

  cancel() {
    this.dialogRef.close();
  }

  private message(err: unknown, fallback: string): string {
    const e = err as { status?: number; error?: { message?: string | string[] } };
    if (e.status === 0) return 'No se pudo conectar con el servidor';
    const msg = e.error?.message;
    return Array.isArray(msg) ? msg.join(', ') : (msg ?? fallback);
  }

  /** Extrae la clave de acceso de un XML o de cualquier texto */
  private extractKey(text: string): string | null {
    const byTag = /<claveAcceso>\s*(\d{49})\s*<\/claveAcceso>/i.exec(text);
    if (byTag) return byTag[1];

    const byAuth = /<numeroAutorizacion>\s*(\d{49})\s*<\/numeroAutorizacion>/i.exec(text);
    if (byAuth) return byAuth[1];

    // XML escapado (&lt;claveAcceso&gt;...) o texto suelto
    const loose = /(?<!\d)\d{49}(?!\d)/.exec(text);
    if (loose) return loose[0];

    // Clave pegada con espacios o guiones
    const compact = this.digits(text);
    return compact.length === 49 ? compact : null;
  }

  /** Recibe texto (pegado o leído de un archivo), llena la clave y consulta */
  private useText(text: string) {
    const key = this.extractKey(text);
    if (!key) {
      this.error.set('No se encontró una clave de acceso de 49 dígitos en el contenido');
      return;
    }
    this.keyControl.setValue(key);
    this.preview.set(null);
    this.error.set(null);
    this.search();
  }

  /** Pegar: si parece XML o texto largo, se extrae la clave; si es una clave normal, se deja pegar */
  onPaste(ev: ClipboardEvent) {
    const text = ev.clipboardData?.getData('text') ?? '';
    if (text.includes('<') || text.length > 60) {
      ev.preventDefault();
      this.useText(text);
    }
  }

  onDragOver(ev: DragEvent) {
    ev.preventDefault();
    this.dragging.set(true);
  }

  onDragLeave() {
    this.dragging.set(false);
  }

  onDrop(ev: DragEvent) {
    ev.preventDefault();
    this.dragging.set(false);
    this.readFile(ev.dataTransfer?.files?.[0]);
  }

  onFilePicked(ev: Event) {
    const input = ev.target as HTMLInputElement;
    this.readFile(input.files?.[0]);
    input.value = ''; // permite elegir el mismo archivo otra vez
  }

  private readFile(file?: File | null) {
    if (!file) return;
    const ok = /\.(xml|txt)$/i.test(file.name) || file.type.startsWith('text/') || file.type.includes('xml');
    if (!ok) {
      this.error.set('Sube un archivo XML o de texto');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.error.set('El archivo es demasiado grande (máx. 5 MB)');
      return;
    }
    file.text().then(
      t => this.useText(t),
      () => this.error.set('No se pudo leer el archivo'),
    );
  }
}