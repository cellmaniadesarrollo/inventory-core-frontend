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

export interface InvoiceCreated extends Invoice { replayed: boolean; }
export interface InvoiceListResponse { items: Invoice[]; }
export interface VatRateOption { code: string; name: string; percentage: number; }
export interface VatRateListResponse { items: VatRateOption[]; }
export interface PaymentMethodOption { code: string; name: string; }
export interface PaymentMethodListResponse { items: PaymentMethodOption[]; }