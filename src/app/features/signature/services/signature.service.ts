import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { CreateSignatureRequest, Signature, SignatureCreated, SignatureListResponse, SignatureNewDataResponse, UpdateSignatureBranchesRequest } from '../types/signature.type';
export interface UpdateSignatureIssuerRequest { issuerId: string | null; }

@Injectable({ providedIn: 'root' })
export class SignaturesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/signatures`;

  list() {
    return this.http.get<SignatureListResponse>(this.base);
  }

  getNewData() {
    return this.http.get<SignatureNewDataResponse>(`${this.base}/new-data`);
  }

  /** Multipart: el JSON va en `data` ANTES que el archivo. No se fija Content-Type. */
  create(body: CreateSignatureRequest, file: File) {
    const form = new FormData();
    form.append('data', JSON.stringify(body));
    form.append('file', file, file.name);
    return this.http.post<SignatureCreated>(this.base, form);
  }

  updateBranches(id: string, body: UpdateSignatureBranchesRequest) {
    return this.http.put<Signature>(`${this.base}/${id}/branches`, body);
  }

  updateIssuer(id: string, body: UpdateSignatureIssuerRequest) {
    return this.http.put<Signature>(`${this.base}/${id}/issuer`, body);
  }
}