import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import {
    CreateProductRequest,
    CreateProductResponse,
    HistoryPage,
    NewDataResponse,
    ProductDetail,
    ProductFiltersResponse,
    ProductListQuery,
    ProductListResponse,
    ProductModel,
    UpdateProductRequest,
} from '../types/product.types';

@Injectable({ providedIn: 'root' })
export class ProductsService {
    private readonly http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/inventory-core`;

    // ===== Creación =====
    getNewData() {
        return this.http.get<NewDataResponse>(`${this.base}/new-data`);
    }

    getModels(brandId: number, search?: string) {
        let params = new HttpParams().set('brandId', brandId);
        if (search) params = params.set('search', search);
        return this.http.get<ProductModel[]>(`${this.base}/models`, { params });
    }

    // Multipart: los campos van antes que los archivos
    create(body: CreateProductRequest, files: File[] = []) {
        const fd = new FormData();
        for (const [key, value] of Object.entries(body)) {
            if (value === undefined || value === null || value === '') continue;
            fd.append(key, key === 'modelIds' ? JSON.stringify(value) : String(value));
        }
        for (const f of files) fd.append('images', f, f.name);
        return this.http.post<CreateProductResponse>(`${this.base}/products`, fd);
    }

    // ===== Listado =====
    getFilters() {
        return this.http.get<ProductFiltersResponse>(`${this.base}/products/filters`);
    }

    list(query: ProductListQuery) {
        let params = new HttpParams();
        for (const [key, value] of Object.entries(query)) {
            // Un filtro no seleccionado no se envía (ni vacío ni null)
            if (value === undefined || value === null || value === '') continue;
            params = params.set(key, String(value));
        }
        return this.http.get<ProductListResponse>(`${this.base}/products`, { params });
    }

    getOne(id: string) {
        return this.http.get<ProductDetail>(`${this.base}/products/${id}`);
    }

    update(id: string, body: UpdateProductRequest) {
        return this.http.patch<{ id: string; code: number; sku: string }>(`${this.base}/products/${id}`, body);
    }

    remove(id: string) {
        return this.http.delete<{ id: string; sku: string; deleted: boolean }>(`${this.base}/products/${id}`);
    }

    history(id: string, page: number, limit = 20) {
        return this.http.get<HistoryPage>(`${this.base}/products/${id}/history`, { params: { page, limit } });
    }
    // ===== Imágenes =====
    addImages(productId: string, files: File[]) {
        const fd = new FormData();
        for (const f of files) fd.append('images', f, f.name);
        return this.http.post<unknown>(`${this.base}/products/${productId}/images`, fd);
    }

    setPrimaryImage(productId: string, imageId: string) {
        return this.http.patch<unknown>(`${this.base}/products/${productId}/images/${imageId}/primary`, {});
    }

    removeImage(productId: string, imageId: string) {
        return this.http.delete<unknown>(`${this.base}/products/${productId}/images/${imageId}`);
    }

    reorderImages(productId: string, imageIds: string[]) {
        return this.http.put<unknown>(`${this.base}/products/${productId}/images/order`, { imageIds });
    }

}