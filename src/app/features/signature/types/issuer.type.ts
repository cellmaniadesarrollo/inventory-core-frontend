export interface IssuerBranch {
  id: string;
  name: string;
  establishmentCode: string | null;
  address: string | null;
}

export interface Issuer {
  id: string;
  ruc: string;
  legalName: string;
  tradeName: string | null;
  headquartersAddress: string;
  specialTaxpayer: string | null;
  accountingRequired: boolean;
  environment: 1 | 2;
  emissionType: 1;
  active: boolean;
  hasLogo: boolean;
  branches: IssuerBranch[];
}

export interface IssuerListResponse { items: Issuer[]; }

export interface CreateIssuerRequest {
  ruc: string;
  legalName: string;
  tradeName?: string;
  headquartersAddress: string;
  specialTaxpayer?: string;
  accountingRequired?: boolean;
  environment?: 1 | 2;
}

export type UpdateIssuerRequest = Partial<Omit<CreateIssuerRequest, 'ruc'>> & { active?: boolean };