import { PaginationMeta } from '../../suppliers/types/supplier.types';
export type VoucherDirection = 'OUT' | 'IN';
export type OrderLink = 'REQUIRED' | 'FORBIDDEN';

export interface StockVoucherReason {
    id: string;
    code: string;
    name: string;
    direction: VoucherDirection;
    orderLink: OrderLink;
    isReturnable: boolean;
}

// GET /stock-vouchers/new-data
export interface StockVoucherNewDataResponse {
    reasons: StockVoucherReason[];
}

/** Producto mínimo para abrir el modal desde la lista de productos */
export interface StockVoucherProductRef {
    id: string;
    name: string;
    sku: string;
    trackingMode: string; // 'SERIAL' | 'QUANTITY'
}

/** Datos opcionales del modal. Más adelante se agrega `originVoucher` para los retornos */
export interface StockVoucherFormDialogData {
    product?: StockVoucherProductRef;
}

// Respuesta 201 de POST /stock-vouchers
export interface StockVoucherCreated {
    id: string;
    code: number;
    direction: VoucherDirection;
    reason: { id: string; code: string; name: string };
    employeeId: string;
    orderId: number | null;
    orderNumber: string | number | null;
    originVoucherId: string | null;
    note: string | null;
    createdAt: string;
    lines: {
        id: string;
        lineNo: number;
        productId: string;
        lotId: string;
        quantity: number;
        unitCost: string;
        salePrice: string;
        originLineId: string | null;
    }[];
    replayed: boolean;
}

/** Nombres de campo del multipart (deben coincidir con prepareStockVoucherFiles del gateway) */
/** Nombres de campo del multipart */
export const STOCK_VOUCHER_FIELDS = {
    data: 'data',
    photos: (lineIndex: number) => `photos_${lineIndex}`, // base 0, mismo orden que `lines`
} as const;

export interface CreateStockVoucherLine {
    lotId?: string;        // SALIDA
    originLineId?: string; // RETORNO
    quantity: number;      // entero 1 a 100000
    unitIds?: string[];    // solo SERIAL; length = quantity
}

// Campo `data` del POST /stock-vouchers
export interface CreateStockVoucherRequest {
    clientRequestId: string;
    reasonId: string;
    employeeId?: string;       // SALIDA
    orderId?: number;          // SALIDA con orderLink = REQUIRED
    originVoucherId?: string;  // RETORNO
    note?: string;             // ≤ 500
    lines: CreateStockVoucherLine[];
}

// GET /employees/basic
export interface Employee {
    id: string;       // se envía como employeeId
    username: string;
    name: string;     // primer nombre + primer apellido
}

// GET /inventory-orders/search
export interface OrderSearchItem {
    id: number;            // se envía como orderId
    orderNumber: number;   // el número que ve el usuario (#123)
    customerName: string | null;
    device: string | null;
    deviceType: string | null;
    orderType: string | null;
    status: { id: number; name: string };
    canIssue: boolean;     // false: la orden no admite salidas (estados 8, 9, 10)
}

// GET /stock-vouchers/products/:productId/lots
export interface StockLotUnit {
    id: string;        // se envía en unitIds
    serials: string[]; // el primero es el principal
}

export interface StockLot {
    lotId: string;
    code: number;      // número de la etiqueta/QR
    branchId: string;
    onHand: number;
    reserved: number;
    available: number; // máximo a sacar
    salePrice: string;
    warrantyDays: number;
    hasTax: boolean;
    priceIncludesTax: boolean;
    billableInSales: boolean;
    billableInRepairOrders: boolean;
    createdAt: string;
    units: StockLotUnit[]; // vacío en productos por cantidad
}

// GET /stock-vouchers
export type VoucherSortBy = 'createdAt' | 'code';

/** Asumido: confirmar valores con el backend */
export type ReturnStatus = 'NONE' | 'PARTIAL' | 'FULL';

export interface VoucherListItem {
    id: string;
    code: number;
    direction: VoucherDirection;
    reason: { id: string; code: string; name: string; isReturnable: boolean };
    employee: { id: string; name: string | null };   // name null: empleado fuera de la réplica
    createdBy: { id: string; name: string | null };
    orderId: number | null;
    orderNumber: number | null;
    orderStatus: { id: number; name: string } | null;
    customerName: string | null;
    originVoucherId: string | null;                  // solo en retornos
    originVoucher: { id: string; code: number } | null;
    lineCount: number;
    totalQuantity: number;                           // unidades, no líneas
    returnedQuantity: number | null;                 // null en retornos
    pendingQuantity: number | null;                  // null en retornos
    returnStatus: ReturnStatus | null;               // null en retornos
    returnCount: number;
    photoCount: number;
    canReturn: boolean;                              // única condición para mostrar el botón
    returnBlock: string | null;                      // motivo por el que no (p. ej. 'IS_RETURN')
    createdAt: string;                               // ISO UTC
}

export interface VoucherListFilters {
    reasons: StockVoucherReason[];
}

export interface VoucherListResponse {
    items: VoucherListItem[];
    meta: PaginationMeta;
    filters?: VoucherListFilters;
}

export interface ListVouchersQuery {
    page: number;
    limit: number;
    search: string;
    direction: '' | VoucherDirection;
    reasonId: string;
    employeeId: string;
    from: string; // AAAA-MM-DD
    to: string;
    sortBy: VoucherSortBy;
    sortDir: 'ASC' | 'DESC';
}

// GET /stock-vouchers/:id
export interface VoucherPerson { id: string; name: string | null }

export interface VoucherDetailUnit {
    unitId: string;
    serials: string[];
    returned: boolean; // solo útil en salidas
}

export interface VoucherAttachment {
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    url: string; // firmada, 30 min
}

export interface VoucherDetailLine {
    id: string;
    lineNo: number;
    productId: string;
    productSku: string;
    lotId: string;
    lotCode: number;
    quantity: number;
    unitCost: string;
    salePrice: string;
    billableInSales: boolean;
    billableInRepairOrders: boolean;
    originLineId: string | null;
    units: VoucherDetailUnit[];
    attachments: VoucherAttachment[];
    returned?: number; // solo en salidas
    pending?: number;  // solo en salidas
}

export interface VoucherDetail {
    id: string;
    code: number;
    direction: VoucherDirection;
    reason: { id: string; code: string; name: string; isReturnable: boolean } | null;
    employee: VoucherPerson | null;
    createdBy: VoucherPerson | null;
    order: {
        id: number;
        orderNumber: number;
        statusId: number | null;
        statusName: string | null;
        customerName: string | null;
    } | null;
    originVoucher: { id: string; code: number } | null;
    returns: { id: string; code: number; createdAt: string }[];
    note: string | null;
    createdAt: string;
    lines: VoucherDetailLine[];
}

export interface StockVoucherDetailDialogData { id: string }

/** Datos del diálogo de retorno: el vale de salida ya cargado en el detalle */
export interface StockVoucherReturnDialogData { voucher: VoucherDetail }

