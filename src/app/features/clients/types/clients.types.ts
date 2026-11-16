/** Resultado de GET /customers/billing/search. El backend devuelve las relaciones anidadas. */
export interface BillingClient {
  id: string;
  idType: { id: number; name: string; code: string } | null;
  personType: { id: number; name: string } | null;
  gender: { id: number; name: string } | null;
  idNumber: string;
  firstName: string;
  lastName: string | null;
  tradeName: string | null;
  mainEmail: string;
  cellphone: string | null;
  phone: string | null;
  address: string;
  city: string | null;
  isCompanyClient: boolean;
  isActive: boolean;
}

export interface CatalogOption {
  id: number;
  name: string;
}

export interface IdTypeOption extends CatalogOption {
  code: string;
}

/** GET /customers/billing/form-catalogs */
export interface BillingCatalogsResponse {
  idTypes: IdTypeOption[];
  personTypes: CatalogOption[];
  genders: CatalogOption[];
}

export interface CreateBillingRequest {
  idTypeId: number;
  idNumber: string;
  personTypeId: number;
  genderId?: number;
  firstName: string;
  lastName?: string;
  tradeName?: string;
  mainEmail: string;
  cellphone?: string;
  phone?: string;
  address: string;
}

export type UpdateBillingRequest = Partial<
  Pick<
    CreateBillingRequest,
    'genderId' | 'firstName' | 'lastName' | 'tradeName' | 'mainEmail' | 'cellphone' | 'phone' | 'address'
  > & { isActive: boolean }
>;

export interface BillingDialogResult {
  action: 'created' | 'updated' | 'selected';
  client: BillingClient | null;
}

export interface BillingListResponse {
  items: BillingClient[];
  total: number;
  page: number;
  limit: number;
}