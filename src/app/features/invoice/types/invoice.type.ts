export type InvoiceStatus = 'BORRADOR' | 'FIRMADO' | 'RECIBIDO' | 'PPR' | 'AUT' | 'NAT' | 'DEVUELTO';

export interface InvoiceLineRequest {
  productId?: string;     // producto de inventario (vacío en línea manual)
  lotId?: string;
  unitId?: string;
  mainCode: string;
  description: string;
  quantity: number;
  unitPrice: number;      // SIN IVA
  discount?: number;
  vatRateCode: string;    // código de sri_vat_rates
}

export interface InvoicePaymentRequest {
  methodCode: '01' | '15' | '16' | '17' | '18' | '19' | '20' | '21';
  amount: number;
  term?: number;
  timeUnit?: string;
}

export interface CreateInvoiceRequest {
  clientRequestId: string;
  branchId: string;
  emissionPointId?: string; // opcional: si no se envía, el backend usa el punto por defecto
  issueDate: string;      // YYYY-MM-DD
  orderId?: string;
  buyerIdTypeCode: '04' | '05' | '06' | '07' | '08';
  buyerIdNumber: string;
  buyerName: string;
  buyerAddress?: string;
  buyerEmail?: string;
  lines: InvoiceLineRequest[];
  payments: InvoicePaymentRequest[];
  tip?: number;
}

export interface Invoice {
  id: string;
  series: string;
  sequence: string;
  accessKey: string | null;
  statusCode: InvoiceStatus;
  issueDate: string;
  buyerName: string;
  buyerIdNumber: string;
  subtotal: string;
  vatValue: string;
  total: string;
  authorizationNumber: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  documentTypeCode?: string;            // NUEVO: '01' factura, '04' NC
  reason?: string | null;               // NUEVO: motivo (NC)
  modifiedDocumentId?: string | null;   // NUEVO: factura que modifica (NC)
}

export interface DiscountOption {
  id: string;
  name: string;
  type: 'NORMAL' | 'CREDITO';
  valueKind: 'PERCENT' | 'AMOUNT';
  value: string; // decimal como string, igual que la entidad
}

export interface CreateDiscountRequest {
  name: string;
  type: 'NORMAL' | 'CREDITO';
  valueKind: 'PERCENT' | 'AMOUNT';
  value: number;
}

export interface InvoiceDetailLine {
  id: string;
  position: number;
  mainCode: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  lineTotal: string;
  vatRateCode?: string;
  creditedQuantity?: string;   // NUEVO: ya devuelto por NC
  pendingQuantity?: string;    // NUEVO: pendiente de devolver
}

export interface InvoiceDetail {
  id: string;
  series: string;
  sequence: string;
  statusCode: string;
  documentTypeCode?: string;   // NUEVO
  issueDate?: string;          // NUEVO
  buyerIdTypeCode: string | null;
  buyerIdNumber: string | null;
  buyerName: string;
  buyerAddress: string | null;
  buyerEmail: string | null;
  subtotal: string;
  totalDiscount: string;
  vatValue: string;
  total: string;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  sriMessages: unknown[] | null;
  lines: InvoiceDetailLine[];
}

export interface CorrectLineRequest {
  id: string;
  mainCode: string;
  description: string;
  unitPrice: number;
  vatRateCode: string;
}

export interface CorrectInvoiceRequest {
  buyerIdTypeCode: string;
  buyerIdNumber: string;
  buyerName: string;
  buyerAddress?: string;
  buyerEmail?: string;
  lines?: CorrectLineRequest[];
}

// NUEVO: nota de crédito
export interface CreditNoteLineRequest {
  sourceLineId: string;
  quantity: number;
}

export interface CreateCreditNoteRequest {
  clientRequestId: string;
  modifiedDocumentId: string;
  issueDate: string;           // YYYY-MM-DD
  reason: string;
  lines: CreditNoteLineRequest[];
  returnStock?: boolean;
}

export interface CorrectInvoiceResponse { id: string; signed: boolean; }
export interface InvoiceCreated extends Invoice { replayed: boolean; }
export interface InvoiceListResponse { items: Invoice[]; }
export interface VatRateOption { code: string; name: string; percentage: number; }
export interface VatRateListResponse { items: VatRateOption[]; }
export interface PaymentMethodOption { code: string; name: string; }
export interface PaymentMethodListResponse { items: PaymentMethodOption[]; }