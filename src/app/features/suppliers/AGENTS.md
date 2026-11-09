# AGENTS.md (suppliers) — Proveedores

> **Archivo:** `src/app/features/suppliers/AGENTS.md`
> **Alcance:** proveedores: listado, alta, detalle con edición en línea y activar/desactivar. Sus endpoints, tipos, reglas y pendientes.
> **Se edita cuando:** cambia algo dentro de `features/suppliers/` o un contrato de `/suppliers`.
> **Reglas generales** (estilos, plantillas, patrón de listado y de detalle con edición en línea): ver `/AGENTS.md`. No se repiten aquí.
> **Componentes compartidos usados:** ver `src/app/shared/AGENTS.md`.
> **Lo usan otras features (cuidado al cambiar tipos o el diálogo):**
> - `receipts` importa `PaginationMeta`/`PaginatedResponse`, `SupplierDraft` y `SupplierNewDataResponse`, y abre `SupplierFormDialog` al importar por clave de acceso.
> - `stock-vouchers` importa `PaginationMeta`.
> Si se cambia algo de esto, revisar los `AGENTS.md` de `receipts` y `stock-vouchers`.

## 1. Descripción y estado

Hecho:

- **Listado** con búsqueda, filtros, orden y paginación.
- **Alta** (`SupplierFormDialog`), también reutilizable desde ingresos con datos precargados.
- **Detalle** (`SupplierDetailDialog`) con edición en línea y activar/desactivar.

## 2. Estructura

```
features/suppliers/
├── AGENTS.md                      # este archivo
├── suppliers.routes.ts
├── pages/
│   └── supplier-list/
├── components/
│   ├── supplier-form-dialog/      # acepta DIALOG_DATA opcional (SupplierFormDialogData)
│   └── supplier-detail-dialog/
├── services/
│   └── suppliers.service.ts
└── types/
    └── supplier.types.ts          # también exporta PaginationMeta, PaginatedResponse, SupplierDraft, SupplierFormDialogData
```

## 3. Endpoints

Todas requieren token; el `companyId` sale del token. Base: `${environment.apiUrl}/suppliers`.

| Uso | Endpoint |
|---|---|
| Datos del formulario | `GET /suppliers/new-data` (`identificationTypes`, `countries`) |
| Crear | `POST /suppliers` (JSON) → proveedor con `id`, **sin** `country` |
| Listar | `GET /suppliers` (`page`, `limit`, `search`, `status`, `identificationType`, `countryId`, `sortBy`, `sortDir`) → `{ data, meta }` |
| Detalle | `GET /suppliers/:id` → proveedor con `country` |
| Editar | `PATCH /suppliers/:id` (parcial; `tradeName`/`phone`/`email` con `null` o `""` borran el valor) |
| Activar/desactivar | `PATCH /suppliers/:id/status` con `{ status: boolean }` |

El listado de proveedores devuelve `{ data, meta }` (no `{ items, meta }` como productos, ingresos y vales).

## 4. Reglas

- **Solo lectura:** no se pueden editar `identificationType`, `identificationNumber` ni `code`; se muestran de solo lectura.
- **Edición en línea:** patrón de la raíz (`/AGENTS.md`, sección 6): lápiz siempre visible, un campo a la vez, doble confirmación (Guardar → ¿Confirmar? → Sí) y envío solo del campo que cambió.
- **Borrar un valor opcional:** `tradeName`, `phone` y `email` se borran enviando `null` o `""`.
- **Estado:** `Supplier.status` es booleano (no existe `active`). Cambiarlo usa `PATCH /suppliers/:id/status` con `{ status: boolean }`.
- **Crear devuelve sin `country`:** el detalle (`GET /suppliers/:id`) sí lo trae.
- **`SupplierFormDialog` con datos opcionales:** recibe `SupplierFormDialogData` con `inject<SupplierFormDialogData | null>(DIALOG_DATA, { optional: true })`.
  - Con `data: { draft, formData }` abre con `draft` precargado (todos los campos editables) y usa `formData` (`identificationTypes`, `countries`) para evitar otra llamada.
  - Sin `formData` cae a `getNewData()`.
  - Al guardar devuelve el proveedor creado con `dialogRef.close(supplier)`.
- **`SupplierDraft`:** su `source` es `SRI` o `ACCESS_KEY`. Si el SRI no respondió, `businessName` y `address` vienen `null`.
- **Tipos de proveedor:**
  - `SupplierOption` es el mínimo del formulario de ingresos (`id, code, businessName, tradeName, identificationType, identificationNumber`).
  - `SupplierSearchItem` lo extiende con `status` y `label`.
  - Estos dos tipos viven en `receipts` (`receipt.types.ts`) y `suppliers/types/supplier.types.ts` exporta además `PaginationMeta`, `PaginatedResponse`, `SupplierDraft` y `SupplierFormDialogData`.
- **Buscar proveedores desde ingresos:** `GET /receipts/suppliers/search?q=&limit=` (endpoint de `receipts`, no de este módulo).

## 5. Datos de esta feature que NO están en el contexto

- **Código de todos los componentes de `suppliers`:** este archivo se basa en el `AGENTS.md` original; en el hilo donde se separó no se vio código de proveedores. Al ver código real, aplicar la regla 4 de la raíz (el código manda sobre el texto).
- Contenido de `suppliers.routes.ts` y de `suppliers.service.ts`.
- Código de `Country` (entidad) y forma exacta de `identificationTypes` y `countries`.
- Valores válidos de `identificationType` y de `sortBy`.
- Si el listado de proveedores ya muestra o filtra por país.

## 6. Pendientes

- Mover `PaginationMeta` y `PaginatedResponse` a `shared/types` (los usan suppliers, receipts y stock-vouchers). Ver `/AGENTS.md`, sección 9. Al hacerlo, actualizar este archivo y los de `receipts` y `stock-vouchers`.
- Decidir con el negocio si un proveedor inactivo (`status: false`) debe poder usarse en ingresos (hoy solo avisa; ver `receipts/AGENTS.md`).
- Confirmar el catálogo de valores de `identificationType` y `sortBy`.