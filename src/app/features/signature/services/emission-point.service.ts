import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment'; // AJUSTAR
import {
  CreateEmissionPointRequest,
  EmissionPoint,
  EmissionPointUsers,
  EmployeeOption,
  MyEmissionPointsResponse,
  UpdateEmissionPointRequest,
} from '../types/emission-point.type';

@Injectable({ providedIn: 'root' })
export class EmissionPointService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/issuers`; // AJUSTAR

  list(branchId: string): Observable<{ items: EmissionPoint[] }> {
    return this.http.get<{ items: EmissionPoint[] }>(
      `${this.base}/branches/${branchId}/emission-points`,
    );
  }

  create(branchId: string, body: CreateEmissionPointRequest): Observable<EmissionPoint> {
    return this.http.post<EmissionPoint>(
      `${this.base}/branches/${branchId}/emission-points`,
      body,
    );
  }

  update(id: string, body: UpdateEmissionPointRequest): Observable<EmissionPoint> {
    return this.http.patch<EmissionPoint>(`${this.base}/emission-points/${id}`, body);
  }

  listMine(branchId: string): Observable<MyEmissionPointsResponse> {
    return this.http.get<MyEmissionPointsResponse>(`${this.base}/branches/${branchId}/emission-points/mine`);
  }

  getUsers(id: string): Observable<EmissionPointUsers> {
    return this.http.get<EmissionPointUsers>(`${this.base}/emission-points/${id}/users`);
  }

  setUsers(id: string, userIds: string[]): Observable<EmissionPointUsers> {
    return this.http.put<EmissionPointUsers>(`${this.base}/emission-points/${id}/users`, { userIds });
  }

    /** AJUSTAR: ruta y campos según el controller de usuarios del gateway. */
  listEmployees(): Observable<EmployeeOption[]> {
    return this.http.get<any>(`${environment.apiUrl}/users`).pipe(
      map((r) =>
        (r?.items ?? r ?? []).map((u: any) => ({
          id: u.id,
          name: [u.firstName ?? u.employee?.firstName, u.lastName ?? u.employee?.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() || u.username || u.email || u.id,
        })),
      ),
    );
  }
}