import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { CreateInvoiceRequest, DiscountOption, InvoiceCreated, InvoiceListResponse, PaymentMethodListResponse, VatRateListResponse } from '../types/invoice.type';

@Injectable({ providedIn: 'root' })
export class InvoicesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/sri-invoices`;

  list() { return this.http.get<InvoiceListResponse>(this.base); }
  create(body: CreateInvoiceRequest) { return this.http.post<InvoiceCreated>(this.base, body); }
  vatRates() { return this.http.get<VatRateListResponse>(`${this.base}/vat-rates`); }
  paymentMethods() { return this.http.get<PaymentMethodListResponse>(`${this.base}/payment-methods`); }
  discounts() { return this.http.get<DiscountOption[]>(`${this.base}/billing-discounts/available`); }
}