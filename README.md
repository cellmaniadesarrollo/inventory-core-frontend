# AGENTS.md — inventario-ms

## 1. Descripción

Frontend de un sistema de inventario multi-empresa y multi-sucursal. Es una SPA Angular (standalone) que consume un backend NestJS vía gateway (`/auth`, `/inventory-core`, `/suppliers`, `/receipts`, `/sri`, `/stock-vouchers`, `/employees`, `/inventory-orders`).

Estado actual:

- Login con JWT, layout con sidebar colapsable (escritorio) y panel móvil, tema claro/oscuro, dashboard con datos de ejemplo.
- **Productos:** listado con filtros, creación con imágenes y detalle. Botón **"Sacar stock"** por fila (abre el modal de movimiento con el producto precargado; deshabilitado si `stock.available <= 0`).
- **Proveedores:** listado (búsqueda, filtros, orden, paginación), alta, detalle con edición en línea y activar/desactivar.
- **Ingresos:** listado con filtros, alta (proveedor y productos con buscador, seriales/IMEI, documento y fotos adjuntas, **líneas sin inventario**, **importación por clave de acceso del SRI**), detalle (resumen, productos, pagos, historial) y registro de pagos con comprobante.
- **Movimientos (stock-vouchers):** **en construcción.** Existe la feature, la ruta `/movimientos`, el ítem de menú y el modal "Nuevo movimiento" (salida) con motivo, empleado, orden, repuestos con lotes/unidades y fotos por producto. **Falta** `validate()`, `submit()` y el `POST` (paso 4), el listado (paso 5), el detalle y el retorno (paso 6) y el resumen por orden (paso 7). Ver sección 10.
- Stock (pantalla propia) aún no existe.

## 2. Stack

| Área | Detalle |
|---|---|
| Framework | Angular `^22.0.0` (standalone, sin NgModules). **Zoneless** (ver reglas) |
| CLI / builder | `@angular/cli` y `@angular/build` `^22.0.5` (`@angular/build:application`) |
| Lenguaje | TypeScript `~6.0.2` |
| Estilos | Tailwind CSS `^4.3.3` + `@tailwindcss/postcss` + `postcss` + `autoprefixer` |
| UI | Sin Angular Material. Componentes propios + Tailwind. Iconos SVG en línea (Heroicons outline) |
| Modales / overlays | `@angular/cdk` (Dialog, Overlay, Scrolling). Versión no visible en el contexto: ver `package.json` |
| Estado | Signals. No hay NgRx ni otra librería |
| HTTP / async | `HttpClient` + RxJS `~7.8.0` |
| Testing | `ng test` (`@angular/build:unit-test`) con `vitest ^4.0.8` y `jsdom ^28` |
| Formato | `prettier ^3.8.1` (no se vio su configuración) |
| Gestor | npm (`npm@11.16.0`) |

## 3. Estructura

```
.postcssrc.json            # OBLIGATORIO en la raíz (ver reglas)
src/
├── index.html             # script anti-parpadeo del tema (clave: inventario-theme)
├── styles.css             # tokens de tema, clases reutilizables, scrollbars
├── environments/environment.ts   # apiUrl
└── app/
    ├── app.config.ts / app.routes.ts
    ├── core/              # models/, services/ (auth, theme), guards/, interceptors/
    ├── layout/main-layout/        # sidebar + topbar + <router-outlet />
    ├── shared/components/
    │   ├── theme-toggle/
    │   ├── autocomplete/          # buscador tipo Google, genérico (searchFn), con "crear nuevo"
    │   ├── image-upload/          # arrastrar y soltar + selector + cámara; acepta imágenes y PDF
    │   ├── camera-dialog/         # modal de cámara; devuelve un File JPEG
    │   └── image-lightbox-dialog/ # visor de imágenes (LightboxData: images[], startIndex)
    └── features/
        ├── auth/login/
        ├── dashboard/
        ├── products/
        │   ├── products.routes.ts         # router propio de la feature
        │   ├── pages/product-list/        # incluye openMovement(p) → StockVoucherFormDialog
        │   ├── components/                # product-form-dialog, product-images, product-detail-dialog, model-picker
        │   ├── services/products.service.ts
        │   └── types/product.types.ts     # importa ProductOption desde receipts
        ├── suppliers/
        │   ├── suppliers.routes.ts
        │   ├── pages/supplier-list/
        │   ├── components/                # supplier-form-dialog (acepta DIALOG_DATA opcional), supplier-detail-dialog
        │   ├── services/suppliers.service.ts
        │   └── types/supplier.types.ts    # también exporta PaginationMeta, PaginatedResponse, SupplierDraft, SupplierFormDialogData
        ├── receipts/
        │   ├── receipts.routes.ts         # RECEIPTS_ROUTES
        │   ├── pages/receipt-list/
        │   ├── components/                # receipt-form-dialog, receipt-detail-dialog, payment-status-dialog (registro de pagos; exporta PaymentStatusDialog y PaymentDialogData), access-key-dialog
        │   ├── services/receipts.service.ts
        │   └── types/receipt.types.ts
        └── stock-vouchers/
            ├── stock-vouchers.routes.ts   # STOCK_VOUCHERS_ROUTES (ruta /movimientos)
            ├── pages/stock-voucher-list/  # por ahora solo carcasa con botón "Nuevo movimiento"
            ├── components/                # stock-voucher-form-dialog (modal de salida; luego también retorno)
            ├── services/stock-vouchers.service.ts   # base = `${apiUrl}/stock-vouchers`
            └── types/stock-voucher.types.ts
```

Cada feature es el equivalente standalone de un "módulo": su propia carpeta con `pages/`, `components/`, `services/`, `types/` y un `<feature>.routes.ts` que se carga con `loadChildren`.

Notas de dependencias entre tipos:

- `receipts` importa `PaginationMeta`/`PaginatedResponse`, `SupplierDraft` y `SupplierNewDataResponse` desde `suppliers`. Si se agregan más features con paginación, moverlos a `shared/types`.
- `products/types/product.types.ts` importa `ProductOption` desde `receipt.types.ts`. **`receipt.types.ts` no debe importar de `product.types.ts`** (crearía un ciclo).
- `stock-vouchers` importa `ProductOption` y `SearchProductsResponse` desde `receipts`. `products` importa `StockVoucherFormDialog` y tipos desde `stock-vouchers`. **`stock-voucher.types.ts` no debe importar de `product.types.ts`** (el modal usa su propia referencia mínima `StockVoucherProductRef` para no crear ciclos).

## 4. Rendering, routing y datos

- **Rendering:** CSR. Proyecto creado con `--ssr=false`; `angular.json` no tiene SSR ni hidratación.
- **Routing:** todo con `loadComponent` / `loadChildren` (lazy). `/login` es pública. El layout (`path: ''`) lleva `canActivate: [authGuard]`; **todas las vistas del admin van en sus `children`** (`dashboard`, `productos`, `proveedores`, `ingresos`, `movimientos`...). `**` redirige a `login`.
- **HTTP:** `provideHttpClient(withInterceptors([authInterceptor]))`. El interceptor añade `Authorization: Bearer <token>` y llama a `logout()` ante un 401 (salvo en `/auth/login`). La empresa, el usuario y la sucursal salen del token: no se envían en las peticiones. **El interceptor no debe fijar `Content-Type: application/json` a los `FormData`.**
- **Sesión:** `AuthService` guarda el token en un signal; va a `localStorage` con "remember" y a `sessionStorage` si no (clave `token`). `user()` es el payload decodificado del JWT.
- **Otras claves de storage:** `inventario-theme`, `inventario-sidebar-collapsed`.
- **Estado de pantalla:** signals. En listados, un signal `query` es la fuente de verdad: `toObservable(...).pipe(switchMap(...))` dispara cada carga y cancela la anterior. Para forzar recarga con los mismos filtros se usa un contador (`reloadTick`) combinado con `query`, o `query.update(q => ({ ...q }))`.

### Endpoints que usa el front (según la documentación recibida)

**Auth y productos**

| Uso | Endpoint |
|---|---|
| Login | `POST /auth/login` → `{ token }` |
| Datos del formulario de producto | `GET /inventory-core/new-data` (`names`, `types`, `colors`, `qualities`, `brands`, `kinds`, `usages`) |
| Modelos por marca | `GET /inventory-core/models?brandId=&search=` |
| Crear producto | `POST /inventory-core/products` (**multipart**) |
| Filtros del listado | `GET /inventory-core/products/filters` (`types`, `kinds`, `areas`) |
| Listar productos | `GET /inventory-core/products` (`page`, `limit`, `search`, `productTypeId`, `kind`, `area`, `sortBy`, `sortDir`...) → `{ items, meta }` |
| Imágenes de producto | `POST /inventory-core/products/:id/images` (multipart), `PATCH .../images/:imageId/primary`, `DELETE .../images/:imageId`, `PUT .../images/order` (`{ imageIds }`) |

**Proveedores** (todas requieren token; el `companyId` sale del token)

| Uso | Endpoint |
|---|---|
| Datos del formulario | `GET /suppliers/new-data` (`identificationTypes`, `countries`) |
| Crear | `POST /suppliers` (JSON) → proveedor con `id`, **sin** `country` |
| Listar | `GET /suppliers` (`page`, `limit`, `search`, `status`, `identificationType`, `countryId`, `sortBy`, `sortDir`) → `{ data, meta }` |
| Detalle | `GET /suppliers/:id` → proveedor con `country` |
| Editar | `PATCH /suppliers/:id` (parcial; `tradeName`/`phone`/`email` con `null` o `""` borran el valor) |
| Activar/desactivar | `PATCH /suppliers/:id/status` con `{ status: boolean }` |

No se pueden editar `identificationType`, `identificationNumber` ni `code`: se muestran de solo lectura.

**Ingresos** (base `ReceiptsService.base` = `${apiUrl}/receipts`)

| Uso | Endpoint |
|---|---|
| Datos del formulario | `GET /receipts/new-data` → `{ documentTypes, paymentMethods, defaults?, enums? }` |
| Buscar productos | `GET /receipts/products/search?search=&limit=` → `{ items }` (cada item trae `defaults`, `lastReceipt` y, si aplica, `supplierCodes`). **También lo consume `StockVouchersService.searchProducts`.** |
| Buscar proveedores | `GET /receipts/suppliers/search?q=&limit=` → arreglo de `SupplierSearchItem` (`id, code, identificationType, identificationNumber, businessName, tradeName, status, label`) |
| Crear ingreso | `POST /receipts` (**multipart**: `data` con JSON, `document` opcional, `photos_<índice>` y `proof_<índice>` opcionales) |
| Listar | `GET /receipts` (`page`, `limit`, `search`, `dateFrom`, `dateTo`, `status`, `paymentStatus`, `documentTypeId`, `productId`, `sortBy`, `sortDir`, `includeFilters`) → `{ items, meta, filters? }` |
| Detalle | `GET /receipts/:id` |
| Registrar pago | `POST /receipts/:id/payments` (**multipart**: `data` con JSON, `proof` opcional) |

**SRI** (no cuelga de `/receipts`: se usa `environment.apiUrl` directo)

| Uso | Endpoint |
|---|---|
| Consultar factura por clave de acceso | `POST /sri/access-key/preview` con `{ accessKey }` (49 dígitos; acepta espacios o guiones) |

Si el módulo de ingresos cuelga de `inventory-core`, las rutas pasan a `/inventory-core/receipts...`: se cambia en una sola constante (`base`) de `ReceiptsService`.

Endpoints eliminados por el backend (no usar): `PATCH /receipts/:id/payment-status` y `GET /receipts/:id/payment-history`. El estado de pago lo calcula el sistema a partir de los pagos.

**Movimientos / vales** (base `StockVouchersService.base` = `${apiUrl}/stock-vouchers`; contrato v1, 31-oct-2026, con los cambios indicados)

| Uso | Endpoint | Estado en el front |
|---|---|---|
| Datos del formulario | `GET /stock-vouchers/new-data` → `{ reasons: [{ id, code, name, direction, orderLink, isReturnable }] }` | Hecho |
| Lotes con stock de un producto | `GET /stock-vouchers/products/:productId/lots` → lotes del más antiguo al más nuevo, **con `units` embebido** (`[{ id, serials[] }]`, vacío en productos por cantidad) | Hecho |
| Empleados | `GET /employees/basic` → arreglo plano `{ id, username, name }`, sin búsqueda ni paginación | Hecho |
| Buscar órdenes | `GET /inventory-orders/search?search=` → arreglo plano, máx. 20 | Hecho |
| Crear vale | `POST /stock-vouchers` (**multipart**, ver abajo) | **Pendiente (paso 4)** |
| Listado | `GET /stock-vouchers` (`page`, `limit`, `sortBy`, `sortDir`, `direction`, `reasonId`, `employeeId`, `orderId`, `from`, `to`, `search`, `includeFilters`) → `{ items, meta, filters? }` | Pendiente (paso 5) |
| Detalle | `GET /stock-vouchers/:id` | Pendiente (paso 6) |
| Resumen de una orden | `GET /stock-vouchers/orders/:orderId` | Pendiente (paso 7) |
| ~~Unidades de un lote~~ | ~~`GET /stock-vouchers/lots/:lotId/units`~~ | **No se usa en este modal**: las unidades ya vienen dentro de `lots` |

Prefijos por verificar contra el gateway real: `/employees/basic` y `/inventory-orders/search` se llaman con `environment.apiUrl` directo (no cuelgan de `/stock-vouchers`). Si el gateway usa `/inventory-core/...`, cambiarlo en el servicio.

### Contrato de `POST /sri/access-key/preview`

Respuesta 200 (`AccessKeyPreview`):

- `canImport`: `false` si ya hay un ingreso con esa clave. Entonces `existingReceipt` trae `id`, `code`, `status`, `issueDate`, **no se consulta al SRI** y `sri.available` es `false`.
- `key`: `accessKey`, `issueDate`, `documentType` (ej. `FACTURA`), `documentNumber`, `issuerRuc`, `environment`. Salen de la factura si el SRI respondió; si no, de la clave.
- `supplier`: si el RUC ya existe, trae la misma forma que `GET suppliers/search` (`SupplierSearchItem`). Si es `null`, el RUC no está registrado.
- `supplierDraft` y `supplierForm`: solo cuando `supplier` es `null`. `supplierDraft.source` es `SRI` o `ACCESS_KEY` (si el SRI no respondió, `businessName` y `address` vienen `null`). `supplierForm` trae `identificationTypes` y `countries` para evitar otra llamada.
- `sri`: `available`, `state` (`AUTHORIZED` | `NOT_AUTHORIZED` | `NOT_FOUND` | `null`), `authorizationNumber`, `authorizationDate`, `message`.
- `lines[]`: una por línea de la factura. `match.status` es `MAPPED`, `UNMAPPED` o `NON_INVENTORY`.
  - `MAPPED`: `match.product` es un `ProductOption` completo (mismo objeto que el buscador). `match.suggestion` trae `quantity` (puede ser `null` si el factor no da entero) y `unitCost`, **ya convertidos por el factor** (caja x10 → unidades).
  - `UNMAPPED`: `product` y `suggestion` son `null`. `reason`: `NO_MAPPING`, `NO_CODE` o `PRODUCT_INACTIVE`.
  - `NON_INVENTORY`: `product` y `suggestion` son `null`; el front crea la línea con `affectsInventory: false`.
  - Con proveedor no registrado todas salen `UNMAPPED`. Tras crearlo hay que volver a llamar a `preview` (consulta otra vez al SRI).
- `documentTotals`: `subtotal`, `discount`, `total` como string. `null` si no hay XML.
- `warnings`: avisos no bloqueantes.
- Si el SRI falla o no hay XML: `lines` es `[]` y `documentTotals` es `null`.
- **Latencia:** hasta ~15 s (dos intentos de 7 s). Mostrar indicador de carga.
- Errores 400: clave sin 49 dígitos, dígito verificador incorrecto, fecha inválida, comprobante que no es factura. 401 sin sesión.

### Contrato de `POST /receipts` (campo `data`)

- `accessKey` (opcional): el ingreso queda como importado; el servidor consulta al SRI y guarda el XML. Si el SRI no responde, se guarda igual sin XML. No sobrescribe lo que mande el formulario.
- **Línea con inventario** (por defecto, `affectsInventory` omitido o `true`): `productId`, `quantity`, `unitCost`, `salePrice`, `warrantyDays`, opcionales (`discount`, `purchaseTaxCode`, `purchaseTaxRate`, banderas, `units`).
- **Línea sin inventario:** `affectsInventory: false` y `description` obligatoria. **No** lleva `productId`, `salePrice`, `warrantyDays` ni `units`. Sí `quantity`, `unitCost`, `discount` e impuesto; suma a totales y al tope de pagos.
- `supplierCode` (cualquier línea), `supplierDescription` y `supplierQuantity` (cantidad del XML en unidades del proveedor): el backend aprende `código → producto` (o `código → no inventario`). Si el usuario cambia la cantidad, el factor se actualiza solo.
- Un mismo `supplierCode` con destinos distintos dentro del mismo ingreso es 400. Dos líneas con el mismo código y el mismo destino son válidas.
- Errores nuevos: `400` (línea sin inventario con `productId`/`units` o sin `description`, clave inválida), `409` ("Esa clave de acceso ya fue importada en otro ingreso").
- El backend **no** valida que el RUC de la clave coincida con el proveedor elegido (decisión de flexibilidad).

### Contrato de `GET /receipts/:id` (cambios)

- Cada línea trae `affectsInventory` y `description`. En líneas sin inventario, `product`, `lot` y `lotConfig` son `null` y `units` está vacío.
- El detalle trae `source` (`MANUAL` | `ACCESS_KEY`), `accessKey`, `authorizationNumber`, `authorizationDate` (ISO con zona) y `hasSourceXml`.
- Anular un ingreso genera `RECEIPT_VOID` solo para líneas con lote.

### Contrato de movimientos (vales)

**Conceptos**

- Un vale es el documento del movimiento. Es **inmutable**: no se edita ni se borra. Un error se corrige con un retorno.
- **Salida (OUT):** saca stock de lotes concretos hacia un empleado, con o sin orden según el motivo. **Retorno (IN):** devuelve parte o todo de un vale de salida; referencia el vale original, hereda empleado, orden y sucursal, y vuelve al mismo lote.
- Todo sale de la **sucursal principal**. **El lote lo elige el usuario**: no hay FIFO automático.
- Producto `SERIAL`: se eligen unidades (`unitIds`) y `quantity` = `unitIds.length`. Producto por cantidad: no lleva `unitIds`.
- Ids UUID v4, excepto `orderId`, que es **entero**. Cantidades enteras. Dinero (`unitCost`, `salePrice`, `netBillableAmount`) llega como string: **solo se muestra**.

**Motivos de sistema (vienen de `new-data`; no se quedan fijos en el front)**

| Motivo | Dirección | Orden | Admite retorno |
|---|---|---|---|
| REPARACION DAÑO | OUT | obligatoria | sí |
| USO LAB | OUT | prohibida | sí |
| REMANOFACTURAR | OUT | prohibida | no |
| RECICLAJE | OUT | prohibida | no |
| NO REQUERIDO | IN | solo sobre salidas con orden | — |
| DEVOLUCION | IN | solo sobre salidas sin orden | — |

Estados de orden: `8 ENTREGADA` es inmutable (sin salidas ni retornos). `9 PASAR A BODEGA` y `10 EN INVENTARIO` no admiten salidas nuevas pero sí retornos. El servidor siempre revalida; el front solo lo usa para deshabilitar botones.

**`POST /stock-vouchers` — MULTIPART (cambió respecto del contrato v1, que decía JSON)**

- `data`: JSON del vale (se anexa **antes** que los archivos). No fijar `Content-Type`.
- `photos_<índice>`: fotos de la línea con ese índice (**base 0**, mismo orden que `lines` en `data`). Hasta 5 por línea. Solo `image/*`. Todas opcionales.
- Un campo con otro nombre responde 400. Un índice `>=` número de líneas responde 400 ("Fotos para la línea 4, pero el vale tiene 3 líneas").
- Límites: 5 MB por foto (tras convertir a WebP; el gateway reduce y convierte a WebP) y 25 MB en total.
- Body de `data`: `clientRequestId` (uuid, requerido), `reasonId` (requerido), `employeeId` (SALIDA: requerido; RETORNO: no enviar), `orderId` (SALIDA con `orderLink = REQUIRED`; RETORNO: no enviar), `originVoucherId` (RETORNO: requerido; SALIDA: no enviar), `note` (≤ 500), `lines` (1 a 100).
- Cada línea: `lotId` (SALIDA) u `originLineId` (RETORNO), `quantity` (entero 1–100000), `unitIds` (solo SERIAL, length = quantity).
- **Una línea del JSON = un lote.** Un mismo lote no puede repetirse en dos líneas. Un retorno no puede superar el `pending` de la línea original. En serializados solo regresan unidades con `returned = false`.
- No enviar campos fuera del contrato: el gateway puede rechazarlos con 400.
- Respuesta 201: vale creado + `replayed: boolean`. **Idempotencia:** igual que ingresos (ver reglas). Mismo id y mismo contenido → 201 con `replayed: true` (éxito). Mismo id con contenido distinto → 409. 409 por conflicto al generar el código → reintentar con el MISMO `clientRequestId`.
- Mensajes de error ya vienen en español ("Línea 2: …", líneas desde 1). `message` puede ser string o arreglo.

**`GET /stock-vouchers/products/:productId/lots`**

- Solo lotes con existencias en la sucursal principal; `[]` si no hay.
- Campos: `lotId`, `code` (número de etiqueta/QR), `branchId`, `onHand`, `reserved`, `available` (máximo a sacar), `salePrice`, `warrantyDays`, `hasTax`, `priceIncludesTax`, `billableInSales`, `billableInRepairOrders`, `createdAt`, `units`.
- `salePrice` y banderas son informativos (el vale las congela). No trae costo ni si el producto es serializado: eso sale de `trackingMode` del producto.

**`GET /employees/basic`**

- Sin parámetros; arreglo plano `{ id, username, name }` (`name` = primer nombre + primer apellido). Sin orden garantizado; pueden repetirse nombres (se desambigua con `username`).
- Se carga **una vez** y se filtra en el cliente (`shareReplay(1)`, sin tildes ni mayúsculas). `id` se envía como `employeeId`.

**`GET /inventory-orders/search?search=`**

- `search` opcional (máx. 100). `#123` busca el número exacto (devuelve la orden aunque esté en 8/9/10, con `canIssue: false`). Sin `#`, busca por palabras en cliente, marca, modelo y, con 6+ caracteres, serial/IMEI. Vacío → las 20 más recientes. Con texto libre solo aparecen órdenes que admiten salidas.
- Respuesta: `{ id, orderNumber, customerName, device, deviceType, orderType, status: { id, name }, canIssue }[]`. **Se envía `id` como `orderId`** (no `orderNumber`). `#abc` responde 400 ("Número de orden inválido. Use el formato #123.").
- Los retornos no usan este buscador: heredan la orden del vale original.

## 5. Comandos

```bash
npm install
npm start          # ng serve (development), http://localhost:4200
npm run build      # ng build (production por defecto)
npm run watch      # ng build --watch --configuration development
npm test           # ng test
ng g c features/<modulo>/pages/<nombre>   # genera sin .spec.ts
ng add @angular/cdk                        # ya usado para los modales
```

No hay script de lint ni de e2e en `package.json`.

## 6. Convenciones

- **Archivos sin sufijo `.component`:** `login.ts`, `login.html`, `login.css`. La clase tampoco: `Login`, `ProductList`, `SupplierFormDialog`, `ReceiptDetailDialog`, `AccessKeyDialog`, `StockVoucherFormDialog`.
- Cada componente: 3 archivos separados (`.ts`, `.html`, `.css`) con `templateUrl` y `styleUrl`. Prefijo de selector `app-`. (`AccessKeyDialog` aún no tiene `styleUrl`; agregarlo si se quiere uniformar.)
- **DI:** `inject()` como campo de clase, no constructor. Datos de entrada de un diálogo: `inject<T | null>(DIALOG_DATA, { optional: true })`.
- **Estado:** `signal`, `computed`, `effect`, `input()`, `output()`, `model()`. Campos `readonly` cuando no se reasignan.
- **Plantillas:** control flow nuevo (`@if`, `@for` con `track`, `@else`, `@empty`, `@switch`, `@let`). No `*ngIf` ni `*ngFor`. **No usar funciones flecha en plantillas**: mover la lógica a un método del `.ts`.
- **Formularios:** reactivos con `nonNullable`. Textos obligatorios con `Validators.pattern(/\S/)` además de `required`. En diálogos con muchos campos (ingreso, movimiento) se valida a mano en un método `validate()` que devuelve el mensaje de error y se muestra en un aviso.
- **Modales:** `Dialog` de `@angular/cdk/dialog`. El modal se cierra con `dialogRef.close(resultado)` y quien lo abre lee `ref.closed`. Los modales de creación devuelven el recurso creado; los de detalle devuelven `true` si hubo cambios para que el listado se recargue. Formularios largos (ingreso, pago, movimiento) usan `disableClose: true`.
- **Listas flotantes:** el `app-autocomplete` usa una lista absoluta simple (`ul` con `mousedown` + `preventDefault` para no perder el foco). Si se necesita posicionamiento más robusto, usar `CdkConnectedOverlay`.
- **Estilos:** utilidades Tailwind v4 y los tokens/clases de `styles.css`:
  - Tokens: `bg-bg`, `bg-surface`, `bg-surface-hover`, `border-border`, `text-text`, `text-text-muted`, `text-text-subtle`, `bg-primary`, `bg-primary-soft`.
  - Clases: `surface-card`, `input-field`, `btn-primary`, `nav-item`, `nav-item-active`, `text-heading`, `text-body`.
  - Listados en filas-tarjeta: `row-card`, `row-col`, `col-label`, `col-valor`.
  - Tema oscuro: clase `.dark` en `<html>`, gestionada por `ThemeService`.
  - Avisos: ámbar (`border-amber-300/60 bg-amber-500/10 text-amber-700 dark:text-amber-300`) para advertencias, rojo para errores, esmeralda para éxito. Son colores semánticos, no base.
  - `shadow-xs` se usa en varias vistas; si no existe en el Tailwind del proyecto, cambiar a `shadow-sm`.
- **Patrón de listado (proveedores, ingresos):** encabezado con total + botón "Nuevo", panel de búsqueda/filtros/orden, tarjetas en móvil (`md:hidden`) y tabla en escritorio (`hidden md:block`), paginación con selector de filas, botón "Ver detalle". Búsqueda con debounce de 300 ms. (Productos usa tarjetas en ambas vistas.)
- **Patrón de detalle con edición en línea (productos, proveedores):** cabecera con degradado, secciones etiqueta | valor, lápiz **siempre visible**, edición de un campo a la vez con doble confirmación (Guardar → ¿Confirmar? → Sí) y envío solo del campo que cambió.
- **Patrón de detalle de solo lectura con pestañas (ingresos):** `Resumen`, `Productos`, `Pagos`, `Historial`. La lista de pagos es compacta (una fila por pago con miniatura de 40 px que abre el lightbox). El bloque de clave de acceso (clave en grupos de 7, copiar, autorización, insignia de XML) va en la sección "Documento" del resumen.
- **Mensajes de error del backend:** `message` puede ser un arreglo; se unen con `', '` y se muestran en un aviso dentro de la pantalla (no hay sistema de toasts). Los avisos de éxito son temporales (`flash`, 3 a 5 s).
- Los tests están desactivados al generar (`skipTests: true`).
- **Modal de movimiento (estructura):** cabecera fija, cuerpo con scroll (`flex-1 overflow-y-auto`) y pie fijo solo con el aviso de error y los botones. Secciones del cuerpo en orden: Motivo → Empleado (+ Orden si `orderLink = REQUIRED`) → Repuestos (líneas con lotes y fotos). Cada sección es una tarjeta `rounded-2xl border border-border/70 bg-surface/30 p-3.5`.

## 7. Reglas / NO hacer

- **No** borrar `.postcssrc.json`:
  ```json
  { "plugins": { "@tailwindcss/postcss": {} } }
  ```
  Sin él, Tailwind no compila (iconos SVG gigantes, vistas sin estilo). Reinicia `ng serve` si lo cambias.
- **El CSS propio va dentro de `@layer components`** (o `base`). El CSS sin capa le gana a las utilidades de Tailwind y rompe overrides.
- **No** usar sintaxis de Tailwind v3: `bg-gradient-to-*` es `bg-linear-to-*`. No hay `tailwind.config.js`. Para forzar una utilidad: sufijo `!`. (Hay plantillas existentes que aún usan `bg-gradient-to-br`; migrarlas.)
- **No** hardcodear colores base (`bg-white`, `text-gray-700`): usar tokens para que funcione el modo oscuro.
- **No** registrar rutas del admin fuera de los `children` del layout.
- **No** `import` estático de páginas en rutas: siempre lazy.
- **No** enviar filtros vacíos al backend: se omiten del `HttpParams`. Cualquier cambio de filtro o búsqueda vuelve a `page=1`.
- **No** guardar `imageUrl`/`proofUrl`/`url` de archivos: son URLs firmadas que caducan; usar siempre la de la última respuesta (recargar el detalle las renueva).
- **Zoneless:** la pantalla solo se actualiza cuando cambia un **signal** o ocurre un evento del DOM. Los datos que llegan de forma asíncrona (HTTP) y se guardan en `FormControl` / `FormArray` **no refrescan la vista**: llamar a `inject(ChangeDetectorRef).markForCheck()` después de asignarlos (caso real: `loadLots` del modal de movimiento se quedaba en "Cargando lotes..."). Con signals no hace falta.
- **Multipart:** los campos de texto/JSON se anexan **antes** que los archivos. No fijar `Content-Type` a mano (el navegador agrega el boundary).
  - Producto: booleanos como `"true"`/`"false"`; `modelIds` como JSON.
  - Ingreso: JSON en `data`; archivos con los nombres **`document`**, **`photos_<índice de línea>`** y **`proof_<índice de pago>`**, donde el índice es **base 0** y sigue el orden de `lines` / `payments` en el JSON. Las líneas sin inventario mandan `[]` de fotos (no rompe el índice).
  - Pago: JSON en `data`; comprobante en **`proof`** (un solo archivo, imagen o PDF).
  - Vale de stock: JSON en `data`; fotos en **`photos_<índice de línea>`** (base 0, orden de `lines`, hasta 5 por línea, solo imágenes). Se arman `lines` y `lineImages` **en un solo recorrido** (`buildPayload`) para que los índices siempre coincidan.
- **Idempotencia (`clientRequestId`):** en ingresos, pagos **y vales de stock** se genera con `crypto.randomUUID()` **una vez al abrir el diálogo** y se reutiliza en todo reintento. Solo se genera uno nuevo al abrir otro diálogo. Deshabilitar el botón mientras la petición está en curso. En pagos y vales, `replayed: true` se trata como éxito.
- **Montos de ingresos, pagos y vales:** llegan como `string` (`subtotal`, `total`, `paidTotal`, `balance`, `documentTotals`, `unitCost`, `salePrice`, `netBillableAmount`...). **Solo se muestran; no se hacen cálculos con ellos.** Las únicas cuentas del front son los totales en vivo del formulario de alta de ingresos (estimado visual) y la comparación "Según factura" contra `documentTotals.total` (tolerancia ±0.01; solo informativa).
- **Fechas `AAAA-MM-DD`** (`issueDate`, `paidAt`, filtros `from`/`to` de vales): formatear cortando el string; **no** pasar por `Date`/`DatePipe` (evita desfases de zona horaria). `createdAt`, `authorizationDate` y similares (ISO con hora) sí usan `DatePipe` (p. ej. `createdAt` del lote en el modal de movimiento).
- **Listado de ingresos:** pedir `includeFilters=true` solo hasta recibir `filters` una vez; no enviarlo después. **No existe filtro `supplierId`** (el backend responde 400): el proveedor se busca escribiendo su nombre o RUC en `search`. Ajustar el rango de fechas para que `dateFrom <= dateTo`. Los tipos de documento con `active: false` van al final con la marca "(inactivo)".
- **Registrar pago:** el botón se deshabilita si el ingreso está `VOIDED` o `PAID`, o si `payment.canRegisterPayment` es `false` en el detalle. No se valida en el front que el monto no supere el saldo: el backend responde 409 con el pendiente y se muestra ese mensaje.
- **Ingreso, productos repetidos:** al elegir un producto ya agregado no se duplica la línea (suma 1 unidad, o agrega un equipo si es `SERIAL`). Para productos `SERIAL`, la cantidad es siempre el número de equipos (cada equipo admite de 1 a 4 IMEI/seriales) y no puede haber seriales repetidos en el mismo ingreso.
- **Ingreso, datos precargados:** al elegir un producto se carga el último ingreso (`lastReceipt`) si existe; si no, los `defaults` del producto. El costo precargado es `documentUnitCost` (costo tal como viene en el documento), no `unitCost`. El descuento no se precarga. Un solo camino para todos los orígenes: buscador, producto creado y `match.product` de la factura pasan por `applyProduct`.
- **Ingreso, líneas sin inventario:** `affectsInventory = false` oculta precio de venta, garantía, fotos, opciones de venta y seriales; exige `description`. `quantity` debe ser entero 1–100000 también aquí. Se crean con "+ Línea sin inventario", con `markNonInventory` (desde una línea `UNMAPPED`) o desde una línea `NON_INVENTORY` de la factura. `assignProduct` las convierte de nuevo en líneas con inventario (así el backend corrige el mapeo).
- **Ingreso, importación por clave de acceso (reglas):**
  - Botón en la cabecera de `ReceiptFormDialog` → abre `AccessKeyDialog` (consulta, muestra detalle y devuelve `AccessKeyPreview` al aceptar). El formulario guarda el resultado en `accessKeyData` y llama a `applyAccessKey`.
  - **Aceptar** solo se habilita si `canImport` es `true` y hay proveedor. Ya existente → se muestra el ingreso previo.
  - Proveedor no registrado → se abre `SupplierFormDialog` con `data: { draft: supplierDraft, formData: supplierForm }` (todos los campos editables; sin `formData` cae a `getNewData()`). Al crearlo, se **repite el `preview`** para traer mapeos y sugerencias; si falla, se usa un respaldo con las líneas `UNMAPPED`.
  - `applyAccessKey` precarga proveedor, `issueDate`, `documentNumber` y `documentTypeId` (busca en `options().documentTypes` por `code` o `name` en mayúsculas contra `key.documentType`; si no hay coincidencia, avisa y deja elegir). Si ya hay líneas, pide confirmar el reemplazo (`confirm()` del navegador, pendiente reemplazar por diálogo propio).
  - Cada línea importada guarda su `AccessKeyLine` en el control `source`. De ahí salen `supplierCode`, `supplierDescription` y `supplierQuantity` al guardar (solo en líneas con inventario salvo `supplierCode`, que va en todas).
  - `applyInvoiceValues`: la factura (y `suggestion` si existe) **ganan** sobre el último ingreso: `unitCost`, descuento, impuesto (`tax.code` → `purchaseTaxCode`, `tax.rate` → `purchaseTaxRate`) y cantidad. `suggestion.quantity: null` → cantidad vacía para que el usuario la escriba. Productos `SERIAL`: un equipo vacío por unidad (el XML no trae IMEI).
  - Validación: un mismo `supplierCode` no puede apuntar a destinos distintos dentro del ingreso.
  - Se manda `accessKey` en `data`. El backend responde 409 si ya fue importada; se muestra con `message()`.
  - Estado del SRI en el diálogo: `AUTHORIZED` (verde), `NOT_AUTHORIZED` (rojo) y `NOT_FOUND` (ámbar) son solo avisos; `available: false` muestra `sri.message` y permite seguir manual.
- **Movimientos, motivos:** vienen de `GET /stock-vouchers/new-data`; **no se quedan fijos en el front**. El modal de nuevo movimiento solo ofrece motivos `direction === 'OUT'`. Los motivos `IN` se usan desde el detalle del vale (retorno) y se filtran según el vale que se retorna (`orderLink`: `REQUIRED` = solo salidas con orden, `FORBIDDEN` = solo salidas sin orden). `isReturnable` solo aplica a OUT: si es `false`, no ofrecer "Retornar".
- **Movimientos, orden y empleado:** el Empleado se muestra al elegir el motivo; la Orden solo si `selectedReason().orderLink === 'REQUIRED'`. Al cambiar el motivo se limpia la orden. Se envía `employee.id` como `employeeId` y `order.id` (no `orderNumber`) como `orderId`. Una orden con `canIssue: false` **sí se puede seleccionar** (el autocomplete no deshabilita ítems) pero se muestra el aviso rojo y `orderBlocked()` bloquea el guardado. Nunca decir "no existe" para una orden devuelta con `#123`.
- **Movimientos, líneas y lotes:** el modal tiene una **tarjeta por producto**; dentro, cada lote es una selección (casilla). Cada lote elegido genera **una línea** del JSON (un lote no se repite). `available = 0` → lote deshabilitado; el máximo a sacar es `available`. Si el producto tiene un solo lote con disponibilidad, se marca solo (`loadLots`). Un producto ya agregado no se duplica (aviso). Producto `SERIAL`: se marcan equipos de `lot.units` y `quantity = unitIds.length`; por cantidad: input numérico con cantidad entera (se inicia en 1).
- **Movimientos, producto precargado:** al abrir desde la fila de productos, el constructor crea la línea con `addLineProduct(input.product)` y el buscador queda oculto detrás del botón "+ Agregar otro repuesto" (`showProductSearch`). Sin producto (desde `/movimientos`), el buscador se ve de entrada. El buscador de repuestos reutiliza `GET /receipts/products/search`.
- **Movimientos, fotos:** se piden **por producto** ("Agregar imágenes" despliega `app-image-upload`; se oculta con `[class.hidden]`, no con `@if`, para no perder las miniaturas) y se envían en la **primera línea (lote)** de ese producto; las demás líneas van con `[]`. Hasta 5 fotos de 5 MB. Un producto con fotos pero sin lote elegido no genera líneas: `validate()` debe exigir al menos un lote por producto para que no se pierdan en silencio. Quitar el producto descarta sus fotos.
- **Movimientos, retorno:** hereda empleado, orden y sucursal; no se envían `employeeId`, `orderId` ni `lotId`; sí `originVoucherId` y `originLineId` por línea. Botón "Retornar" visible solo si `direction = OUT`, `reason.isReturnable`, alguna línea con `pending > 0` y `order.statusId !== 8`. Precargar líneas con `pending > 0` y, en serializados, ofrecer solo `units` con `returned = false`. El retorno reutiliza `StockVoucherFormDialog` con `StockVoucherFormDialogData.originVoucher` (pendiente de agregar).
- **Movimientos, producto en el modal:** `StockVoucherProductRef` = `{ id, name, sku, trackingMode }`. `trackingMode` en `lots` no viene: sale del producto (la lista de productos o `ProductOption`).
- **Autocomplete:** el genérico es `T extends { id: string | number }` (las órdenes usan `id` numérico). Ya hace `debounceTime(300)` + `switchMap`: **no añadir otro debounce** en la `searchFn`. Al enfocar fuerza una búsqueda con término vacío (muestra los primeros resultados). No deshabilita ítems.
- **Gateway: DTOs con whitelist.** El `ValidationPipe` rechaza cualquier propiedad que no esté decorada (`property X should not exist`). Cada vez que un contrato agregue campos al request, hay que agregarlos también al DTO del gateway (`ReceiptLineGatewayDto`, `CreateReceiptGatewayDto`, `CreateStockVoucherGatewayDto`...). Ya pasó con `supplierCode`, `supplierDescription` y `supplierQuantity` (esta última admite hasta 4 decimales).
- **Tipos de proveedor:** `SupplierOption` es el mínimo del formulario (`id, code, businessName, tradeName, identificationType, identificationNumber`); `SupplierSearchItem` lo extiende con `status` y `label`. El `supplier` del preview es `SupplierSearchItem`. `Supplier.status` es booleano (no existe `active`).
- **Detalle de ingreso, nulabilidad:** `ReceiptDetailLine.product`, `lot` y `lotConfig` son nulables (líneas sin inventario). En plantillas usar alias (`@if (l.product; as p)`, `@if (l.affectsInventory && l.lotConfig; as cfg)`).
- **No** dejar `console.log` (los stubs actuales sin implementar deben reemplazarse).
- Si un componente usa `*ngTemplateOutlet`, importar `NgTemplateOutlet`. Si usa el pipe `number`, importar `DecimalPipe`. Si usa `date`, importar `DatePipe`.
- Los SVG llevan tamaño explícito (`h-5 w-5`).
- El JWT está en storage del navegador (riesgo XSS aceptado por ahora).

## 8. Cómo agregar cosas

### Nueva feature con ruta (ejemplo: `stock`)

```bash
ng g c features/stock/pages/stock-list
```

`features/stock/stock.routes.ts`:

```typescript
import { Routes } from '@angular/router';

export const STOCK_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/stock-list/stock-list').then(m => m.StockList),
  },
];
```

En `app.routes.ts`, dentro de `children` del layout:

```typescript
{
  path: 'stock',
  loadChildren: () => import('./features/stock/stock.routes').then(m => m.STOCK_ROUTES),
},
```

En `main-layout.ts`: agregar el icono a `ICONS` y la entrada a `menu`:

```typescript
{ label: 'Stock', path: '/stock', icon: ICONS.stock },
```

Los ingresos usan el icono `receipts` (bandeja con flecha hacia abajo, Heroicons `inbox-arrow-down`); **`movements` (flechas cruzadas) lo usa ahora el ítem "Movimientos"** (`/movimientos`).

### Servicio

```typescript
@Injectable({ providedIn: 'root' })
export class SuppliersService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/suppliers`;

  getNewData() { return this.http.get<SupplierNewDataResponse>(`${this.base}/new-data`); }
  create(body: CreateSupplierRequest) { return this.http.post<Supplier>(this.base, body); }
}
```

Endpoint fuera de la base del servicio (ej. SRI, empleados, órdenes, búsqueda de productos de ingresos): usar `environment.apiUrl` directo.

```typescript
previewAccessKey(accessKey: string) {
  return this.http.post<AccessKeyPreview>(`${environment.apiUrl}/sri/access-key/preview`, { accessKey });
}
```

### Modal que devuelve el recurso creado

```typescript
// quien abre el modal
this.dialog
  .open<Supplier>(SupplierFormDialog, { width: '40rem', maxWidth: '95vw', autoFocus: 'first-tabbable' })
  .closed.subscribe(supplier => {
    if (supplier) this.form.controls.supplier.setValue(supplier);
  });

// dentro del modal, al guardar
next: supplier => this.dialogRef.close(supplier),
```

### Modal que recibe datos opcionales

```typescript
// quien abre el modal
this.dialog.open<Supplier>(SupplierFormDialog, { width: '40rem', maxWidth: '95vw', data: { draft, formData } satisfies SupplierFormDialogData });

// dentro del modal
private readonly input = inject<SupplierFormDialogData | null>(DIALOG_DATA, { optional: true });
```

Ejemplo real: `ProductList.openMovement(p)` abre `StockVoucherFormDialog` con `data: { product: { id, name, sku, trackingMode } }`, `disableClose: true`, y al cerrar con un vale muestra el aviso y recarga el listado.

### Modal de detalle que avisa si hubo cambios

```typescript
this.dialog
  .open<boolean>(SupplierDetailDialog, { data: { id }, width: '44rem', maxWidth: '95vw', autoFocus: false })
  .closed.subscribe(changed => { if (changed) this.load(); });

// dentro del modal: private changed = false; close() { this.dialogRef.close(this.changed); }
```

### Listado con filtros, orden y paginación

```typescript
readonly query = signal<ListReceiptsQuery>({ page: 1, limit: 20, /* ... */ sortBy: 'issueDate', sortDir: 'DESC' });
private readonly reloadTick = signal(0);

toObservable(computed(() => ({ q: this.query(), t: this.reloadTick() })))
  .pipe(
    tap(() => this.loading.set(true)),
    switchMap(({ q }) => this.api.list(q, !this.filters()).pipe(catchError(err => { /* aviso */ return EMPTY; }))),
    takeUntilDestroyed(),
  )
  .subscribe(res => { /* guardar items, meta y, si viene, filters */ });

reload() { this.reloadTick.update(n => n + 1); }
```

### Buscador reutilizable (`app-autocomplete`)

Genérico (`T extends { id: string | number }`). Recibe la función de búsqueda y cómo mostrar cada resultado:

```html
<!-- selección única (queda en el input) -->
<app-autocomplete [searchFn]="searchSuppliers" [label]="supplierLabel" [sublabel]="supplierSub"
  placeholder="Buscar proveedor..." ariaLabel="Proveedor"
  createLabel="Crear nuevo proveedor"
  [value]="form.controls.supplier.value" (valueChange)="form.controls.supplier.setValue($event)"
  (createClicked)="createSupplier()" />

<!-- modo "agregar y limpiar": emite picked y vacía el input (para ir agregando líneas) -->
<app-autocomplete [searchFn]="searchProducts" [label]="productLabel" [clearOnSelect]="true"
  (picked)="addProduct($event)" (createClicked)="createProduct()" />
```

`searchFn` es `(term: string) => Observable<T[]>`. Ya trae `debounceTime(300)` y `switchMap` internos. `createLabel` muestra la opción "+ texto" al final y emite `createClicked`. Navegación con teclado (flechas, Enter, Escape). Nota: si el padre pone `value` en `null`, el input no se vacía solo; para reiniciarlo, recrear el componente (por ejemplo con `@for (k of [key()]; track k)`). Si el padre asigna un `value`, un `effect` lo muestra en el input. No admite término inicial precargado (ver pendientes). Para listas completas sin búsqueda en servidor (empleados), la `searchFn` filtra en el cliente sobre una lista cacheada con `shareReplay(1)`.

### Fila-tarjeta de un listado

```html
<article class="row-card">
  <div class="row-col sm:flex-1">
    <span class="col-label">Producto</span>
    <span class="col-valor font-semibold">{{ p.name }}</span>
  </div>
</article>
```

### Subida de archivos reutilizable

```html
<app-image-upload [(files)]="images" [max]="5" />

<!-- un solo archivo, imagen o PDF -->
<app-image-upload [(files)]="documentFiles" [multiple]="false"
  accept="image/jpeg,image/png,image/webp,application/pdf" [maxSizeMb]="10"
  label="Arrastra la factura o proforma aquí" />
```

`images` es un `signal<File[]>([])`. Inputs: `max`, `maxSizeMb`, `accept`, `multiple`, `camera`, `label`. Los PDF se muestran con un recuadro "PDF" en lugar de miniatura. Para valores que vienen de un `FormControl`: `[files]="c.images.value" (filesChange)="c.images.setValue($event)"`. Para productos ya creados, `product-images` gestiona agregar, poner como principal y eliminar.

### Campo de formulario con estilos del proyecto

```html
<label for="nombre" class="mb-1.5 block text-sm font-medium text-heading">Nombre</label>
<input id="nombre" formControlName="nombre" class="input-field" />
<button type="submit" class="btn-primary">Guardar</button>
```

### Línea de vale con lotes (patrón del modal de movimiento)

```typescript
const newPick = (lot: StockLot) => new FormGroup({
  lot: new FormControl<StockLot>(lot, { nonNullable: true }),
  quantity: new FormControl<number | null>(null),                // por cantidad
  unitIds: new FormControl<string[]>([], { nonNullable: true }), // serializados
});

const newVoucherLine = (product: LineProduct) => new FormGroup({
  product: new FormControl<LineProduct>(product, { nonNullable: true }),
  lots: new FormControl<StockLot[] | null>(null),   // null = cargando
  loadError: new FormControl<string | null>(null),
  picks: new FormArray<PickGroup>([]),
  images: new FormControl<File[]>([], { nonNullable: true }),
  photosOpen: new FormControl(false, { nonNullable: true }), // solo UI
});
```

Al asignar `lots`/`loadError` desde una respuesta HTTP, llamar a `markForCheck()` (zoneless). Armado del body y de las fotos en un solo recorrido:

```typescript
private buildPayload() {
  const lines: CreateStockVoucherLine[] = [];
  const lineImages: File[][] = [];
  for (const line of this.voucherLines.controls) {
    const serial = this.isSerialLine(line);
    line.controls.picks.controls.forEach((p, k) => {
      lines.push({
        lotId: p.controls.lot.value.lotId,
        quantity: this.pickQty(line, p),
        ...(serial ? { unitIds: p.controls.unitIds.value } : {}),
      });
      lineImages.push(k === 0 ? line.controls.images.value : []); // fotos en la primera línea del producto
    });
  }
  return { lines, lineImages };
}
// submit(): this.api.create({ clientRequestId, reasonId, employeeId, ...(orderId), ...(note), lines }, lineImages)
```

## 9. Pendientes y decisiones abiertas

- **Auditoría (backend):** registrar quién crea, edita y elimina. Recomendado: clase base con `createdAt/By`, `updatedAt/By`, `deletedAt/By` y una tabla `audit_logs` solo de inserción. Falta decidir ORM y si se guarda solo el id del usuario o también una copia del nombre.
- **Nombres de usuario:** el backend devuelve solo ids (`createdById`, `userId`...). Se muestra el id hasta que lo resuelva.
- **Movimientos (stock-vouchers), pasos:**
  - ✅ Paso 1: carcasa, rutas, menú, servicio con `new-data`, modal base y botón "Sacar stock" por fila en productos.
  - ✅ Paso 2: empleado (`/employees/basic`, filtrado en cliente) y orden (`/inventory-orders/search`).
  - ✅ Paso 3: líneas con producto precargado, lotes con unidades embebidas, cantidad / equipos marcados, "+ Agregar otro repuesto", lote único autoseleccionado.
  - ✅ Fotos por producto (`photos_<índice>`), botón "Agregar imágenes".
  - ⏳ **Paso 4:** `validate()` (formato «Línea N: …»), `submit()`, `clientRequestId`, `POST` multipart y habilitar el botón "Registrar movimiento" (hoy está deshabilitado). Debe validar: motivo, empleado, orden si `REQUIRED`, `orderBlocked()`, al menos un producto con al menos un lote, cantidad entera de 1 a `lot.available`, equipos marcados > 0 en serializados, nota ≤ 500, 25 MB totales de fotos (opcional). `note` aún no tiene campo en el modal.
  - ⏳ Paso 5: listado con filtros (`direction`, motivo, empleado, orden, fechas, búsqueda) y paginación; el botón de `StockVoucherList.openNew()` debe recargar.
  - ⏳ Paso 6: detalle del vale y retorno (reutiliza el modal; agregar `originVoucher` a `StockVoucherFormDialogData`).
  - ⏳ Paso 7: resumen por orden (`GET /stock-vouchers/orders/:orderId`).
  - `StockVoucherCreated.orderNumber` está tipado como `string | number | null`: ajustar cuando se vea la respuesta real.
  - Verificar el prefijo del gateway para `/employees/basic` y `/inventory-orders/search`.
  - Pendiente: confirmar si el backend acepta PDF en las fotos del vale (hoy solo `image/*`).
  - Limpiar el comentario de `searchOrders` en el modal que aún menciona `timer(300)` (ya no se usa) y los imports no usados de `switchMap`/`timer`.
  - Si el producto de la lista cambia de `trackingMode` en la ficha, manda la ficha: hoy el modal usa el valor que trae la fila.
- **Importación por clave de acceso:**
  - Decidir con el negocio si una factura `NOT_AUTHORIZED` o `NOT_FOUND` debe **bloquear** el Aceptar (hoy solo avisa).
  - Decidir si también se bloquea un proveedor inactivo (`status: false`; hoy solo avisa).
  - Avisar (no bloqueante) cuando `key.issuerRuc` ≠ `supplier.identificationNumber` al aplicar la clave.
  - `app-autocomplete` no acepta término inicial: en líneas `UNMAPPED` la descripción de la factura se muestra encima pero no se precarga en el buscador. Pendiente un input `[initialTerm]`.
  - Reemplazar el `confirm()` del navegador (reemplazo de líneas) por un diálogo propio.
  - Mover `reasonLabel` (duplicado en `ReceiptFormDialog` y `AccessKeyDialog`) a un archivo compartido.
  - Facturas con muchos equipos serializados generan una fila de IMEI por unidad (sin límite).
  - Cuadre de totales: el IVA se calcula por línea (`subtotal × tasa / 100`); el SRI puede redondear distinto y dar diferencias de centavos.
  - Botón "Ver XML": cuando el backend exponga el `getPresignedUrl` del XML (`hasSourceXml`). El comparador de auditoría línea a línea es un paso posterior de backend.
  - Si el diálogo de consulta se cierra en pleno request, la suscripción sigue viva; considerar `takeUntilDestroyed()`.
  - Límites de longitud de `supplierCode` (100), `supplierDescription` (300) y `supplierQuantity` en el gateway: confirmar contra las columnas del microservicio.
  - Un `preview` repetido con la misma clave vuelve a consultar al SRI (el backend sugirió cachear unos minutos si molesta).
- **Detalle de ingreso:** si se ajusta el listado, mostrar la insignia de origen (`Clave de acceso`) y de líneas sin inventario.
- **Ingresos, anular pago:** existe `PATCH /receipts/:id/payments/:paymentId/void` (`{ reason }`, 3 a 500 caracteres), pero **no está implementado** en el front por decisión del equipo.
- **Ingresos, métodos de pago:** `PaymentStatusDialog` y `ReceiptDetailDialog` usan una lista fija (`CASH`, `TRANSFER`, `CHECK`, `CARD`, `OTHER`). El contrato dice que las etiquetas vienen en `paymentMethods` de `GET /receipts/:id/payments`, endpoint aún no documentado. (`GET /receipts/new-data` ya devuelve `paymentMethods` para el formulario de alta.)
- **Ingresos, verificar ingreso** (`status: VERIFIED`) y **anular ingreso**: no hay acción en el front todavía.
- **Ingresos, filtro por `productId`:** soportado por el backend pero no incluido en el listado (el buscador general ya encuentra por producto).
- **Ingresos, código de impuesto de compra (`purchaseTaxCode`):** no tiene campo visible en el formulario; se carga desde el último ingreso del producto o desde la factura (`tax.code`) y se envía. Falta conocer su catálogo para ofrecer un selector.
- **Ingresos, estados de equipo y acciones del historial:** solo se conocen `AVAILABLE`/`SOLD` y `CREATED`/`UPDATED`. `RESERVED`, `VERIFIED` y `VOIDED` son suposiciones; los valores desconocidos se muestran crudos. Falta la lista real y las etiquetas de `FIELD_LABELS`.
- **Ingresos, límites de archivos:** se asumió 5 fotos por producto, 5 MB por imagen y 10 MB para documento y comprobante. Confirmar con el backend. (Para vales, el contrato sí define 5 MB por foto y 25 MB totales.)
- **Tipo `AccessKeySupplier`:** obsoleto desde que `supplier` usa `SupplierSearchItem`; borrarlo de `receipt.types.ts` si sigue.
- **Regla de equipo completo (`DEVICE`)** en el formulario de producto: requiere que `types` de `new-data` incluya `kind`.
- **Backend:** convertir a booleano `isSellable`, `isRepairPart` e `isCustomizable` en `buildProductDto` (llegan como texto en multipart).
- **Plantillas con `bg-gradient-to-br`:** migrar a `bg-linear-to-br` (el modal de ingreso aún lo usa).
- Actualizar este archivo al agregar features, endpoints o convenciones nuevas.

## 10. Datos que NO están en el contexto

- Script o configuración de **lint** (ESLint) y configuración de Prettier.
- Versión instalada de `@angular/cdk` y contenido exacto de `app.config.ts`, `app.ts` y los `tsconfig*.json`.
- Si el proyecto está realmente **zoneless** (se asume por el comportamiento observado con `FormControl` y por ser el valor por defecto de Angular 22): confirmar en `app.config.ts` (`provideZonelessChangeDetection` / `provideZoneChangeDetection`).
- Contenido real de `products.routes.ts` / `suppliers.routes.ts`.
- El `.ts` de `model-picker` y si `product-images` ya está integrado en el detalle de producto.
- **Rutas reales del gateway** de ingresos: se usa `/receipts` (con `/receipts/products/search`, `/receipts/suppliers/search` y `/receipts/new-data`) y `/sri/access-key/preview`. Confirmar cualquier cambio de prefijo. Lo mismo para `/stock-vouchers`, `/employees/basic` y `/inventory-orders/search`.
- Reglas del backend para imágenes de producto: nombre del campo (`images`), máximo por producto (se asumió 5), formatos, tamaño y qué ocurre al eliminar la principal.
- Valores por defecto de los usos (`isSellable`, `isRepairPart`, `isCustomizable`): el formulario los envía en `false`.
- Ruta real de `theme-toggle`: se importa desde `shared/components/theme-toggle/theme-toggle/theme-toggle` en el layout; unificar con el login.
- `fileReplacements` por entorno: `angular.json` no los define, hay un solo `environment.ts`.
- Si el interceptor de auth ya excluye los `FormData` del `Content-Type` JSON (necesario para `POST /receipts`, `POST /receipts/:id/payments` y `POST /stock-vouchers`).
- Código de `entity` de `Country` y catálogo de `documentTypes.code` (el mapeo de `FACTURA` se hace tolerante por `code` o `name`; confirmar el valor real).
- Forma exacta de la respuesta 201 de `POST /stock-vouchers` en producción (`orderNumber` y otros campos tipados por el contrato, no por una respuesta real).#   i n v e n t o r y - c o r e - f r o n t e n d  
 