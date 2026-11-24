// src/app/shared/utils/qr-label.ts
export interface ScannedLabel {
  /** SKU (campo S) */
  sku: string;
  /** Lote (campo BT) */
  batch: string;
  raw: string;
}

/**
 * Lee el formato: S:REP-PAN-APP-000006,BT:6,F:2026-10-27,P:P,B:true,U:USER,FA:T
 * Solo toma S y BT; el resto se ignora. Devuelve null si falta alguno.
 */
export function parseLabelQr(raw: string): ScannedLabel | null {
  const fields = new Map<string, string>();
  for (const part of raw.split(',')) {
    const i = part.indexOf(':');
    if (i <= 0) continue;
    fields.set(part.slice(0, i).trim().toUpperCase(), part.slice(i + 1).trim());
  }
  const sku = fields.get('S');
  const batch = fields.get('BT');
  if (!sku || !batch) return null;
  return { sku, batch, raw };
}