// src/app/features/invoices/types/sale-product.type.ts

// ---------- Búsqueda: GET /inventory-core/products/search-sale ----------

export type SaleSearchSource = 'SCANNER' | 'MANUAL';

export interface SaleSearchQuery {
  /** Lo que escribió o escaneó el usuario (1–100). Con UPC va como "#<upc>". */
  q: string;
  /** Default: 'MANUAL'. */
  source?: SaleSearchSource;
  /** Número del lote del QR. Solo con source = 'SCANNER'. */
  lotCode?: number;
}

export type SaleSearchProduct = {
  id: string;
  code: number;
  sku: string;
  upc: string | null;
  name: string;
  description: string | null;
  kind: 'DEVICE' | 'PART' | 'ACCESSORY';
  trackingMode: 'QUANTITY' | 'SERIAL';
  typeName: string | null;
  colorName: string | null;
  qualityName: string | null;
  brands: string[];
  models: { id: number; name: string; brand: string; technicalCodes: string[] }[];
  imageUrl: string | null;
};

export type SaleSearchUnit = {
  unitId: string;
  /** IMEI / serial principal. */
  serial: string;
  /** Todos los seriales (IMEI 1, IMEI 2, …). */
  serials: string[];
};

export type SaleSearchLot = {
  lotId: string;
  /** Número del lote (el del QR). */
  code: number;
  onHand: number;
  reserved: number;
  available: number;
  /** Numeric como string con 2 decimales. Solo mostrar, no operar. */
  salePrice: string;
  warrantyDays: number;
  hasTax: boolean;
  priceIncludesTax: boolean;
  billableInSales: boolean;
  billableInRepairOrders: boolean;
  /** ISO string. */
  createdAt: string;
  /** Vacío si trackingMode = 'QUANTITY'. */
  units: SaleSearchUnit[];
};

export type SaleSearchItem = {
  product: SaleSearchProduct;
  /** Suma solo de los lotes devueltos en la respuesta. */
  stock: { onHand: number; available: number };
  /** Del más antiguo al más nuevo. */
  lots: SaleSearchLot[];
};

export type SaleSearchResponse = SaleSearchItem[];

/** Una fila elegible en la UI: un lote (QUANTITY) o una unidad concreta (SERIAL). */
export interface SaleOption {
  key: string;
  product: SaleSearchProduct;
  lot: SaleSearchLot;
  unit: SaleSearchUnit | null;
}

// ---------- Recibo ----------

export interface CreateSaleReceiptRequest {
  clientRequestId: string;
  branchId: string;
  issueDate: string;
  buyerIdNumber?: string;
  buyerName?: string;
  lines: {
    productId?: string;
    /** Lote contra el que se vende (productos por cantidad). */
    lotId?: string;
    /** Unidad concreta (productos serializados). */
    unitId?: string;
    mainCode: string;
    batch?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
  }[];
  paymentMethod: string;
  total: number;
}

// ---------- Retorno de recibos ----------

export interface ReceiptListItem {
  id: string;
  kind: 'RECIBO' | 'RETORNO';
  number: string;
  statusCode: string;
  issueDate: string;
  buyerName: string;
  buyerIdNumber: string | null;
  total: string;
  relatedReceiptId?: string | null;
}

export interface ReceiptDetailLine {
  id: string;
  position: number;
  mainCode: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  lineTotal: string;
  returnedQuantity?: string;
  pendingQuantity?: string;
}

export interface ReceiptDetail extends ReceiptListItem {
  lines: ReceiptDetailLine[];
}

export interface CreateReturnRequest {
  clientRequestId: string;
  relatedReceiptId: string;
  issueDate: string; // YYYY-MM-DD
  lines: { sourceLineId: string; quantity: number }[];
}