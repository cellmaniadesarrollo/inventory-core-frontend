export interface LoginRequest {
    username: string;
    password: string;
    latitude?: number;
    longitude?: number;
    remember?: boolean;
}

export interface LoginResponse {
    token: string;
}

// Lo que va dentro del JWT (según tu AuthService del backend)
export interface JwtPayload {
    sub: number | string;
    username: string;
    email: string;
    companyId: number | string;
    companyName: string;
    branchId: number | string;
    branchName: string;
    plan: string;
    limits: Record<string, unknown>;
    features: Record<string, unknown> | string[];
    groups: string[];
    iat: number;
    exp: number;
}