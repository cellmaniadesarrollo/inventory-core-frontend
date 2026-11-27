// features/invoice/services/services-catalog.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import {
  BillingService, CreateBillingServiceRequest, ServiceType, UpdateBillingServiceRequest,
} from '../types/billing-service.type';

@Injectable({ providedIn: 'root' })
export class ServicesCatalogService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/billing-services`;

  // (ASUMIDO) los listados devuelven un arreglo, como /billing-discounts/available.
  list(filter: { q?: string; serviceTypeId?: string; onlyActive?: boolean } = {}) {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filter)) {
      if (v !== undefined && v !== '') params = params.set(k, String(v));
    }
    return this.http.get<BillingService[]>(this.base, { params });
  }
  create(body: CreateBillingServiceRequest) { return this.http.post<BillingService>(this.base, body); }
  update(id: string, body: UpdateBillingServiceRequest) { return this.http.patch<BillingService>(`${this.base}/${id}`, body); }
  setActive(id: string, isActive: boolean) { return this.http.patch(`${this.base}/${id}/active`, { isActive }); }

  types() { return this.http.get<ServiceType[]>(`${this.base}/types`); }
  createType(name: string) { return this.http.post<ServiceType>(`${this.base}/types`, { name }); }
}