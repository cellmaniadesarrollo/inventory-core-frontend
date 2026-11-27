import { Routes } from '@angular/router';

export const INVOICES_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./page/invoice-list/invoice-list').then((m) => m.InvoiceList) },
  { path: 'nueva', loadComponent: () => import('./page/invoice-form/invoice-form').then((m) => m.InvoiceForm) },
  { path: 'servicios', loadComponent: () => import('./page/service-catalog/service-catalog').then((m) => m.ServiceCatalog) },
];