import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { PrintLabelsRequest, PrintLabelsResponse } from '../types/label.types';

@Injectable({ providedIn: 'root' })
export class LabelsService {
    private readonly http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/labels`;

    print(body: PrintLabelsRequest) {
        return this.http.post<PrintLabelsResponse>(`${this.base}/print`, body);
    }
}