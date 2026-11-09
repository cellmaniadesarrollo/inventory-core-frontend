import { PrinterType } from '../../../shared/types/label.types';
import { PaginationMeta, Supplier, SupplierDraft, SupplierNewDataResponse } from '../../suppliers/types/supplier.types';

/** Lo mínimo del proveedor que necesita el formulario (lo cumplen Supplier y SupplierListItem) */
export type SupplierOption = Pick<
    Supplier,
    'id' | 'code' | 'businessName' | 'tradeName' | 'identificationType' | 'identificationNumber'
>;

/** Item devuelto por la búsqueda de proveedores (superset de SupplierOption) */
export interface SupplierSearchItem extends SupplierOption {
    status: boolean;
    label: string; // "1790012345001 - Acme Proveedor S.A."
}

export interface DocumentTypeOption {
    id: string;
    code?: string;
    name: string;
    forcesBillableLot?: boolean;
}

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'CHECK' | 'CARD' | 'OTHER';

export interface LabeledOption<T extends string = string> {
    value: T;
    label: string;
}

// GET /receipts/new-data
export interface ReceiptNewDataResponse {
    branch?: { id: string; name: string };
    documentTypes: DocumentTypeOption[];
    paymentMethods: LabeledOption<PaymentMethod>[];
    defaults?: { issueDate: string };
    enums?: {
        trackingModes: string[];
        productKinds: string[];
    };
}

// ===== POST /receipts =====
export interface CreateReceiptUnit {
    serials: string[]; // 1 a 4
}

// CAMBIO: línea con inventario (la de siempre)
export interface CreateReceiptInventoryLine {
    affectsInventory?: true;
    productId: string;
    quantity: number;
    unitCost: number; // sin impuesto, hasta 4 decimales
    discount?: number; // total de la línea
    purchaseTaxCode?: string;
    purchaseTaxRate?: number;
    salePrice: number;
    warrantyDays: number;
    hasTax?: boolean;
    priceIncludesTax?: boolean;
    billableInSales?: boolean;
    billableInRepairOrders?: boolean;
    units?: CreateReceiptUnit[]; // solo productos SERIAL
    supplierCode?: string;
    supplierDescription?: string;
    supplierQuantity?: number; // quantity del XML, en unidades del proveedor
}

// CAMBIO: línea sin inventario (transporte, servicios, etc.)
export interface CreateReceiptNonInventoryLine {
    affectsInventory: false;
    description: string; // concepto de la línea, ≤ 300
    supplierCode?: string;
    quantity: number;
    unitCost: number;
    discount?: number;
    purchaseTaxCode?: string;
    purchaseTaxRate?: number;
}

// CAMBIO: ahora es una unión
export type CreateReceiptLine = CreateReceiptInventoryLine | CreateReceiptNonInventoryLine;

export interface CreateReceiptPayment {
    amount: number;            // > 0, hasta 2 decimales
    paidAt: string;            // AAAA-MM-DD, no futura
    method: PaymentMethod;
    reference?: string;        // ≤ 100
    note?: string;             // ≤ 500
}

export interface CreateReceiptRequest {
    clientRequestId: string;
    supplierId: string;
    documentTypeId: string;
    documentNumber?: string;
    issueDate: string; // AAAA-MM-DD
    notes?: string;
    accessKey?: string; // CAMBIO: clave de acceso del SRI (49 dígitos)
    lines: CreateReceiptLine[];
    payments?: CreateReceiptPayment[]; // opcional, máx. 50
    labels?: {
        printer: PrinterType;
        items: { lineIndex: number; cant: number }[]; // lineIndex base 0, solo líneas con inventario
    };
}
export interface ReceiptPrintItem {
    lineIndex: number;
    lotId: string;
    cant: number;
    ok: boolean;
    message: string;
}

export interface ReceiptPrintResult {
    ok: boolean;
    printer: PrinterType;
    message?: string; // solo cuando no se pudo preparar la impresión (items: [])
    items: ReceiptPrintItem[];
}
// Respuesta del POST /receipts (summary)
export interface Receipt {
    id: string;
    code?: number;
    source?: string;
    documentNumber?: string | null;
    paymentStatus?: PaymentStatus;
    paidTotal?: string;
    balance?: string;
    payments?: ReceiptPayment[];
    replayed?: boolean;
    print?: ReceiptPrintResult; // solo si se pidió imprimir
}

// ===== Productos =====
export type ProductKind = 'DEVICE' | 'PART' | 'ACCESSORY';

export interface ProductModelRef {
    id: number;
    name: string;
    brand: string;
}

export interface ProductDefaults {
    warrantyDays: number;
    salePrice: string;
    hasTax: boolean;
    priceIncludesTax: boolean;
    billableInSales: boolean;
    billableInRepairOrders: boolean;
}

export interface ProductLastReceipt {
    receiptCode: number;
    issueDate: string; // AAAA-MM-DD
    supplierName: string;
    lotCode: number;
    unitCost: string;
    documentUnitCost: string;
    discount: string;
    purchaseTaxCode: string | null;
    purchaseTaxRate: string | null;
    salePrice: string;
    warrantyDays: number;
    billableInSales: boolean;
    billableInRepairOrders: boolean;
}

// GET /receipts/products?search=&limit=
export interface SupplierProductCode {
    code: string;
    description: string | null;
    unitFactor: string;
}

export interface ProductOption {
    id: string;
    code: number;
    sku: string;
    upc: string | null;
    name: string;
    kind: ProductKind;
    trackingMode: 'SERIAL' | 'QUANTITY';
    typeCode: string;
    color: string | null;
    quality: string | null;
    models: ProductModelRef[];
    defaults: ProductDefaults;
    lastReceipt: ProductLastReceipt | null;
    supplierCodes?: SupplierProductCode[];
}

export interface SearchProductsResponse {
    items: ProductOption[];
}

/** Archivo elegido y aún no enviado. `url` solo existe para imágenes (vista previa) */
export interface PendingFile {
    file: File;
    url: string | null;
}

/** Nombres de campo del multipart (lo que espera prepareReceiptFiles) */
export const RECEIPT_FIELDS = {
    data: 'data',
    document: 'document',
    photos: (lineIndex: number) => `photos_${lineIndex}`,
    proof: (paymentIndex: number) => `proof_${paymentIndex}`,
} as const;

export interface ReceiptFiles {
    document: File | null;
    lineImages: File[][];           // mismo orden que `lines` → photos_0, photos_1...
    proofs?: (File | null)[];      // mismo orden que `payments` → proof_0, proof_1...
}

// GET /receipts
export type ReceiptStatus = 'REGISTERED' | 'VERIFIED' | 'VOIDED';
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';
export type ReceiptSortBy = 'issueDate' | 'code' | 'total' | 'createdAt';

export interface ReceiptListItem {
    id: string;
    code: number;
    status: ReceiptStatus;
    paymentStatus: PaymentStatus;
    paidTotal: string;
    balance: string;
    issueDate: string;
    documentNumber: string | null;
    documentType: { id: string; code: string; name: string };
    supplier: { id: string; name: string; identification: string };
    subtotal: string;
    discountTotal: string;
    taxTotal: string;
    total: string;
    linesCount: number;
    unitsCount: number;
    hasDocument: boolean;
    createdAt: string;
    createdById: string;
    verifiedAt: string | null;
}

export interface ReceiptListFilters {
    statuses: LabeledOption<ReceiptStatus>[];
    paymentStatuses: LabeledOption<PaymentStatus>[];
    documentTypes: { id: string; code: string; name: string; active: boolean }[];
    sortOptions: LabeledOption<ReceiptSortBy>[];
}

export interface ReceiptListResponse {
    items: ReceiptListItem[];
    meta: PaginationMeta;
    filters?: ReceiptListFilters;
}

export interface ListReceiptsQuery {
    page: number;
    limit: number;
    search: string;
    dateFrom: string;
    dateTo: string;
    status: '' | ReceiptStatus;
    paymentStatus: '' | PaymentStatus;
    documentTypeId: string;
    sortBy: ReceiptSortBy;
    sortDir: 'ASC' | 'DESC';
}

// data del POST /receipts/:id/payments
export interface RegisterPaymentRequest {
    clientRequestId: string;
    amount: number;
    paidAt: string;
    method: PaymentMethod;
    reference?: string;
    note?: string;
}

export interface ReceiptPayment {
    id: string;
    amount: string;
    paidAt: string;
    method: PaymentMethod;
    reference: string | null;
    note: string | null;
    hasProof: boolean;
    proofUrl: string | null;
    proofName: string | null;
    proofMime: string | null;
    createdById: string;
    createdAt: string;
    voided: boolean;
    voidedAt: string | null;
    voidedById: string | null;
    voidReason: string | null;
}

export interface ReceiptPaymentSummary {
    receiptId: string;
    paymentStatus: PaymentStatus;
    total: string;
    paidTotal: string;
    balance: string;
}

export interface RegisterPaymentResponse {
    replayed: boolean;
    payment: ReceiptPayment;
    receipt: ReceiptPaymentSummary;
}

export interface ReceiptFile {
    id: string;
    kind: string; // 'DOCUMENT' | 'PHOTO'
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    url: string;
}

export interface ReceiptDetailLine {
    id: string;
    lineNo: number;
    affectsInventory: boolean;      // CAMBIO
    description: string | null;     // CAMBIO
    product: {                      // CAMBIO: null en líneas sin inventario
        id: string;
        code: number;
        sku: string;
        name: string;
        kind: ProductKind;
        trackingMode: 'SERIAL' | 'QUANTITY';
        models: ProductModelRef[];
    } | null;
    quantity: number;
    purchase: {
        unitCost: string;
        discount: string;
        taxCode: string | null;
        taxRate: string | null;
        subtotal: string;
        taxAmount: string;
    };
    lotConfig: {                    // CAMBIO: null en líneas sin inventario
        salePrice: string;
        warrantyDays: number;
        hasTax: boolean;
        priceIncludesTax: boolean;
        billableInSales: boolean;
        billableInRepairOrders: boolean;
    } | null;
    lot: {
        id: string;
        code: number;
        netUnitCost: string;
        quantityReceived: number;
        onHand: number;
        reserved: number;
        available: number;
        consumed: number;
    } | null;
    units?: { id: string; status: string; serials: string[] }[];
    photos?: ReceiptFile[];
}

export interface ReceiptHistoryEntry {
    id: string;
    action: string;
    userId: string | null;
    changes: Record<string, { from?: unknown; to?: unknown }> | null;
    createdAt: string;
}

// GET /receipts/:id
export interface ReceiptDetail {
    id: string;
    code: number;
    status: ReceiptStatus;
    source: string;
    accessKey: string | null;            // CAMBIO
    authorizationNumber: string | null;  // CAMBIO
    authorizationDate: string | null;    // CAMBIO
    hasSourceXml: boolean;               // CAMBIO
    issueDate: string;
    documentNumber: string | null;
    notes: string | null;
    branch: { id: string; name: string };
    documentType: { id: string; code: string; name: string; forcesBillableLot: boolean };
    supplier: {
        id: string;
        code: number;
        businessName: string;
        tradeName: string | null;
        identificationType: string;
        identificationNumber: string;
        address: string;
        phone: string | null;
        email: string | null;
    };
    totals: { subtotal: string; discountTotal: string; taxTotal: string; total: string };
    payment: {
        status: PaymentStatus;
        paidTotal: string;
        balance: string;
        canRegisterPayment: boolean;
        items: ReceiptPayment[]; // del más antiguo al más reciente, incluye anulados
    };
    trace: {
        createdById: string | null;
        createdAt: string;
        verifiedById: string | null;
        verifiedAt: string | null;
        voidedById: string | null;
        voidedAt: string | null;
        voidReason: string | null;
    };
    document: ReceiptFile | null;
    lines: ReceiptDetailLine[];
    unitsTruncated: boolean;
    history: ReceiptHistoryEntry[];
}

export interface AccessKeyInfo {
    accessKey: string;
    issueDate: string;
    documentType: string;
    documentNumber: string;
    issuerRuc: string;
    environment: 'PRODUCTION' | 'TEST' | string;
}

export interface AccessKeySupplier {
    id: string;
    code: number;
    businessName: string;
    tradeName: string | null;
    active: boolean;
}

export interface SriInfo {
    available: boolean;
    state: 'AUTHORIZED' | 'NOT_AUTHORIZED' | 'NOT_FOUND' | null;
    authorizationNumber?: string | null;
    authorizationDate?: string | null;
    message: string | null;
}

export type UnmappedReason = 'NO_MAPPING' | 'NO_CODE' | 'PRODUCT_INACTIVE';

export interface AccessKeyLineSuggestion {
    quantity: number | null;   // null: el factor no da entero
    unitCost: number;          // ya convertido por el factor
}

export interface AccessKeyLine {
    lineNo: number;
    supplierCode: string | null;
    auxiliaryCode?: string | null;
    description: string;
    quantity: number;              // en unidades del proveedor
    unitPrice: number;
    discount: number;              // total de la línea
    subtotal: number;
    tax: { code: string; rate: number } | null;
    match: {
        status: 'MAPPED' | 'UNMAPPED' | 'NON_INVENTORY';
        reason: UnmappedReason | null;
        mapping: { id: string; unitFactor: string } | null;
        product: ProductOption | null;
        suggestion: AccessKeyLineSuggestion | null;
    };
}

export interface DocumentTotals {
    subtotal: string;
    discount: string;
    total: string;
}

export interface AccessKeyPreview {
    canImport: boolean;
    key: AccessKeyInfo;
    existingReceipt: { id: string; code: number; status: string; issueDate: string } | null;
    supplier: SupplierSearchItem | null;   // misma forma que GET suppliers/search
    supplierDraft: SupplierDraft | null;
    supplierForm: SupplierNewDataResponse | null;
    sri: SriInfo;
    warnings: string[];
    lines: AccessKeyLine[];
    documentTotals: DocumentTotals | null;
}