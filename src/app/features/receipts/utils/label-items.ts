import { LabelPrintDialogData } from '../../../shared/components/label-print-dialog/label-print-dialog';
import { ReceiptDetail } from '../types/receipt.types';

/** Solo líneas con inventario y lote (las sin inventario tienen lot null) */
export function buildLabelItems(d: ReceiptDetail): LabelPrintDialogData['items'] {
    return d.lines
        .filter(l => l.affectsInventory && l.lot)
        .map(l => ({
            lotId: l.lot!.id,
            cant: l.quantity,
            label: `${l.product?.name ?? 'Producto'} · Lote #${l.lot!.code}`,
        }));
}