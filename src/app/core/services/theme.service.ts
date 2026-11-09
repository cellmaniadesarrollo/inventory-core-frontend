import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'inventario-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
    readonly theme = signal<Theme>(this.initialTheme());

    constructor() {
        effect(() => {
            const t = this.theme();
            document.documentElement.classList.toggle('dark', t === 'dark');
            try {
                localStorage.setItem(STORAGE_KEY, t);
            } catch { }
        });
    }

    toggle() {
        this.theme.update(t => (t === 'dark' ? 'light' : 'dark'));
    }

    private initialTheme(): Theme {
        try {
            const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
            if (saved === 'light' || saved === 'dark') return saved;
        } catch { }
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
}