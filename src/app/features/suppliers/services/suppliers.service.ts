import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { CreateSupplierRequest, ListSuppliersQuery, PaginatedResponse, Supplier, SupplierDetail, SupplierListItem, SupplierNewDataResponse, UpdateSupplierRequest } from '../types/supplier.types';

@Injectable({ providedIn: 'root' })
export class SuppliersService {
    private readonly http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/suppliers`;

    getNewData() {
        return this.http.get<SupplierNewDataResponse>(`${this.base}/new-data`);
    }

    create(body: CreateSupplierRequest) {
        return this.http.post<Supplier>(this.base, body);
    }
    list(query: ListSuppliersQuery) {
        let params = new HttpParams();
        for (const [key, value] of Object.entries(query)) {
            const v = typeof value === 'string' ? value.trim() : value;
            if (v !== '' && v !== null && v !== undefined) params = params.set(key, String(v));
        }
        return this.http.get<PaginatedResponse<SupplierListItem>>(this.base, { params });
    }
    getOne(id: string) {
        return this.http.get<SupplierDetail>(`${this.base}/${id}`);
    }

    update(id: string, body: UpdateSupplierRequest) {
        return this.http.patch<SupplierDetail>(`${this.base}/${id}`, body);
    }

    setStatus(id: string, status: boolean) {
        return this.http.patch<SupplierDetail>(`${this.base}/${id}/status`, { status });
    }
}