import { Routes } from '@angular/router';

export const STOCK_VOUCHERS_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./pages/stock-voucher-list/stock-voucher-list').then(m => m.StockVoucherList),
    },
];