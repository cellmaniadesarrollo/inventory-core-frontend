import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { CreateSignatureRequest, SignatureCreated, SignatureListResponse, SignatureNewDataResponse } from '../types/signature.type';


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
}