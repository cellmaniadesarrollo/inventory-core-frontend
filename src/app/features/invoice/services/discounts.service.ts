import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { CreateDiscountRequest, DiscountOption } from '../types/invoice.type';

@Injectable({ providedIn: 'root' })
export class DiscountsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/billing-discounts`;

  available() { return this.http.get<DiscountOption[]>(`${this.base}/available`); }
  create(body: CreateDiscountRequest) { return this.http.post<DiscountOption>(this.base, body); }
}