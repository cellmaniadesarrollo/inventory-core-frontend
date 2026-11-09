export type PrinterType = 'DYMO' | 'ZEBRA';

export const PRINTERS: { value: PrinterType; label: string }[] = [
    { value: 'DYMO', label: 'Dymo' },
    { value: 'ZEBRA', label: 'Zebra' },
];

export interface PrintLabelItem {
    lotId: string;
    cant: number;
}

export interface PrintLabelsRequest {
    printer: PrinterType;
    items: PrintLabelItem[];
}

export interface PrintLabelItemResult extends PrintLabelItem {
    ok: boolean;
    message: string;
}

export interface PrintLabelsResponse {
    ok: boolean;
    printer: PrinterType;
    items: PrintLabelItemResult[];
}