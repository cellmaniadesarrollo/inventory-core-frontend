export type IdentificationType = 'RUC' | 'CEDULA' | 'PASSPORT' | 'FOREIGN_ID';

export interface IdentificationTypeOption {
    value: IdentificationType;
    label: string;
}

export interface Country {
    id: string; // UUID
    name: string;
}

// GET /suppliers/new-data
export interface SupplierNewDataResponse {
    identificationTypes: IdentificationTypeOption[];
    countries: Country[];
}

// POST /suppliers (JSON). Los opcionales vacíos NO se envían
export interface CreateSupplierRequest {
    identificationType: IdentificationType;
    identificationNumber: string; // máx. 50
    businessName: string; // máx. 200
    tradeName?: string; // máx. 200
    countryId: string; // UUID
    address: string; // máx. 255
    phone?: string; // máx. 30
    email?: string; // máx. 150
}

// Respuesta 201. El `id` se usará luego para preseleccionar el proveedor en un nuevo ingreso
export interface Supplier {
    id: string;
    companyId: string;
    code: number;
    identificationType: IdentificationType;
    identificationNumber: string;
    businessName: string;
    tradeName?: string | null;
    countryId: string;
    address: string;
    phone?: string | null;
    email?: string | null;
    status: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface SupplierListItem extends Omit<Supplier, 'companyId'> {
    country: Country;
}

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    meta: PaginationMeta;
}

export type SupplierSortBy = 'createdAt' | 'code' | 'name' | 'identification';

export interface ListSuppliersQuery {
    page: number;
    limit: number;
    search: string;
    status: '' | 'true' | 'false';
    identificationType: '' | IdentificationType;
    countryId: string;
    sortBy: SupplierSortBy;
    sortDir: 'ASC' | 'DESC';
}
// GET /suppliers/:id, PATCH /suppliers/:id y PATCH /suppliers/:id/status
export type SupplierDetail = Supplier & { country: Country };

// PATCH /suppliers/:id (parcial). "" o null borra tradeName/phone/email
export interface UpdateSupplierRequest {
    businessName?: string;
    tradeName?: string | null;
    countryId?: string;
    address?: string;
    phone?: string | null;
    email?: string | null;
}

export type SupplierDraftSource = 'SRI' | 'ACCESS_KEY';

export interface SupplierDraft {
    identificationType: IdentificationType;
    identificationNumber: string;
    businessName: string | null;
    tradeName: string | null;
    address: string | null;
    countryId: string | null;
    phone: string | null;
    email: string | null;
    source: SupplierDraftSource;
}

/** Datos opcionales con los que se abre SupplierFormDialog */
export interface SupplierFormDialogData {
    draft?: SupplierDraft;
    /** Si viene, se omite el GET /suppliers/new-data */
    formData?: SupplierNewDataResponse;
}