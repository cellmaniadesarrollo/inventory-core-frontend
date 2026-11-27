// features/invoice/types/billing-service.type.ts
// (ASUMIDO) nombres de campos de las respuestas de billing: ajusta según tus entidades.

export interface ServiceType {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
}

export interface BillingService {
  id: string;
  serviceTypeId: string;
  code: string;
  name: string;
  description?: string | null;
  /** Precio SIN IVA, como string numérico. */
  subtotal: string;
  isActive: boolean;
}

export interface CreateBillingServiceRequest {
  serviceTypeId: string;
  code?: string;
  name: string;
  description?: string;
  subtotal: string;
}

/** El código no se puede cambiar. */
export type UpdateBillingServiceRequest = Omit<CreateBillingServiceRequest, 'code'>;