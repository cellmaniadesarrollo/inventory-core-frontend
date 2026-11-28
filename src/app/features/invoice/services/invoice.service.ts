import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { CorrectInvoiceRequest, CorrectInvoiceResponse, CreateCreditNoteRequest, CreateInvoiceRequest, DiscountOption, InvoiceCreated, InvoiceDetail, InvoiceListResponse, PaymentMethodListResponse, VatRateListResponse } from '../types/invoice.type';

@Injectable({ providedIn: 'root' })
export class InvoicesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/sri-invoices`;

  list() { return this.http.get<InvoiceListResponse>(this.base); }
  get(id: string) { return this.http.get<InvoiceDetail>(`${this.base}/${id}`); }
  create(body: CreateInvoiceRequest) { return this.http.post<InvoiceCreated>(this.base, body); }
  vatRates() { return this.http.get<VatRateListResponse>(`${this.base}/vat-rates`); }
  paymentMethods() { return this.http.get<PaymentMethodListResponse>(`${this.base}/payment-methods`); }
  discounts() { return this.http.get<DiscountOption[]>(`${this.base}/billing-discounts/available`); }
  correct(id: string, body: CorrectInvoiceRequest) { return this.http.post<CorrectInvoiceResponse>(`${this.base}/${id}/correct`, body); }
  createCreditNote(body: CreateCreditNoteRequest) { return this.http.post<InvoiceCreated>(`${this.base}/credit-notes`, body); }
  retry(id: string) { return this.http.post<{ id: string; statusCode: string }>(`${this.base}/${id}/retry`, {}); }
}