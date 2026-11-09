# AGENTS.md (products) — Productos

> **Archivo:** `src/app/features/products/AGENTS.md`
> **Alcance:** productos: listado con filtros, creación con imágenes, detalle y gestión de imágenes. Sus endpoints, reglas y pendientes.
> **Se edita cuando:** cambia algo dentro de `features/products/` o un contrato de `/inventory-core` relacionado con productos.
> **Reglas generales** (multipart, estilos, plantillas, patrón de detalle con edición en línea): ver `/AGENTS.md`. No se repiten aquí.
> **Componentes compartidos usados** (`app-image-upload` entre otros): ver `src/app/shared/AGENTS.md`.
> **Depende de:** `receipts` (`ProductOption` desde `receipt.types.ts`). **`receipt.types.ts` no debe importar de `product.types.ts`**: crearía un ciclo.
> **Lo usan otras features:** `stock-vouchers` admite abrir el alta de salida con un producto (`StockVoucherFormDialogData.product`, "para abrir desde la lista de productos"); no se ha verificado si la lista de productos ya tiene ese botón.

## 1. Descripción y estado

Hecho:

- **Listado** con filtros (tipos, clases, áreas), búsqueda, orden y paginación.
- **Creación** de producto con imágenes (`ProductFormDialog`).
- **Detalle** (`ProductDetailDialog`), con el patrón de edición en línea (ver `/AGENTS.md`, sección 6).
- **Imágenes:** `ProductImages` gestiona agregar, poner como principal y eliminar (no se sabe si ya está integrado en el detalle; ver sección 5).

## 2. Estructura

```
features/products/
├── AGENTS.md                      # este archivo
├── products.routes.ts             # router propio de la feature
├── pages/
│   └── product-list/
├── components/
│   ├── product-form-dialog/
│   ├── product-images/            # agregar, poner como principal y eliminar imágenes
│   ├── product-detail-dialog/
│   └── model-picker/              # selector de modelos por marca
├── services/
│   └── products.service.ts
└── types/
    └── product.types.ts           # importa ProductOption desde receipts
```

## 3. Endpoints

Base: `${environment.apiUrl}/inventory-core`.

| Uso | Endpoint |
|---|---|
| Datos del formulario de producto | `GET /inventory-core/new-data` (`names`, `types`, `colors`, `qualities`, `brands`, `kinds`, `usages`) |
| Modelos por marca | `GET /inventory-core/models?brandId=&search=` |
| Crear producto | `POST /inventory-core/products` (**multipart**) |
| Filtros del listado | `GET /inventory-core/products/filters` (`types`, `kinds`, `areas`) |
| Listar productos | `GET /inventory-core/products` (`page`, `limit`, `search`, `productTypeId`, `kind`, `area`, `sortBy`, `sortDir`...) → `{ items, meta }` |
| Subir imágenes | `POST /inventory-core/products/:id/images` (multipart) |
| Poner imagen como principal | `PATCH /inventory-core/products/:id/images/:imageId/primary` |
| Eliminar imagen | `DELETE /inventory-core/products/:id/images/:imageId` |
| Reordenar imágenes | `PUT /inventory-core/products/:id/images/order` con `{ imageIds }` |

## 4. Reglas

> Reglas generales de multipart y de URLs firmadas: `/AGENTS.md`, sección 7.

- **Multipart del producto:** los booleanos se envían como `"true"` / `"false"` (texto); `modelIds` se envía como JSON.
- **Valores por defecto de los usos** (`isSellable`, `isRepairPart`, `isCustomizable`): el formulario los envía en `false`.
- **Regla de equipo completo (`DEVICE`):** en el formulario de producto requiere que `types` de `GET /inventory-core/new-data` incluya `kind`.
- **Imágenes:** no guardar `imageUrl`; son URLs firmadas que caducan. Usar siempre la de la última respuesta.
- **Backend (pendiente):** `buildProductDto` debe convertir a booleano `isSellable`, `isRepairPart` e `isCustomizable`, porque llegan como texto en multipart.

## 5. Datos de esta feature que NO están en el contexto

- **Código de todos los componentes de `products`:** este archivo se basa en el `AGENTS.md` original; en el hilo donde se separó no se vio código de productos. Al ver código real, aplicar la regla 4 de la raíz (el código manda sobre el texto).
- El `.ts` de `model-picker` y si `product-images` ya está integrado en el detalle de producto.
- Contenido de `products.routes.ts` y de `products.service.ts`.
- Si la lista de productos ya tiene un botón para abrir el alta de salida de stock con ese producto (lo admite `StockVoucherFormDialogData.product`).
- **Reglas del backend para imágenes de producto:** nombre del campo (`images`), máximo por producto (se asumió 5), formatos, tamaño y qué ocurre al eliminar la principal.
- Valores de `kind` y cómo se calcula "equipo completo" en `new-data`.

## 6. Pendientes

- Backend: convertir a booleano `isSellable`, `isRepairPart` e `isCustomizable` en `buildProductDto`.
- Confirmar con el backend las reglas de imágenes de producto (campo, máximo, formatos, tamaño, eliminar la principal).
- Confirmar si `product-images` está integrado en `ProductDetailDialog` y, si no, integrarlo.
- Confirmar que `types` de `new-data` incluye `kind` para la regla `DEVICE`.
- Verificar si la lista de productos debe tener un botón para sacar un producto del stock (`StockVoucherFormDialogData.product`).