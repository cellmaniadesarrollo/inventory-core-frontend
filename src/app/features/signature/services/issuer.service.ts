import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { CreateIssuerRequest, Issuer, IssuerListResponse, UpdateIssuerRequest } from '../types/issuer.type';

@Injectable({ providedIn: 'root' })
export class IssuersService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/issuers`;

  list() { return this.http.get<IssuerListResponse>(this.base); }
  create(body: CreateIssuerRequest) { return this.http.post<Issuer>(this.base, body); }
  update(id: string, body: UpdateIssuerRequest) { return this.http.put<Issuer>(`${this.base}/${id}`, body); }
}