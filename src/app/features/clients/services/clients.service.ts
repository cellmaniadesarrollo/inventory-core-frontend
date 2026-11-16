import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import {
  BillingCatalogsResponse,
  BillingClient,
  BillingListResponse,
  CreateBillingRequest,
  UpdateBillingRequest,
} from '../types/clients.types';

@Injectable({ providedIn: 'root' })
export class ClientsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/customers/billing`;

  /** Búsqueda por número de identificación. */
  search(idNumber: string) {
    const params = new HttpParams().set('idNumber', idNumber);
    return this.http.get<BillingClient | BillingClient[] | null>(`${this.base}/search`, { params });
  }

  getCatalogs() {
    return this.http.get<BillingCatalogsResponse>(`${this.base}/form-catalogs`);
  }

  create(body: CreateBillingRequest) {
    return this.http.post<BillingClient>(this.base, body);
  }

  update(id: string | number, body: UpdateBillingRequest) {
    return this.http.put<BillingClient>(`${this.base}/${id}`, body);
  }

  list(p: { q?: string; active?: string; page: number; limit: number }) {
    let params = new HttpParams().set('page', p.page).set('limit', p.limit);
    if (p.q) params = params.set('q', p.q);
    if (p.active && p.active !== 'all') params = params.set('active', p.active);
    return this.http.get<BillingListResponse>(`${this.base}/list`, { params });
  }
}