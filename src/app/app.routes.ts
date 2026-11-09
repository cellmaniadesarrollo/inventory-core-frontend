import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
    {
        path: 'login',
        loadComponent: () => import('./features/auth/login/login').then(m => m.Login),
    },
    {
        path: '',
        loadComponent: () => import('./layout/main-layout/main-layout').then(m => m.MainLayout),
        canActivate: [authGuard],
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            {
                path: 'dashboard',
                loadComponent: () => import('./features/dashboard/dashboard').then(m => m.Dashboard),
            },
            {
                path: 'productos',
                loadChildren: () =>
                    import('./features/products/products.routes').then(m => m.PRODUCTS_ROUTES),
            },
            {
                path: 'proveedores', // O 'suppliers', según el nombre de la URL que prefieras
                loadChildren: () =>
                    import('./features/suppliers/suppliers.routes').then(m => m.SUPPLIERS_ROUTES),
            },
            {
                path: 'ingresos',
                loadChildren: () =>
                    import('./features/receipts/receipts.routes').then(m => m.RECEIPTS_ROUTES),
            },
            {
                path: 'movimientos',
                loadChildren: () =>
                    import('./features/stock-vouchers/stock-vouchers.routes').then(m => m.STOCK_VOUCHERS_ROUTES),
            },
        ],
    },
    { path: '**', redirectTo: 'login' },
];