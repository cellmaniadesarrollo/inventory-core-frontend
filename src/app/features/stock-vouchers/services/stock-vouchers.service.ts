import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { CreateStockVoucherRequest, Employee, ListVouchersQuery, OrderSearchItem, STOCK_VOUCHER_FIELDS, StockLot, StockVoucherCreated, StockVoucherNewDataResponse, VoucherDetail, VoucherListResponse } from '../types/stock-voucher.types';
import { SearchProductsResponse } from '../../receipts/types/receipt.types';

@Injectable({ providedIn: 'root' })
export class StockVouchersService {
    private readonly http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/stock-vouchers`;

    getNewData() {
        return this.http.get<StockVoucherNewDataResponse>(`${this.base}/new-data`);
    }
    /**
     * Multipart: `data` primero, luego los archivos.
     * `lineImages[i]` = fotos de la línea i del JSON (máx. 5 c/u). Sin Content-Type manual.
     */
    create(body: CreateStockVoucherRequest, lineImages: File[][] = []) {
        const fd = new FormData();
        fd.append(STOCK_VOUCHER_FIELDS.data, JSON.stringify(body));
        lineImages.forEach((files, i) => {
            for (const f of files) fd.append(STOCK_VOUCHER_FIELDS.photos(i), f, f.name);
        });
        return this.http.post<StockVoucherCreated>(this.base, fd);
    }

    getEmployees() {
        return this.http.get<Employee[]>(`${environment.apiUrl}/employees/basic`);
    }

    searchOrders(search: string) {
        let params = new HttpParams();
        const term = search.trim().slice(0, 100);
        if (term) params = params.set('search', term); // vacío: se omite y devuelve las 20 más recientes
        return this.http.get<OrderSearchItem[]>(`${environment.apiUrl}/inventory-orders/search`, { params });
    }

    getLots(productId: string) {
        return this.http.get<StockLot[]>(`${this.base}/products/${productId}/lots`);
    }
    // dentro de la clase:
    searchProducts(search: string, limit = 20) {
        let params = new HttpParams().set('limit', limit);
        const term = search.trim();
        if (term) params = params.set('search', term);
        return this.http.get<SearchProductsResponse>(`${environment.apiUrl}/receipts/products/search`, { params });
    }

    list(query: ListVouchersQuery, includeFilters = false) {
        let params = new HttpParams();
        for (const [key, value] of Object.entries(query)) {
            const v = typeof value === 'string' ? value.trim() : value;
            if (v !== '' && v !== null && v !== undefined) params = params.set(key, String(v));
        }
        if (includeFilters) params = params.set('includeFilters', 'true');
        return this.http.get<VoucherListResponse>(this.base, { params });
    }

    getOne(id: string) {
        return this.http.get<VoucherDetail>(`${this.base}/${id}`);
    }
}