// src/app/features/invoices/services/sales.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import {
  CreateReturnRequest,
  CreateSaleReceiptRequest,
  ReceiptDetail,
  ReceiptListItem,
  SaleSearchQuery,
  SaleSearchResponse,
} from '../types/sale-product.type';

@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly http = inject(HttpClient);

  private readonly searchUrl = `${environment.apiUrl}/inventory-core/products/search-sale`;
  // (ASUMIDO) cámbiala cuando exista en el gateway.
  private readonly receiptsUrl = `${environment.apiUrl}/sales/receipts`;

  /**
   * Búsqueda de productos para venta.
   * - Lector: { q: sku, source: 'SCANNER', lotCode? }
   * - Manual (IMEI, #UPC, SKU, texto libre): { q, source: 'MANUAL' }
   * HttpParams codifica el '#' como %23, así que el UPC llega bien al servidor.
   */
  search(query: SaleSearchQuery) {
    const source = query.source ?? 'MANUAL';
    let params = new HttpParams().set('q', query.q.trim()).set('source', source);
    // lotCode solo se envía con SCANNER; con MANUAL el servidor responde 400.
    if (source === 'SCANNER' && query.lotCode) {
      params = params.set('lotCode', query.lotCode);
    }
    return this.http.get<SaleSearchResponse>(this.searchUrl, { params });
  }

  createReceipt(body: CreateSaleReceiptRequest) {
    return this.http.post<unknown>(this.receiptsUrl, body);
  }

  listReceipts() {
    return this.http.get<{ items: ReceiptListItem[] }>(this.receiptsUrl);
  }

  getReceipt(id: string) {
    return this.http.get<ReceiptDetail>(`${this.receiptsUrl}/${id}`);
  }

  createReturn(body: CreateReturnRequest) {
    return this.http.post<ReceiptListItem>(`${this.receiptsUrl}/returns`, body);
  }
}