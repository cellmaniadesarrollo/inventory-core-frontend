import { Routes } from '@angular/router';
import { adminGuard } from '../../core/guards/admin.guard';

export const INVOICES_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./page/invoice-list/invoice-list').then((m) => m.InvoiceList) },
  { path: 'nueva', loadComponent: () => import('./page/invoice-form/invoice-form').then((m) => m.InvoiceForm) },
  { path: 'servicios', loadComponent: () => import('./page/service-catalog/service-catalog').then((m) => m.ServiceCatalog) },
  {
    path: 'corregir/:id',
    canActivate: [adminGuard],
    loadComponent: () => import('./page/invoice-fix/invoice-fix').then((m) => m.InvoiceFix),
  },
  {
    path: 'notas-credito/nueva',
    canActivate: [adminGuard],
    loadComponent: () => import('./page/credit-note-form/credit-note-form').then((m) => m.CreditNoteForm),
  },
  {
    path: 'notas-credito/nueva/:id',
    canActivate: [adminGuard],
    loadComponent: () => import('./page/credit-note-form/credit-note-form').then((m) => m.CreditNoteForm),
  },
  {
    path: 'retornos/nuevo',
    loadComponent: () => import('./page/return-form/return-form').then((m) => m.ReturnForm),
  },
  {
    path: 'retornos/nuevo/:id',
    loadComponent: () => import('./page/return-form/return-form').then((m) => m.ReturnForm),
  },
];