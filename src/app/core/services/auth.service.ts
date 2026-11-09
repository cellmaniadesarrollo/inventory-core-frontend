import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { JwtPayload, LoginRequest, LoginResponse } from '../models/auth.model';
import { environment } from '../../../environments/environment';

const TOKEN_KEY = 'token';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly http = inject(HttpClient);
    private readonly router = inject(Router);

    private readonly _token = signal<string | null>(this.readToken());

    readonly token = this._token.asReadonly();
    readonly user = computed(() => this.decode(this._token()));

    login(data: LoginRequest) {
        return this.http
            .post<LoginResponse>(`${environment.apiUrl}/auth/login`, data)
            .pipe(
                tap(res => {
                    console.log('login response:', res); // quitar luego
                    if (!res?.token) throw new Error('La respuesta no contiene token');
                    this.saveToken(res.token, !!data.remember);
                }),
            );
    }

    isLoggedIn(): boolean {
        const u = this.decode(this._token());
        if (!u) return false;
        return u.exp ? u.exp * 1000 > Date.now() : true;
    }

    logout() {
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
        this._token.set(null);
        this.router.navigate(['/login']);
    }



    hasGroup(group: string): boolean {
        return this.user()?.groups?.includes(group) ?? false;
    }

    // "Recordarme" => localStorage (dura lo que dure el JWT); si no => sessionStorage
    private saveToken(token: string, remember: boolean) {
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
        (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
        this._token.set(token);
    }

    private readToken(): string | null {
        return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
    }

    private decode(token: string | null): JwtPayload | null {
        if (!token) return null;
        try {
            const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            const json = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
                    .join(''),
            );
            return JSON.parse(json) as JwtPayload;
        } catch {
            return null;
        }
    }
}