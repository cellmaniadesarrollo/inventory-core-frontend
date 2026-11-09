import { Component } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-dashboard',
  styleUrl: './dashboard.css',
  templateUrl: './dashboard.html',
})
export class Dashboard {
  // Datos de ejemplo: se reemplazarán con el backend
  readonly stats = [
    { titulo: 'Productos', valor: 128, color: 'text-blue-600' },
    { titulo: 'Stock total', valor: 3450, color: 'text-green-600' },
    { titulo: 'Stock bajo', valor: 12, color: 'text-amber-600' },
    { titulo: 'Agotados', valor: 4, color: 'text-red-600' },
  ];

  readonly movimientos = [
    { fecha: '2026-10-12', producto: 'Teclado Logitech', tipo: 'Entrada', cantidad: 20 },
    { fecha: '2026-10-11', producto: 'Mouse HP', tipo: 'Salida', cantidad: 5 },
    { fecha: '2026-10-11', producto: 'Monitor 24"', tipo: 'Entrada', cantidad: 10 },
  ];

}
