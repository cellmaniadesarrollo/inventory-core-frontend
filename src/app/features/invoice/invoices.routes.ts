import { Routes } from '@angular/router';

export const INVOICES_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./page/invoice-list/invoice-list').then((m) => m.InvoiceList) },
  { path: 'nueva', loadComponent: () => import('./page/invoice-form/invoice-form').then((m) => m.InvoiceForm) },
];