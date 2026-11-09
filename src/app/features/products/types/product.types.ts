import { ProductOption } from "../../receipts/types/receipt.types";

export type TrackingMode = 'QUANTITY' | 'SERIAL';
export type BillingMode = 'yes' | 'no' | 'optional';

// ===== Catálogos =====
export interface CatalogItem {
    id: string; // UUID (o valor de enum en kinds, areas y trackingModes)
    name: string;
}

// `kind` aún no lo envía el backend en new-data (ver reglas de equipo completo)
export interface ProductTypeItem extends CatalogItem {
    kind?: 'DEVICE' | string;
}

export interface Brand {
    id: number;
    name: string;
}

export interface ProductModel {
    id: number;
    name: string;
}





// ===== Creación =====
export interface NewDataResponse {
    names: CatalogItem[];
    types: ProductTypeItem[];
    colors: CatalogItem[];
    qualities: CatalogItem[];
    brands: Brand[];
    kinds: CatalogItem[];
    usages: UsageOption[];
}

export interface CreateProductRequest {
    productNameId: string;
    productTypeId: string;
    colorId?: string;
    qualityId?: string;
    upc?: string;
    description?: string;
    trackingMode?: TrackingMode;
    basePrice?: number;
    hasTax?: boolean;
    billingMode?: BillingMode;
    billableInRepairOrders?: boolean;
    minStock?: number;
    warrantyDays?: number;
    modelIds?: number[];
    usageIds: string[];
}

export interface CreateProductResponse {
    id: string;
    code: number;
    sku: string;
    name: string;
    imagesCount: number;
    option: ProductOption | null;
}

// ===== Listado =====
export interface ProductFiltersResponse {
    types: CatalogItem[];
    colors: CatalogItem[];
    qualities: CatalogItem[];
    brands: Brand[]; // solo marcas que ya tienen productos
    kinds: CatalogItem[]; // DEVICE | PART | ACCESSORY
    usages: UsageOption[];
    trackingModes: CatalogItem[]; // QUANTITY | SERIAL
}

export type StockStatus = 'OUT' | 'LOW' | 'OK';

export type ProductSortBy = 'createdAt' | 'code' | 'sku' | 'name' | 'basePrice' | 'stock';
export type SortDir = 'ASC' | 'DESC';

// Los filtros vacíos NO se envían: se omiten del objeto
export interface ProductListQuery {
    page: number;
    limit: number;
    search?: string;
    productTypeId?: string;
    kind?: string;
    colorId?: string;
    qualityId?: string;
    brandId?: string;
    modelId?: string;
    usageId?: string;
    trackingMode?: string;
    stockStatus?: string;       // nuevo: OUT | LOW | OK
    status?: string;
    sortBy: ProductSortBy;
    sortDir: SortDir;
    includeFilters?: boolean;   // nuevo: solo en la primera carga
}
export interface ProductStock {
    onHand: number;
    reserved: number;
    available: number;
    availableBillableInSales: number;
    availableBillableInRepairOrders: number;
    lotsWithStock: number;
    salePriceMin: string | null;
    salePriceMax: string | null;
    status: StockStatus;
}

export interface ProductLastLot {
    code: number;
    unitCost: string;
    salePrice: string;
    createdAt: string;
}

export interface ProductListItem {
    id: string;
    code: number;
    sku: string;
    upc: string | null;
    name: string;
    description: string | null;
    kind: string;
    trackingMode: TrackingMode;
    type: { id: string; name: string; code: string };
    color: { id: string; name: string; hex: string | null } | null;
    quality: { id: string; name: string } | null;
    brands: Brand[];
    models: ProductModel[];
    minStock: number;
    warrantyDays: number;
    basePrice: string; // llega como texto: "25.00"
    hasTax: boolean;
    billingMode: BillingMode;
    billableInRepairOrders: boolean;
    status: boolean;
    imageUrl: string | null; // URL firmada que caduca: no guardarla
    createdAt: string;
    usages: UsageOption[];
    stock: ProductStock;
    lastLot: ProductLastLot | null;
}
export interface ListOption { value: string; label: string; }

export interface ListFilters {
    kinds: ListOption[];
    trackingModes: ListOption[];
    stockStatuses: ListOption[];
    productTypes: { id: string; name: string; code: string; kind: string }[];
    qualities: { id: string; name: string }[];
    usages: { id: string; code: string; name: string; area: string }[];
    sortOptions: ListOption[];
}

export interface PageMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface ProductListResponse {
    items: ProductListItem[];
    meta: PageMeta;
    filters?: ListFilters;
}

export interface UsageOption {
    id: string;
    code: string;
    name: string;
    area: string;
}

export interface AuditChange {
    from?: unknown;
    to?: unknown;
}

export interface AuditEntry {
    id: string;
    action: 'CREATED' | 'UPDATED' | 'DELETED' | string;
    userId: string | null;
    changes: Record<string, AuditChange> | null;
    createdAt: string;
}

export interface ProductImageItem {
    id: string;
    url: string; // firmada, caduca
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    sortOrder: number;
    isPrimary: boolean;
    createdAt: string;
}

export interface ProductDetail {
    id: string;
    code: number;
    sku: string;
    upc: string | null;
    description: string | null;
    kind: string;
    trackingMode: TrackingMode;
    name: CatalogItem;
    type: { id: string; name: string; code: string };
    color: { id: string; name: string; hex: string | null } | null;
    quality: { id: string; name: string } | null;
    brands: Brand[];
    models: (ProductModel & { brandId: number; brandName: string })[];
    usages: UsageOption[];
    minStock: number;
    warrantyDays: number;
    basePrice: string;
    hasTax: boolean;
    billingMode: BillingMode;
    billableInRepairOrders: boolean;
    status: boolean;
    createdAt: string;
    updatedAt: string;
    images: ProductImageItem[];
    history: { items: AuditEntry[]; meta: PageMeta };
    stock: ProductDetailStock;
    lots: ProductLot[];
    lotsTruncated: boolean;
    units: ProductUnits;
    movements: ProductMovement[];
}

export interface UpdateProductRequest {
    productNameId?: string;
    colorId?: string | null;
    qualityId?: string | null;
    upc?: string | null;
    description?: string | null;
    basePrice?: number;
    hasTax?: boolean;
    billingMode?: BillingMode;
    billableInRepairOrders?: boolean;
    minStock?: number;
    warrantyDays?: number;
    modelIds?: number[];
    usageIds?: string[];
}

export interface HistoryPage {
    items: AuditEntry[];
    meta: PageMeta;
}
export interface CompatModel extends ProductModel {
    brandId: number;
    brandName: string;
}



export interface ProductDetailStock extends ProductStock {
    avgUnitCost: string | null;
}

export interface ProductLotReceipt {
    id: string;
    code: number;
    issueDate: string;
    documentNumber: string | null;
    status: string;
    supplierName: string | null;
}

export interface ProductLot {
    id: string;
    code: number;
    originType: string;
    quantityReceived: number;
    onHand: number;
    reserved: number;
    available: number;
    consumed: number;
    unitCost: string;
    salePrice: string;
    warrantyDays: number;
    hasTax: boolean;
    priceIncludesTax: boolean;
    billableInSales: boolean;
    billableInRepairOrders: boolean;
    createdAt: string;
    createdById: string | null;
    receipt: ProductLotReceipt | null;
}

export interface ProductUnitItem {
    id: string;
    status: string;
    lotCode: number;
    serials: string[];
    createdAt: string;
}

export interface ProductUnits {
    byStatus: Record<string, number>;
    items: ProductUnitItem[];
    truncated: boolean;
}

export interface ProductMovement {
    id: string;
    type: string;
    quantity: number;
    lotCode: number | null;
    unitCost: string | null;
    referenceType: string | null;
    referenceId: string | null;
    createdById: string | null;
    occurredAt: string;
}