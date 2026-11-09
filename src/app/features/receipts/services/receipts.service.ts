import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import {
    AccessKeyPreview,
    CreateReceiptRequest,
    ListReceiptsQuery,
    ProductOption,
    Receipt,
    ReceiptDetail,
    ReceiptFiles,
    ReceiptListResponse,
    ReceiptNewDataResponse,
    RegisterPaymentRequest,
    RegisterPaymentResponse,
    SearchProductsResponse,
    SupplierSearchItem,
} from '../types/receipt.types';

/** Nombres de los campos de archivo según el backend */
const DOCUMENT_FIELD = 'document';
const photosField = (i: number) => `photos_${i}`;
const proofField = (i: number) => `proof_${i}`;

@Injectable({ providedIn: 'root' })
export class ReceiptsService {
    private readonly http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/receipts`;

    getNewData() {
        return this.http.get<ReceiptNewDataResponse>(`${this.base}/new-data`);
    }

    searchProducts(term: string) {
        let params = new HttpParams().set('limit', 10);
        if (term) params = params.set('search', term);
        return this.http.get<SearchProductsResponse>(`${this.base}/products/search`, { params });
    }

    create(body: CreateReceiptRequest, files: ReceiptFiles) {
        const fd = new FormData();
        fd.append('data', JSON.stringify(body));

        if (files.document) {
            fd.append(DOCUMENT_FIELD, files.document);
        }

        // Fotos por línea → photos_0, photos_1, ...
        files.lineImages.forEach((imgs, i) => {
            imgs.forEach(f => fd.append(photosField(i), f));
        });

        // Comprobantes de pago → proof_0, proof_1, ...
        files.proofs?.forEach((file, i) => {
            if (file) fd.append(proofField(i), file);
        });

        return this.http.post<Receipt>(this.base, fd);
    }

    searchSuppliers(term: string) {
        let params = new HttpParams().set('limit', 10);
        if (term) params = params.set('q', term);
        return this.http.get<SupplierSearchItem[]>(`${this.base}/suppliers/search`, { params });
    }

    list(query: ListReceiptsQuery, includeFilters = false) {
        let params = new HttpParams();
        for (const [key, value] of Object.entries(query)) {
            const v = typeof value === 'string' ? value.trim() : value;
            if (v !== '' && v !== null && v !== undefined) {
                params = params.set(key, String(v));
            }
        }
        if (includeFilters) params = params.set('includeFilters', 'true');
        return this.http.get<ReceiptListResponse>(this.base, { params });
    }

    registerPayment(id: string, body: RegisterPaymentRequest, proof: File | null) {
        const fd = new FormData();
        fd.append('data', JSON.stringify(body));
        if (proof) fd.append('proof', proof);
        return this.http.post<RegisterPaymentResponse>(`${this.base}/${id}/payments`, fd);
    }
    getOne(id: string) {
        return this.http.get<ReceiptDetail>(`${this.base}/${id}`);
    }
    previewAccessKey(accessKey: string) {
        return this.http.post<AccessKeyPreview>(
            `${environment.apiUrl}/sri/access-key/preview`,
            { accessKey },
        );
    }
}