import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { LabelsService } from '../../services/labels.service';
import { PRINTERS, PrinterType } from '../../types/label.types';

export interface LabelPrintDialogData {
  items: { lotId: string; cant: number; label?: string }[];
  printer?: PrinterType; // impresora preseleccionada (por defecto ZEBRA)
}

type RowStatus = 'pending' | 'ok' | 'error';

interface Row {
  lotId: string;
  label: string;
  cant: number;
  selected: boolean;
  status: RowStatus;
  message: string | null;
}

const MAX_ITEMS = 50;
const MAX_CANT = 999;

@Component({
  selector: 'app-label-print-dialog',
  styleUrl: './label-print-dialog.css',
  templateUrl: './label-print-dialog.html',
})
export class LabelPrintDialog {
  private readonly api = inject(LabelsService);
  private readonly dialogRef = inject(DialogRef<void>);
  private readonly input = inject<LabelPrintDialogData>(DIALOG_DATA);

  readonly printers = PRINTERS;
  readonly printer = signal<PrinterType>(this.input.printer ?? 'ZEBRA');
  readonly printing = signal(false);
  readonly error = signal<string | null>(null);
  readonly rows = signal<Row[]>(
    this.input.items.map(i => ({
      lotId: i.lotId,
      label: i.label ?? i.lotId,
      cant: i.cant,
      selected: true,
      status: 'pending' as RowStatus,
      message: null,
    })),
  );

  /** Lo que se enviaría ahora: marcado y que aún no salió bien */
  readonly toPrint = computed(() => this.rows().filter(r => r.selected && r.status !== 'ok'));
  readonly hasFailed = computed(() => this.toPrint().some(r => r.status === 'error'));
  readonly allDone = computed(() => this.rows().every(r => r.status === 'ok'));

  /** Filas que todavía se pueden marcar o desmarcar */
  private readonly selectable = computed(() => this.rows().filter(r => r.status !== 'ok'));
  readonly allSelected = computed(() => {
    const s = this.selectable();
    return s.length > 0 && s.every(r => r.selected);
  });

  setPrinter(v: string) { this.printer.set(v as PrinterType); }

  toggle(index: number) {
    this.rows.update(list => list.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r)));
  }

  toggleAll() {
    const value = !this.allSelected();
    this.rows.update(list => list.map(r => (r.status === 'ok' ? r : { ...r, selected: value })));
  }

  onCant(index: number, event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    this.rows.update(list => list.map((r, i) => (i === index ? { ...r, cant: value } : r)));
  }

  print() {
    if (this.printing()) return;
    const pending = this.toPrint();
    if (!pending.length) {
      this.error.set('Marca al menos una línea para imprimir');
      return;
    }
    if (pending.length > MAX_ITEMS) {
      this.error.set(`Máximo ${MAX_ITEMS} etiquetas por solicitud`);
      return;
    }
    const invalid = pending.find(r => !Number.isInteger(r.cant) || r.cant < 1 || r.cant > MAX_CANT);
    if (invalid) {
      this.error.set(`La cantidad de "${invalid.label}" debe ser un entero entre 1 y ${MAX_CANT}`);
      return;
    }

    this.error.set(null);
    this.printing.set(true);

    this.api
      .print({ printer: this.printer(), items: pending.map(r => ({ lotId: r.lotId, cant: r.cant })) })
      .subscribe({
        next: res => {
          const byLot = new Map(res.items.map(i => [i.lotId, i]));
          this.rows.update(list =>
            list.map(r => {
              const result = byLot.get(r.lotId);
              if (!result) return r;
              return {
                ...r,
                status: result.ok ? 'ok' : 'error',
                selected: result.ok ? false : r.selected,
                message: result.message,
              };
            }),
          );
          this.printing.set(false);
        },
        error: err => {
          this.printing.set(false);
          this.error.set(this.message(err, 'No se pudo enviar la impresión'));
        },
      });
  }

  close() {
    if (this.printing()) return;
    this.dialogRef.close();
  }

  private message(err: unknown, fallback: string): string {
    const e = err as { status?: number; error?: { message?: string | string[] } };
    if (e.status === 0) return 'No se pudo conectar con el servidor';
    const msg = e.error?.message;
    return Array.isArray(msg) ? msg.join(', ') : (msg ?? fallback);
  }
}