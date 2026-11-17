import { PaginationMeta } from '../../suppliers/types/supplier.types';

export type CancellationStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';
export type CancellationSortBy = 'createdAt' | 'orderNumber' | 'productName' | 'sku';

// GET /inventory-core/spare-cancellations
export interface SpareCancellationItem {
    id: string;
    requestId: string;
    status: CancellationStatus;
    reason: string | null;
    requestedById: string | null;       // solo id, sin nombre
    errorDetail: string | null;         // solo REJECTED
    createdAt: string;                  // ISO UTC
    confirmedAt: string | null;         // solo CONFIRMED
    order: {
        id: number;
        number: number | null;
        customerName: string | null;    // null si la orden no está replicada
        statusId: number | null;
        statusName: string | null;
        device: string | null;
    };
    originVoucherId: string;
    originVoucherCode: number;
    originLineId: string;
    lineNo: number;
    product: { id: string; sku: string; name: string };
    lot: { id: string; code: number };
    quantity: number;
    returned: number;
    pending: number;
}

export interface SpareCancellationFilters {
    statuses: { value: CancellationStatus; label: string }[];
    sortOptions: { value: CancellationSortBy; label: string }[];
}

export interface SpareCancellationListResponse {
    items: SpareCancellationItem[];
    meta: PaginationMeta;
    filters?: SpareCancellationFilters;
}

export interface ListCancellationsQuery {
    page: number;
    limit: number;
    status: CancellationStatus;
    search: string;
    sortBy: CancellationSortBy;
    sortDir: 'ASC' | 'DESC';
}

// POST /inventory-core/spare-cancellations/:id/reject  (:id = SpareCancellationItem.id)
export interface RejectCancellationRequest {
    reason: string; // 3 a 500; llega a órdenes como error_detail y lo ve quien pidió cancelar
}

export interface RejectCancellationResponse {
    id: string;
    status: 'REJECTED';
    replayed: boolean; // true: ya estaba rechazada, se trata como éxito
}

export interface SpareCancellationRejectDialogData { item: SpareCancellationItem }

/** Lo que devuelve el modal al cerrarse con resultado (cancelar no devuelve nada) */
export type SpareCancellationRejectResult =
    | { kind: 'rejected'; replayed: boolean }
    | { kind: 'conflict'; message: string }; // 409: la fila ya cambió de estado


import { StockVoucherCreated } from './stock-voucher.types';

// POST /inventory-core/spare-cancellations/:id/approve  (:id = SpareCancellationItem.id)
export interface ApproveCancellationRequest {
    reasonId: string; // UUID, motivo de retorno (direction IN, orderLink REQUIRED)
    note?: string;    // ≤ 500
}

// Igual que POST /stock-vouchers (las líneas traen además `attachments`, no usado aquí)
export type ApproveCancellationResponse = StockVoucherCreated & { cancellationRequestId: string };

export interface SpareCancellationApproveDialogData { item: SpareCancellationItem }

export type SpareCancellationApproveResult =
    | { kind: 'approved'; code: number; replayed: boolean }
    | { kind: 'conflict'; message: string }; // 409: la fila ya cambió de estado