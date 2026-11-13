/** Sucursal asignada a una firma (en el listado). */
export interface SignatureBranchRef {
  id: string;
  name: string;
}

export interface Signature {
  id: string;
  subject: string;
  expiresAt: string; // timestamptz ISO
  active: boolean;
  createdAt: string;
  branches: SignatureBranchRef[];
}

/** GET /signatures (propuesta, sin confirmar) */
export interface SignatureListResponse {
  items: Signature[];
}

/** Sucursal en el selector. `signature` viene lleno si ya tiene una firma asignada. */
export interface BranchOption {
  id: string;
  name: string;
  signature: { id: string; subject: string } | null;
}

/** GET /signatures/new-data (propuesta, sin confirmar) */
export interface SignatureNewDataResponse {
  branches: BranchOption[];
}

/** Va como JSON en el campo `data` del multipart. */
export interface CreateSignatureRequest {
  clientRequestId: string;
  password: string;
  branchIds: string[];
}

/** Respuesta de POST /signatures. La clave y la key de S3 nunca salen. */
export interface SignatureCreated {
  id: string;
  subject: string;
  expiresAt: string;
  active: boolean;
  createdAt: string;
  branchIds?: string[];
  replayed: boolean;
}