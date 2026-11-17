import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { ApproveCancellationRequest, ApproveCancellationResponse, ListCancellationsQuery, RejectCancellationResponse, SpareCancellationListResponse } from '../types/spare-cancellation.types';

@Injectable({ providedIn: 'root' })
export class SpareCancellationsService {
    private readonly http = inject(HttpClient);
    // Prefijo del gateway sin confirmar
    private readonly base = `${environment.apiUrl}/inventory-core/spare-cancellations`;

    list(query: ListCancellationsQuery, includeFilters = false) {
        let params = new HttpParams();
        for (const [key, value] of Object.entries(query)) {
            const v = typeof value === 'string' ? value.trim() : value;
            if (v !== '' && v !== null && v !== undefined) params = params.set(key, String(v));
        }
        if (includeFilters) params = params.set('includeFilters', 'true');
        return this.http.get<SpareCancellationListResponse>(this.base, { params });
    }
    // dentro de la clase:
    reject(id: string, reason: string) {
        return this.http.post<RejectCancellationResponse>(`${this.base}/${id}/reject`, { reason: reason.trim() });
    }
    approve(id: string, body: ApproveCancellationRequest) {
        return this.http.post<ApproveCancellationResponse>(`${this.base}/${id}/approve`, body);
    }
}