import { Routes } from '@angular/router';

export const PRODUCTS_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./pages/product-list/product-list').then(m => m.ProductList),
    },
];