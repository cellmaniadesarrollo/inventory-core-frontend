export interface EmissionPoint {
  id: string;
  branchId: string;
  code: string;
  name: string;
  isDefault: boolean;
  active: boolean;
}

export interface CreateEmissionPointRequest {
  code: string;
  name: string;
}

export interface UpdateEmissionPointRequest {
  name?: string;
  active?: boolean;
  isDefault?: boolean;
}

export interface MyEmissionPointsResponse {
  items: EmissionPoint[];
  restricted: boolean;
}
export interface EmissionPointUsers { userIds: string[]; }

export interface EmployeeOption {
  id: string;
  name: string;
}