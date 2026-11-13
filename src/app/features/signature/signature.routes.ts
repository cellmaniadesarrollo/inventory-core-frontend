import { Routes } from '@angular/router';

export const SIGNATURE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./page/signature-list/signature-list').then((m) => m.SignatureList),
  },
];