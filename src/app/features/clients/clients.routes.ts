import { Routes } from '@angular/router';

export const CLIENTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/clients-search/clients-search').then((m) => m.ClientsSearch),
  },
];