# AGENTS.md — inventario-ms

## 0. Cómo mantener este archivo (leer primero)

Este archivo es la fuente de verdad del proyecto. Si en un hilo se pide actualizarlo o corregirlo, aplica estas reglas:

1. **Solo se corrige lo verificado.** Se puede cambiar una línea únicamente si en este hilo se vio:
   - el código real (archivo pegado o leído), o
   - un contrato del backend entregado por el usuario.
   Lo que no se vio, no se toca ni se da por correcto o incorrecto.
2. **Lo no verificado se conserva tal cual.** No borrar, reescribir ni "mejorar" líneas sobre archivos que no se vieron. Si hay duda, dejar el texto original.
3. **No inventar.** Prohibido suponer nombres de archivos, métodos, endpoints, valores de enums, límites o versiones. Si hace falta un dato y no está, se pide el archivo o se anota en la sección 10 o en los pendientes de la sección 9, marcado como "(asumido)" o "(sin confirmar)".
4. **El código manda sobre el texto.** Si el código visto contradice este archivo, se corrige el archivo y se avisa de la diferencia. Si lo que contradice es una decisión del usuario, se pregunta antes.
5. **Pendientes:** se quita un pendiente solo si el código visto demuestra que ya está resuelto. Los pendientes nuevos se agregan a la sección 9, sin duplicar.
6. **Sección 10:** al ver código que antes faltaba, se quita de la lista. Al tocar algo que no se pudo ver, se agrega.
7. **Formato de entrega:**
   - Si el cambio es pequeño, entregar solo los bloques modificados con su sección, no el archivo completo.
   - Entregar el archivo completo solo si el usuario lo pide, y dividido en partes cortas.
   - Cerrar con una lista corta: "Verificado con: <archivos o contratos>" y "No verificado, sin cambios: <temas>".
8. **Al terminar una tarea de código** (nueva pantalla, endpoint, convención o corrección), proponer qué líneas de este archivo habría que actualizar, aplicando las reglas anteriores.

## 1. Descripción

Frontend de un sistema de inventario multi-empresa y multi-sucursal. Es una SPA Angular (standalone) que consume un backend NestJS vía gateway (`/auth`, `/inventory-core`, `/suppliers`, `/receipts`, `/sri`, `/stock-vouchers`, `/employees`, `/inventory-orders`).

Estado actual:

- Login con JWT, layout con sidebar colapsable (escritorio) y panel móvil, tema claro/oscuro, dashboard con datos de ejemplo.
- **Productos:** listado con filtros, creación con imágenes y detalle.
- **Proveedores:** listado (búsqueda, filtros, orden, paginación), alta, detalle con edición en línea y activar/desactivar.
- **Ingresos:** listado con filtros, alta (proveedor y productos con buscador, seriales/IMEI, documento y fotos adjuntas, **líneas sin inventario**, **importación por clave de acceso del SRI**), detalle (resumen, productos, pagos, historial) y registro de pagos con comprobante.
- **Movimientos (vales de stock):**
  - Listado con filtros (tipo, motivo, empleado, rango de fechas, búsqueda), orden y paginación. Cada fila muestra estado de devolución, cantidades devueltas/pendientes, orden con estado y cliente, y fotos.
  - Alta de **salidas** (lotes, seriales, fotos por producto).
  - Alta de **retornos** (`StockVoucherReturnDialog`): se abre desde el botón "Retornar" de la lista o del detalle, solo cuando `canReturn` es `true`.
  - **Detalle en modal** (cabecera, líneas, equipos con IMEI, fotos, navegación salida ↔ retorno, botón "Registrar retorno").
- Pendiente de movimientos: filtro por orden y nombre del producto en el detalle (ver sección 9).
- Stock (existencias por producto/lote) aún no existe como pantalla.

## 2. Stack

| Área | Detalle |
|---|---|
| Framework | Angular `^22.0.0` (standalone, sin NgModules; zoneless: ver reglas) |
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
    ├── core/              # models/, services/ (auth, theme), guards/, interceptors/ (auth)
    ├── layout/main-layout/        # sidebar + topbar + <router-outlet />
    ├── shared/components/
    │   ├── theme-toggle/
    │   ├── autocomplete/          # buscador genérico (searchFn), con "crear nuevo" y modo clearOnSelect
    │   ├── date-range-picker/     # selector de rango; ControlValueAccessor con { dateFrom, dateTo } (se usa con [formControl])
    │   ├── image-upload/          # arrastrar y soltar + selector + cámara; acepta imágenes y PDF
    │   ├── camera-dialog/         # modal de cámara; devuelve un File JPEG
    │   └── image-lightbox-dialog/ # visor con zoom, pan, pellizco, doble toque, swipe y descarga
    └── features/
        ├── auth/login/
        ├── dashboard/
        ├── products/
        │   ├── products.routes.ts         # router propio de la feature
        │   ├── pages/product-list/
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
        │   ├── components/                # receipt-form-dialog, receipt-detail-dialog, payment-status-dialog (exporta PaymentStatusDialog y PaymentDialogData), access-key-dialog
        │   ├── services/receipts.service.ts
        │   └── types/receipt.types.ts
        └── stock-vouchers/
            ├── stock-vouchers.routes.ts   # STOCK_VOUCHERS_ROUTES
            ├── pages/stock-voucher-list/
            ├── components/
            │   ├── stock-voucher-form-dialog/     # alta de salida (lotes, seriales, fotos)
            │   ├── stock-voucher-return-dialog/   # alta de retorno (recibe el VoucherDetail de la salida)
            │   └── stock-voucher-detail-dialog/   # detalle; botón "Registrar retorno"
            ├── services/stock-vouchers.service.ts
            └── types/stock-voucher.types.ts
```

Cada feature es el equivalente standalone de un "módulo": su propia carpeta con `pages/`, `components/`, `services/`, `types/` y un `<feature>.routes.ts` que se carga con `loadChildren`.

Notas de dependencias entre tipos:

- `receipts` importa `PaginationMeta`/`PaginatedResponse`, `SupplierDraft` y `SupplierNewDataResponse` desde `suppliers`.
- `stock-vouchers` importa `PaginationMeta` desde `suppliers` y `ProductOption`/`SearchProductsResponse` desde `receipts` (reutiliza `GET /receipts/products/search`).
- Ya son **tres** features que usan paginación: mover `PaginationMeta` y `PaginatedResponse` a `shared/types`.
- `products/types/product.types.ts` importa `ProductOption` desde `receipt.types.ts`. **`receipt.types.ts` no debe importar de `product.types.ts`** (crearía un ciclo).
- `StockVoucherList` y `StockVoucherDetailDialog` importan `StockVoucherReturnDialog` (los dos abren el retorno). El diálogo de retorno no importa de ninguno de los dos.
## 4. Rendering, routing y datos

- **Rendering:** CSR. Proyecto creado con `--ssr=false`; `angular.json` no tiene SSR ni hidratación.
- **Detección de cambios:** zoneless. Los `FormControl` y `FormArray` **no** notifican a la vista: si un valor cambia en un callback asíncrono (por ejemplo, al cargar lotes), llamar a `ChangeDetectorRef.markForCheck()` o usar signals.
- **Routing:** todo con `loadComponent` / `loadChildren` (lazy). `/login` es pública. El layout (`path: ''`) lleva `canActivate: [authGuard]`; **todas las vistas del admin van en sus `children`** (`dashboard`, `productos`, `proveedores`, `ingresos`, `movimientos`). `**` redirige a `login`.
- **HTTP:** `provideHttpClient(withInterceptors([authInterceptor]))`. El interceptor solo añade `Authorization: Bearer <token>` (no toca `Content-Type`, así que los `FormData` funcionan) y llama a `logout()` ante un 401 (salvo si la URL contiene `/auth/login`). La empresa y el usuario salen del token: no se envían en las peticiones.
- **Sesión:** `AuthService` guarda el token en un signal; va a `localStorage` con "remember" y a `sessionStorage` si no (clave `token`). `user()` es el payload decodificado del JWT.
- **Otras claves de storage:** `inventario-theme`, `inventario-sidebar-collapsed`.
- **Estado de pantalla:** signals. En listados, un signal `query` es la fuente de verdad: `toObservable(...).pipe(switchMap(...))` dispara cada carga y cancela la anterior. Para forzar recarga con los mismos filtros se usa un contador (`reloadTick`) combinado con `query`. Lo mismo aplica a los detalles que necesitan recargar (`StockVoucherDetailDialog` combina `currentId` y `reloadTick`).

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
| Buscar productos | `GET /receipts/products/search?search=&limit=` → `{ items }` (cada item trae `defaults`, `lastReceipt` y, si aplica, `supplierCodes`) |
| Buscar proveedores | `GET /receipts/suppliers/search?q=&limit=` → arreglo de `SupplierSearchItem` |
| Crear ingreso | `POST /receipts` (**multipart**: `data` con JSON, `document` opcional, `photos_<índice>` y `proof_<índice>` opcionales) |
| Listar | `GET /receipts` (`page`, `limit`, `search`, `dateFrom`, `dateTo`, `status`, `paymentStatus`, `documentTypeId`, `productId`, `sortBy`, `sortDir`, `includeFilters`) → `{ items, meta, filters? }` |
| Detalle | `GET /receipts/:id` |
| Registrar pago | `POST /receipts/:id/payments` (**multipart**: `data` con JSON, `proof` opcional) |

**SRI** (no cuelga de `/receipts`: se usa `environment.apiUrl` directo)

| Uso | Endpoint |
|---|---|
| Consultar factura por clave de acceso | `POST /sri/access-key/preview` con `{ accessKey }` (49 dígitos; acepta espacios o guiones) |

**Movimientos / vales de stock** (base `StockVouchersService.base` = `${apiUrl}/stock-vouchers`; **verificar el prefijo del gateway**, puede llevar el de `RouterModule`)

| Uso | Endpoint |
|---|---|
| Datos del formulario | `GET /stock-vouchers/new-data` → `{ reasons }` (cada motivo: `id, code, name, direction, orderLink, isReturnable`). Salidas usan los de `direction: 'OUT'`; retornos, los de `'IN'` |
| Crear vale (salida **o** retorno) | `POST /stock-vouchers` (**multipart**: `data` con JSON y `photos_<índice de línea>`) → `StockVoucherCreated` (incluye `replayed`) |
| Listar | `GET /stock-vouchers` (`page`, `limit`, `sortBy` `createdAt\|code`, `sortDir`, `direction` `OUT\|IN`, `reasonId`, `employeeId`, `orderId`, `from`, `to`, `search`, `includeFilters`) → `{ items, meta, filters? }` |
| Detalle | `GET /stock-vouchers/:id` → `VoucherDetail` |
| Lotes de un producto | `GET /stock-vouchers/products/:productId/lots` → `StockLot[]` (con `units` si es SERIAL) |
| Costo neto de una orden | `GET /stock-vouchers/orders/:orderId` (documentado, **no usado aún**) |
| Empleados | `GET /employees/basic` (fuera de la base) → `Employee[]` (`id, username, name`) |
| Buscar órdenes | `GET /inventory-orders/search?search=` (fuera de la base; vacío devuelve las 20 más recientes) → `OrderSearchItem[]` |
| Buscar productos | `GET /receipts/products/search` (reutilizado) |

#### Contrato del listado de vales (`GET /stock-vouchers`)

- `filters` (con `reasons`) solo viene con `includeFilters=true`.
- `search`: solo dígitos (hasta 9) coincide con el **código del vale o el número de orden** (puede traer ambos); cualquier otro texto busca por nombre de empleado (ILIKE, sensible a tildes). `#123` **no** funciona aquí: se envía `123`.
- `orderId` es el id interno de la orden (el de `inventory-orders/search`), no el número visible.
- `from`/`to` `AAAA-MM-DD`, rango inclusivo en hora de America/Guayaquil.
- Item (`VoucherListItem`):
  - `id`, `code`, `direction`, `createdAt` (ISO UTC).
  - `reason: { id, code, name, isReturnable }`.
  - `employee: { id, name }` y `createdBy: { id, name }` (`name` puede ser `null`).
  - `orderId`, `orderNumber`, `orderStatus: { id, name }`, `customerName`: `null` sin orden (o si la réplica no sincronizó).
  - `originVoucherId` y `originVoucher: { id, code }`: solo en retornos.
  - `lineCount` (líneas), `totalQuantity` (**unidades**, suma de `quantity`), `returnCount`, `photoCount`.
  - `returnedQuantity`, `pendingQuantity`, `returnStatus`: solo en salidas; `null` en retornos.
  - **`canReturn`**: única condición que el front usa para mostrar el botón "Retornar" en la fila. Es `false` en retornos.
  - `returnBlock`: motivo por el que no se puede retornar (`null` si `canReturn`). Solo se conoce `IS_RETURN`; **falta la lista completa**.
- `returnStatus`: se asume `NONE | PARTIAL | FULL` (solo se confirmó `PARTIAL`). Un valor desconocido se muestra crudo.
- La lista puede ir unos instantes por detrás del estado real de la orden: al pulsar "Retornar" el front revalida con `GET /stock-vouchers/:id` y el servidor valida igual al crear.
- Errores 400 llegan en español desde el DTO.

#### Contrato del detalle de vale (`GET /stock-vouchers/:id`)

- `reason` y los `name` de `employee`/`createdBy` pueden ser `null`; `order` es `null` sin orden y sus `statusId`/`statusName`/`customerName` pueden ser `null` si la réplica no sincronizó.
- `originVoucher` solo en retornos; `returns[]` solo en salidas (más antiguo → más nuevo).
- Cada línea trae `productSku` (**no** el nombre), `lotCode`, `unitCost` y `salePrice` (strings, snapshot del lote), `units` (vacío si es por cantidad) y `attachments` (fotos por línea con URL firmada de 30 min).
- `returned`/`pending` solo existen en salidas. `units[].returned` solo sirve en salidas.
- El detalle **aún no trae `canReturn`**: `StockVoucherDetailDialog` lo calcula en el front (`direction === 'OUT'`, `reason.isReturnable`, alguna línea con `pending > 0` y `order.statusId !== 8`). Pendiente pedir la bandera al backend para no duplicar la regla.
- Errores: 400 si `:id` no es UUID (mensaje en inglés de `ParseUUIDPipe`), 404 "El vale no existe" (también de otra empresa).

#### Contrato de `POST /stock-vouchers` (campo `data`)

Mismo endpoint y mismo DTO (`CreateStockVoucherGatewayDto`) para salida y retorno. El motivo (`reasonId`) define cuál es. Comunes: `clientRequestId` (UUID v4), `reasonId`, `note` (≤ 500), `lines[]` (1 a 100).

- **Salida:** `employeeId`, `orderId` (solo si el motivo tiene `orderLink = REQUIRED`) y por línea `lotId`, `quantity` (entero 1–100000) y `unitIds` solo si es SERIAL (`length = quantity`; máx. 1000).
- **Retorno:** `originVoucherId` y por línea `originLineId`, `quantity` y `unitIds` (los `unitId` con `returned: false`, solo en seriales). **No** se envían `lotId`, `employeeId` ni `orderId`: el backend los hereda del vale original y devuelve al lote original. El motivo debe ser de `direction: 'IN'`.
- `quantity` de un retorno no puede superar `pending` de la línea de origen (el front lo valida; el servidor también).
- **Fotos** (campo `photos_<índice base 0>`, en el orden de `lines`):
  - Salida: las fotos de un producto van en la **primera** línea (lote) de ese producto; las demás líneas llevan `[]`.
  - Retorno: cada línea seleccionada lleva sus propias fotos.
  - Límites que aplica el front: 5 por producto/línea y 5 MB por imagen. **Asumidos; confirmar con el backend.**
- Respuesta 201 `StockVoucherCreated`; `replayed: true` se trata como éxito.
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

### Notas finales de la sección 4

- Si el módulo de ingresos cuelga de `inventory-core`, las rutas pasan a `/inventory-core/receipts...`: se cambia en una sola constante (`base`) de `ReceiptsService`. Lo mismo vale para `StockVouchersService.base`.
- Endpoints eliminados por el backend (no usar): `PATCH /receipts/:id/payment-status` y `GET /receipts/:id/payment-history`. El estado de pago lo calcula el sistema a partir de los pagos.
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

- **Archivos sin sufijo `.component`:** `login.ts`, `login.html`, `login.css`. La clase tampoco: `Login`, `ProductList`, `SupplierFormDialog`, `ReceiptDetailDialog`, `AccessKeyDialog`, `StockVoucherList`, `StockVoucherFormDialog`, `StockVoucherReturnDialog`, `StockVoucherDetailDialog`.
- Cada componente: 3 archivos separados (`.ts`, `.html`, `.css`) con `templateUrl` y `styleUrl`. Prefijo de selector `app-`. (`AccessKeyDialog` aún no tiene `styleUrl`; agregarlo si se quiere uniformar.)
- **DI:** `inject()` como campo de clase, no constructor. Datos de entrada de un diálogo: `inject<T | null>(DIALOG_DATA, { optional: true })`; si son obligatorios (detalles, retorno), `inject<T>(DIALOG_DATA)`.
- **Estado:** `signal`, `computed`, `effect`, `input()`, `output()`, `model()`. Campos `readonly` cuando no se reasignan.
- **Zoneless:** los `FormControl`/`FormArray` no notifican a la vista. Si se actualizan desde un callback asíncrono, llamar a `markForCheck()` (ejemplo: `loadLots` en `StockVoucherFormDialog`) o guardar el dato en un signal.
- **Plantillas:** control flow nuevo (`@if`, `@for` con `track`, `@else`, `@empty`, `@switch`, `@let`). No `*ngIf` ni `*ngFor`. **No usar funciones flecha en plantillas**: mover la lógica a un método del `.ts`. Evitar lógica inline compleja (etiquetas y clases por estado van en métodos con un `Record`, como `directionLabel` o `returnStatusClass`).
- **Formularios:** reactivos con `nonNullable`. Textos obligatorios con `Validators.pattern(/\S/)` además de `required`. En diálogos con muchos campos (ingreso, vale, retorno) se valida a mano en un método `validate()` que devuelve el mensaje de error y se muestra en un aviso.
- **Modales:** `Dialog` de `@angular/cdk/dialog`. El modal se cierra con `dialogRef.close(resultado)` y quien lo abre lee `ref.closed`. Los modales de creación devuelven el recurso creado; los de detalle devuelven `true` si hubo cambios para que el listado se recargue. Formularios largos (ingreso, pago, vale de salida, retorno) usan `disableClose: true`.
- **Listas flotantes:** el `app-autocomplete` usa una lista absoluta simple (`ul` con `mousedown` + `preventDefault` para no perder el foco). Si se necesita posicionamiento más robusto, usar `CdkConnectedOverlay`.
- **Estilos:** utilidades Tailwind v4 y los tokens/clases de `styles.css`:
  - Tokens: `bg-bg`, `bg-surface`, `bg-surface-hover`, `border-border`, `text-text`, `text-text-muted`, `text-text-subtle`, `bg-primary`, `bg-primary-soft`.
  - Clases: `surface-card`, `input-field`, `btn-primary`, `nav-item`, `nav-item-active`, `text-heading`, `text-body`.
  - Listados en filas-tarjeta: `row-card`, `row-col`, `col-label`, `col-valor`. (Los listados de ingresos y movimientos usan `<article>` con utilidades directas.)
  - Tema oscuro: clase `.dark` en `<html>`, gestionada por `ThemeService`.
  - Avisos: ámbar (`border-amber-300/60 bg-amber-500/10 text-amber-700 dark:text-amber-300`) para advertencias, rojo para errores, esmeralda para éxito. Son colores semánticos, no base.
  - `shadow-xs` se usa en varias vistas (por ejemplo, la paginación de movimientos); si no existe en el Tailwind del proyecto, cambiar a `shadow-sm`.
- **Patrón de listado (proveedores, ingresos, movimientos):** encabezado con total + botón "Nuevo", panel de búsqueda/filtros/orden (selects compactos + `app-date-range-picker` para fechas), tarjetas, paginación con selector de filas, botón "Ver detalle". Búsqueda con debounce de 300 ms. Ingresos usa dos vistas (`md:hidden` / `hidden md:block`); movimientos usa una sola fila-tarjeta con `flex-wrap`.
- **Acción por fila que necesita cargar datos antes de abrir un modal** (ejemplo: "Retornar" en movimientos): un signal `returningId` guarda el id en curso. Bloquea el doble clic (`if (this.returningId()) return`), deshabilita los demás botones de la misma acción y muestra el spinner solo en la fila pulsada. Se limpia en `next` y en `error`. Tras cargar, se **revalida** con el detalle (la lista puede ir por detrás) antes de abrir el modal.
- **Rango de fechas:** `dateRangeControl = new FormControl<any>(null)` enlazado a `<app-date-range-picker [formControl]="dateRangeControl">`. Su `valueChanges` entrega `{ dateFrom, dateTo }` (o `null`) y se traduce al `query`. Al limpiar filtros: `setValue(null, { emitEvent: false })` y vaciar las fechas del `query`.
- **Patrón de detalle con edición en línea (productos, proveedores):** cabecera con degradado, secciones etiqueta | valor, lápiz **siempre visible**, edición de un campo a la vez con doble confirmación (Guardar → ¿Confirmar? → Sí) y envío solo del campo que cambió.
- **Patrón de detalle de solo lectura (ingresos, movimientos):** ingresos usa pestañas `Resumen`, `Productos`, `Pagos`, `Historial` (lista de pagos compacta con miniatura de 40 px que abre el lightbox; el bloque de clave de acceso va en "Documento"). El detalle de movimientos es de una sola página: resumen, líneas con equipos y fotos (miniaturas de 64 px que abren el lightbox). Su pie lleva "Registrar retorno" (solo si `canReturn()`) y "Cerrar"; un aviso `notice` temporal (5 s) confirma el retorno.
- **Navegación interna en un detalle:** `StockVoucherDetailDialog` guarda `currentId` en un signal y recarga con `toObservable(computed(() => ({ id: currentId(), t: reloadTick() })))` + `switchMap`. Así sirve tanto para saltar entre salida y retornos como para recargar el mismo vale (`reload()` incrementa `reloadTick`).
- **Mensajes de error del backend:** `message` puede ser un arreglo; se unen con `', '` y se muestran en un aviso dentro de la pantalla (no hay sistema de toasts). Los avisos de éxito son temporales (`flash`, 3 a 5 s).
- Los tests están desactivados al generar (`skipTests: true`).
## 7. Reglas / NO hacer

- **No** borrar `.postcssrc.json`:
  ```json
  { "plugins": { "@tailwindcss/postcss": {} } }
  ```
  Sin él, Tailwind no compila (iconos SVG gigantes, vistas sin estilo). Reinicia `ng serve` si lo cambias.
- **El CSS propio va dentro de `@layer components`** (o `base`). El CSS sin capa le gana a las utilidades de Tailwind y rompe overrides.
- **No** usar sintaxis de Tailwind v3: `bg-gradient-to-*` es `bg-linear-to-*`. No hay `tailwind.config.js`. Para forzar una utilidad: sufijo `!`. (Hay plantillas existentes que aún usan `bg-gradient-to-br`; migrarlas.)
- **No** hardcodear colores base (`bg-white`, `text-gray-700`): usar tokens para que funcione el modo oscuro. (Excepción: el visor de imágenes es siempre oscuro a propósito.)
- **No** registrar rutas del admin fuera de los `children` del layout.
- **No** `import` estático de páginas en rutas: siempre lazy.
- **No** enviar filtros vacíos al backend: se omiten del `HttpParams` (los servicios de listado recorren `Object.entries(query)`, recortan strings y omiten `''`, `null` y `undefined`). Cualquier cambio de filtro o búsqueda vuelve a `page=1`.
- **No** guardar `imageUrl`/`proofUrl`/`url` de archivos: son URLs firmadas que caducan (30 min en fotos de vales); usar siempre la de la última respuesta (recargar el detalle las renueva). Antes de usar la URL de una foto de vale, verificar que empiece por `http` (si la firma falla, el backend puede devolver la key cruda de S3): si no, mostrar un recuadro "Sin vista".
- **Visor de imágenes (`ImageLightboxDialog`):** recibe `LightboxData = { images: LightboxImage[]; startIndex: number }` con `LightboxImage = { url: string; fileName: string }`. **`images` NO es `string[]`**: pasar strings deja la vista en `undefined`. Al abrirlo desde una lista filtrada, calcular `startIndex` buscando la foto pulsada por `id` dentro del arreglo ya filtrado. Usar `maxWidth: '95vw'` y `autoFocus: false`. La descarga hace `fetch(url)` a blob; si el bucket no tiene CORS, cae a abrir la imagen en otra pestaña. Atajos: ← →, `+`, `-`, `0` (Escape lo maneja CDK).
- **Multipart:** los campos de texto/JSON se anexan **antes** que los archivos. No fijar `Content-Type` a mano (el navegador agrega el boundary).
  - Producto: booleanos como `"true"`/`"false"`; `modelIds` como JSON.
  - Ingreso: JSON en `data`; archivos con los nombres **`document`**, **`photos_<índice de línea>`** y **`proof_<índice de pago>`**, donde el índice es **base 0** y sigue el orden de `lines` / `payments` en el JSON. Las líneas sin inventario mandan `[]` de fotos (no rompe el índice).
  - Pago: JSON en `data`; comprobante en **`proof`** (un solo archivo, imagen o PDF).
  - Vale de stock (salida y retorno): JSON en `data`; fotos en **`photos_<índice de línea>`** (base 0, mismo orden que `lines`; nombres en `STOCK_VOUCHER_FIELDS`). Las `lines` y las fotos se arman **en un solo recorrido** para que los índices siempre coincidan (`buildPayload()` en la salida; el bucle de `submit()` en el retorno). En la salida, las fotos de un producto van en su primera línea (lote) y las demás llevan `[]`; en el retorno, cada línea seleccionada lleva las suyas.
- **Idempotencia (`clientRequestId`):** en ingresos, pagos y vales (salida y retorno) se genera con `crypto.randomUUID()` **una vez al abrir el diálogo** y se reutiliza en todo reintento. Solo se genera uno nuevo al abrir otro diálogo. Deshabilitar el botón mientras la petición está en curso (`saving()`). En pagos y vales, `replayed: true` se trata como éxito.
- **Montos de ingresos, pagos y vales:** llegan como `string` (2 decimales en ingresos/pagos; `unitCost` de vales con 4). **Solo se muestran; no se hacen cálculos con ellos.** Las cantidades de vales (`totalQuantity`, `returnedQuantity`, `pendingQuantity`, `quantity`) son enteros y también se muestran tal cual; el único cálculo del front es el total a sacar o devolver mientras se llena el formulario. Las únicas cuentas con montos son los totales en vivo del formulario de alta de ingresos (estimado visual) y la comparación "Según factura" contra `documentTotals.total` (tolerancia ±0.01; solo informativa).
- **Fechas `AAAA-MM-DD`** (`issueDate`, `paidAt`, `from`/`to` de vales): formatear cortando el string; **no** pasar por `Date`/`DatePipe` (evita desfases de zona horaria). `createdAt`, `authorizationDate` y similares (ISO con hora) sí usan `DatePipe`.
- **Hora de vales:** `createdAt` llega en UTC; mostrar con `DatePipe` y zona fija de Ecuador: `{{ v.createdAt | date:'dd/MM/yyyy HH:mm':'-0500' }}` (sin horario de verano). En el formulario de salida, `lot.createdAt` se muestra solo como `dd/MM/yyyy` sin zona (aceptable: es informativo).
- **Listado de ingresos:** pedir `includeFilters=true` solo hasta recibir `filters` una vez; no enviarlo después. **No existe filtro `supplierId`** (el backend responde 400): el proveedor se busca escribiendo su nombre o RUC en `search`. Ajustar el rango de fechas para que `dateFrom <= dateTo`. Los tipos de documento con `active: false` van al final con la marca "(inactivo)".
- **Listado de movimientos:**
  - `includeFilters=true` solo hasta recibir `filters`; el select de motivos se llena con `filters.reasons` y se acota por la dirección elegida. Al cambiar la dirección, si el motivo elegido ya no corresponde, se descarta.
  - Quitar el `#` inicial del `search` antes de enviarlo (`#123` no funciona en este endpoint). Placeholder: "Código, nº de orden o empleado".
  - `employee.name` null → "Empleado no disponible"; sin orden → "Sin orden"; retornos se distinguen por `direction: 'IN'` (insignia "Retorno") y muestran "Retorno de la salida #código" con `originVoucher`.
  - Insignia de devolución (`returnStatus`): solo en salidas; etiquetas `NONE` → "Sin devolver", `PARTIAL` → "Devolución parcial", `FULL` → "Devuelto" (**`NONE` y `FULL` asumidos**; un valor desconocido se muestra crudo). Se resuelve en `returnStatusLabel()` / `returnStatusClass()`.
  - En salidas se muestran "Devueltas" y "Pendientes" (`returnedQuantity ?? 0`, `pendingQuantity ?? 0`). En retornos esos campos son `null` y no se muestran.
  - **Botón "Retornar":** visible solo si `v.canReturn`. **No recalcular** la regla en el front; el servidor la decide. Llama a `openReturn(v)` (ver convención de acción por fila): carga `GET /stock-vouchers/:id`, revalida que haya pendientes y abre `StockVoucherReturnDialog`. Al cerrar con resultado: aviso `Retorno registrado: #código` y `reload()`.
  - `returnBlock` aún no se muestra. Cuando el backend entregue la lista de valores, usarlo como `title` explicativo.
  - Los empleados del filtro salen de `GET /employees/basic`; si falla, el filtro queda vacío (es opcional).
  - Un `app-date-range-picker` reemplaza a los dos inputs de fecha; no hace falta validar `from <= to` a mano si el componente ya lo garantiza (verificar).
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
- **Movimientos, detalle de vale:**
  - Muestra `unitCost` y `salePrice` tal cual (strings, snapshot del lote). `units[].returned` y `returned`/`pending` solo se muestran en salidas.
  - Solo hay `productSku`; el nombre del producto no viene en el contrato (pendiente).
  - **Botón "Registrar retorno"** en el pie, visible solo si `canReturn()`. Mientras el detalle no traiga `canReturn` del backend, se calcula en el front con la misma regla del servidor: `direction === 'OUT'`, `reason.isReturnable`, alguna línea con `pending > 0` y `order.statusId !== 8` (ENTREGADA). El servidor valida igual.
  - `openReturn()` abre `StockVoucherReturnDialog` con el `VoucherDetail` ya cargado. Al cerrar con resultado: `changed = true` (el listado recarga al cerrar el detalle), aviso `notice` de 5 s y `reload()`.
  - **Recargar el mismo vale:** usar `reload()` (incrementa `reloadTick`); reasignar `currentId` con el mismo valor no emite. `goTo(id)` solo sirve para cambiar de vale.
- **Movimientos, alta de salida (`StockVoucherFormDialog`):**
  - `StockVoucherFormDialogData` solo lleva `product?` (para abrir desde la lista de productos). **No** lleva `originVoucher`: los retornos tienen su propio diálogo.
  - Solo ofrece motivos `direction === 'OUT'`. El motivo define si hay orden (`orderLink === 'REQUIRED'`); al cambiarlo se limpia la orden.
  - Empleado: se carga una sola vez con `getEmployees()` (`shareReplay(1)`), se ordena por nombre y se filtra en el front sin tildes ni mayúsculas (máx. 20 resultados).
  - Orden: `GET /inventory-orders/search` (aquí **sí** funciona `#123` para número exacto). Si `canIssue` es `false` (estados 8, 9, 10) se muestra un aviso rojo y `validate()` bloquea el guardado.
  - Productos: no se repiten (aviso "Ese producto ya está en el movimiento"). Cada línea de la UI es un producto; cada lote marcado genera una línea del vale.
  - Lotes: `GET .../products/:id/lots`; si solo hay **un** lote con `available > 0` se marca solo. El máximo a sacar por lote es `available`.
  - Productos `SERIAL`: `unitIds` con `length = quantity` (la cantidad es el número de equipos marcados). Los de cantidad no envían `unitIds` y `quantity` es entero 1–100000.
  - Un vale admite hasta 100 líneas; la nota hasta 500 caracteres. Si algún lote aún carga (`lots === null`), `validate()` pide esperar.
  - La lista de lotes dice "sucursal principal": el backend filtra la sucursal; el front no la elige.
- **Movimientos, retorno (`StockVoucherReturnDialog`):**
  - Recibe el `VoucherDetail` de la salida en `DIALOG_DATA` (`StockVoucherReturnDialogData = { voucher }`). Quien lo abre es responsable de que ya esté cargado (lista: `GET /stock-vouchers/:id` + revalidación; detalle: el que ya tiene).
  - Solo lista líneas con `pending > 0`. Si hay una sola, viene marcada. Solo se envían las líneas **marcadas**; las fotos de líneas no marcadas se descartan.
  - Solo ofrece motivos `direction === 'IN'`; si hay uno solo, se preselecciona.
  - Por cantidad: `quantity` entre 1 y `pending` (parte en `pending`). Por serial: se decide con `units.length > 0`; se marcan equipos con `returned: false` y `quantity = unitIds.length`.
  - Se envía `originVoucherId` y, por línea, `originLineId`, `quantity` y `unitIds` (solo seriales). **No** se envía `lotId`, `employeeId` ni `orderId` (se heredan).
  - Si falla con 409/400 por una orden entregada u otra razón, el mensaje del servidor se muestra tal cual en el pie.
- **Gateway: DTOs con whitelist.** El `ValidationPipe` rechaza cualquier propiedad que no esté decorada (`property X should not exist`). Cada vez que un contrato agregue campos al request, hay que agregarlos también al DTO del gateway (`ReceiptLineGatewayDto`, `CreateReceiptGatewayDto`, `StockVoucherLineGatewayDto`, `CreateStockVoucherGatewayDto`...). Ya pasó con `supplierCode`, `supplierDescription` y `supplierQuantity` (esta última admite hasta 4 decimales).
- **Tipos de proveedor:** `SupplierOption` es el mínimo del formulario (`id, code, businessName, tradeName, identificationType, identificationNumber`); `SupplierSearchItem` lo extiende con `status` y `label`. El `supplier` del preview es `SupplierSearchItem`. `Supplier.status` es booleano (no existe `active`).
- **Detalle de ingreso, nulabilidad:** `ReceiptDetailLine.product`, `lot` y `lotConfig` son nulables (líneas sin inventario). En plantillas usar alias (`@if (l.product; as p)`, `@if (l.affectsInventory && l.lotConfig; as cfg)`).
- **`app-autocomplete`:** genérico con `T extends { id: string | number }` (las órdenes usan `id` numérico). Un `effect` refleja en el input el `value` que asigna el padre (por ejemplo `setValue(proveedor)` desde `applyAccessKey` sí se muestra). Si el padre pone `value` en `null`, el input **no** se vacía solo: recrear el componente o usar `clear()`. Al escribir se descarta la selección. No admite término inicial.
  - Caso conocido: en `StockVoucherFormDialog`, al cambiar entre dos motivos que exigen orden, `order.setValue(null)` deja el texto viejo en el input (el componente no se recrea). Resolver con `clear()` o recreándolo.
- **No** dejar `console.log` (los stubs actuales sin implementar deben reemplazarse). Nota: el visor usa un `console.warn` en el respaldo de descarga; es intencional.
- Si un componente usa `*ngTemplateOutlet`, importar `NgTemplateOutlet`. Si usa el pipe `number`, importar `DecimalPipe`. Si usa `date`, importar `DatePipe` (el diálogo de retorno no muestra fechas, así que no lo necesita).
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

Iconos ya definidos en `ICONS`: `dashboard`, `products`, `suppliers`, `receipts` (bandeja con flecha hacia abajo), `movements` (flechas de intercambio; usado por Movimientos), `logout`, `menu`, `close`. El menú actual: Dashboard, Productos, Proveedores, Ingresos y Movimientos (`{ label: 'Movimientos', path: '/movimientos', icon: ICONS.movements }`).

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

Endpoint fuera de la base del servicio (ej. SRI, empleados, órdenes): usar `environment.apiUrl` directo.

```typescript
previewAccessKey(accessKey: string) {
  return this.http.post<AccessKeyPreview>(`${environment.apiUrl}/sri/access-key/preview`, { accessKey });
}
```

### Método `list` de un servicio (omite vacíos)

```typescript
list(query: ListVouchersQuery, includeFilters = false) {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    const v = typeof value === 'string' ? value.trim() : value;
    if (v !== '' && v !== null && v !== undefined) params = params.set(key, String(v));
  }
  if (includeFilters) params = params.set('includeFilters', 'true');
  return this.http.get<VoucherListResponse>(this.base, { params });
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

### Modal que recibe datos obligatorios (ya cargados por quien lo abre)

```typescript
// quien abre el modal
this.dialog.open<StockVoucherCreated>(StockVoucherReturnDialog, {
  data: { voucher } satisfies StockVoucherReturnDialogData,
  width: '44rem', maxWidth: '95vw', autoFocus: 'first-tabbable', disableClose: true,
});

// dentro del modal
readonly data = inject<StockVoucherReturnDialogData>(DIALOG_DATA);
```

### Modal de detalle que avisa si hubo cambios

```typescript
this.dialog
  .open<boolean>(SupplierDetailDialog, { data: { id }, width: '44rem', maxWidth: '95vw', autoFocus: false })
  .closed.subscribe(changed => { if (changed) this.load(); });

// dentro del modal: private changed = false; close() { this.dialogRef.close(this.changed); }
```

### Detalle que se recarga y abre un modal de acción (ejemplo: retorno desde el detalle)

```typescript
private readonly reloadTick = signal(0);
readonly notice = signal<string | null>(null);

// carga: id + tick, así el mismo id también recarga
toObservable(computed(() => ({ id: this.currentId(), t: this.reloadTick() })))
  .pipe(
    tap(() => { this.loading.set(true); this.error.set(null); }),
    switchMap(({ id }) => this.api.getOne(id).pipe(catchError(err => { /* aviso */ return EMPTY; }))),
    takeUntilDestroyed(),
  )
  .subscribe(d => { this.detail.set(d); this.loading.set(false); });

reload() { this.reloadTick.update(n => n + 1); }

openReturn() {
  const voucher = this.detail();
  if (!voucher || !this.canReturn()) return;
  this.dialog
    .open<StockVoucherCreated>(StockVoucherReturnDialog, {
      data: { voucher } satisfies StockVoucherReturnDialogData,
      width: '44rem', maxWidth: '95vw', autoFocus: 'first-tabbable', disableClose: true,
    })
    .closed.subscribe(created => {
      if (!created) return;
      this.changed = true; // el listado recarga al cerrar el detalle
      this.notice.set(`Retorno registrado: #${created.code}`);
      setTimeout(() => this.notice.set(null), 5000);
      this.reload();
    });
}
```

### Acción por fila que carga datos antes de abrir el modal (ejemplo: "Retornar" en la lista)

```typescript
/** Id del vale cuyo detalle se está cargando; bloquea el doble clic */
readonly returningId = signal<string | null>(null);

openReturn(v: VoucherListItem) {
  if (!v.canReturn || this.returningId()) return;
  this.returningId.set(v.id);

  this.api.getOne(v.id).subscribe({
    next: detail => {
      this.returningId.set(null);
      // la lista pudo ir por detrás del estado real: se revalida con el detalle
      if (!detail.lines.some(l => (l.pending ?? 0) > 0)) {
        this.error.set(`El movimiento #${detail.code} ya no tiene repuestos pendientes de devolver.`);
        this.reload();
        return;
      }
      this.dialog
        .open<StockVoucherCreated>(StockVoucherReturnDialog, {
          data: { voucher: detail } satisfies StockVoucherReturnDialogData,
          width: '44rem', maxWidth: '95vw', autoFocus: 'first-tabbable', disableClose: true,
        })
        .closed.subscribe(created => {
          if (!created) return;
          this.flash(`Retorno registrado: #${created.code}`);
          this.reload();
        });
    },
    error: err => {
      this.returningId.set(null);
      const msg = err?.error?.message;
      this.error.set(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'No se pudo cargar el movimiento.'));
    },
  });
}
```

En la plantilla, el botón se deshabilita con `[disabled]="!!returningId()"` y muestra el spinner solo si `returningId() === v.id`.

### Abrir el visor de imágenes

```typescript
import { ImageLightboxDialog, LightboxData } from '.../shared/components/image-lightbox-dialog/image-lightbox-dialog';

const data: LightboxData = {
  images: fotos.map(f => ({ url: f.url, fileName: f.originalName })),
  startIndex,
};
this.dialog.open(ImageLightboxDialog, { data, maxWidth: '95vw', autoFocus: false });
```

### Listado con filtros, orden y paginación

```typescript
readonly query = signal<ListVouchersQuery>({
  page: 1, limit: 20, search: '', direction: '', reasonId: '', employeeId: '',
  from: '', to: '', sortBy: 'createdAt', sortDir: 'DESC',
});
private readonly reloadTick = signal(0);

toObservable(computed(() => ({ q: this.query(), t: this.reloadTick() })))
  .pipe(
    tap(() => this.loading.set(true)),
    switchMap(({ q }) =>
      this.api.list(q, !this.filters()).pipe(
        catchError(err => {
          const msg = err?.error?.message;
          this.error.set(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'No se pudo cargar el listado.'));
          this.loading.set(false);
          return EMPTY;
        }),
      ),
    ),
    takeUntilDestroyed(),
  )
  .subscribe(res => {
    if (res.filters) this.filters.set(res.filters);
    this.items.set(res.items);
    this.meta.set(res.meta);
    this.error.set(null);
    this.loading.set(false);
  });

private patch(changes: Partial<ListVouchersQuery>) { this.query.update(q => ({ ...q, ...changes })); }
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

`searchFn` es `(term: string) => Observable<T[]>` (debounce de 300 ms interno; busca también con el término vacío al enfocar). `createLabel` muestra la opción "+ texto" al final y emite `createClicked`. Navegación con teclado (flechas, Enter, Escape). Inputs: `label`, `sublabel`, `placeholder`, `ariaLabel`, `createLabel`, `invalid`, `clearOnSelect`.

### Fila-tarjeta de un listado

```html
<article class="row-card">
  <div class="row-col sm:flex-1">
    <span class="col-label">Producto</span>
    <span class="col-valor font-semibold">{{ p.name }}</span>
  </div>
</article>
```

(Movimientos e ingresos usan `<article>` con utilidades directas en lugar de estas clases.)

### Subida de archivos reutilizable

```html
<app-image-upload [(files)]="images" [max]="5" />

<!-- un solo archivo, imagen o PDF -->
<app-image-upload [(files)]="documentFiles" [multiple]="false"
  accept="image/jpeg,image/png,image/webp,application/pdf" [maxSizeMb]="10"
  label="Arrastra la factura o proforma aquí" />
```

`images` es un `signal<File[]>([])`. Inputs: `max`, `maxSizeMb`, `accept`, `multiple`, `camera`, `label`. Los PDF se muestran con un recuadro "PDF" en lugar de miniatura. Para valores que vienen de un `FormControl`: `[files]="c.images.value" (filesChange)="c.images.setValue($event)"`. Para productos ya creados, `product-images` gestiona agregar, poner como principal y eliminar.

Para plegar el cargador sin perder las miniaturas (salida y retorno), ocultar con CSS y **no** con `@if`:

```html
<div [class.hidden]="!lc.photosOpen.value">
  <app-image-upload [files]="lc.images.value" (filesChange)="lc.images.setValue($event)"
    [max]="5" [maxSizeMb]="5" label="Arrastra las fotos aquí" />
</div>
```

### Campo de formulario con estilos del proyecto

```html
<label for="nombre" class="mb-1.5 block text-sm font-medium text-heading">Nombre</label>
<input id="nombre" formControlName="nombre" class="input-field" />
<button type="submit" class="btn-primary">Guardar</button>
```
## 9. Pendientes y decisiones abiertas

- **Auditoría (backend):** registrar quién crea, edita y elimina. Recomendado: clase base con `createdAt/By`, `updatedAt/By`, `deletedAt/By` y una tabla `audit_logs` solo de inserción. Falta decidir ORM y si se guarda solo el id del usuario o también una copia del nombre.
- **Nombres de usuario:** en ingresos el backend devuelve solo ids (`createdById`, `userId`...) y se muestra el id. En vales ya vienen `employee.name` y `createdBy.name` (pueden ser `null`).
- **Refactor:** mover `PaginationMeta` y `PaginatedResponse` a `shared/types` (los usan suppliers, receipts y stock-vouchers).
- **Movimientos, retornos (probar de punta a punta):**
  - Salida sin usar → retorno total (el botón debe desaparecer en lista y detalle).
  - Retorno parcial por cantidad y luego el resto.
  - Retorno de seriales (solo equipos con `returned: false`).
  - Orden ENTREGADA (8): no debe mostrar el botón; probar que el servidor también lo rechaza.
  - Reintento con el mismo `clientRequestId` (`replayed: true` como éxito).
  - Lista desactualizada: pulsar "Retornar" en un vale ya devuelto desde otra pestaña (debe avisar y recargar).
- **Movimientos, contrato del listado (confirmar con el backend):**
  - Valores reales de `returnStatus` (hoy se asume `NONE | PARTIAL | FULL`; solo se confirmó `PARTIAL`).
  - Lista completa de `returnBlock` (hoy solo `IS_RETURN`). Con ella, mostrar un `title` explicativo cuando no hay botón (orden entregada, sin pendientes, motivo no retornable...).
  - Nulabilidad real de `orderStatus`, `customerName` y `createdBy.name` (se marcaron anulables por prudencia).
  - `createdBy` y `returnCount` llegan pero no se muestran todavía.
- **Movimientos, detalle:**
  - Pedir `canReturn` y `returnBlock` también en `GET /stock-vouchers/:id` para no duplicar la regla del front (`canReturn` del diálogo de detalle).
  - **Nombre del producto** en las líneas: el contrato solo trae `productSku`. Pedir `productName` al backend.
- **Movimientos, listado:**
  - **Filtro por orden (`orderId`)** con `GET /inventory-orders/search` y `app-autocomplete` (`OrderSearchItem.id` es numérico). Por ahora el `search` ya cubre el número de orden.
  - **Enlace al vale de origen:** hoy "Retorno de la salida #código" es solo texto; convertirlo en botón que abra `openDetail(ov.id)`.
  - Filtro por estado de devolución (`returnStatus`) o "solo retornables", si el backend lo soporta.
- **Movimientos, alta de salida:**
  - `order.setValue(null)` al cambiar de motivo no vacía el texto del `app-autocomplete` de orden. Usar `clear()` o recrear el componente.
  - Confirmar con el backend los límites de fotos por línea (se asumió 5 por producto y 5 MB por imagen).
  - **Costo neto de una orden:** `GET /stock-vouchers/orders/:orderId`, sin usar.
  - **Prefijo real del gateway** para `/stock-vouchers`, `/employees/basic` y `/inventory-orders/search`.
  - Confirmar que el `employeeId` del filtro usa el mismo `id` que devuelve `GET /employees/basic`.
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
- **Detalle/listado de ingreso:** mostrar la insignia de origen (`Clave de acceso`) y de líneas sin inventario.
- **Listado de ingresos (limpieza):** `ReceiptList.setDate()` ya no se usa desde la plantilla (el rango lo maneja `DateRangePicker`); eliminarlo o asegurar el orden `dateFrom <= dateTo` en el picker. `dateRangeControl` está tipado como `any` (también en movimientos): tiparlo (`{ dateFrom: string; dateTo: string } | null`). Se importa `DocumentTypeOption`, `Receipt` y `SupplierOption` sin usar en algunos archivos: limpiar imports. En `StockVoucherFormDialog` quedan imports sin uso probables (`ProductOption` se usa; revisar `StockVoucherNewDataResponse`, `Employee`).
- **Ingresos, anular pago:** existe `PATCH /receipts/:id/payments/:paymentId/void` (`{ reason }`, 3 a 500 caracteres), pero **no está implementado** en el front por decisión del equipo.
- **Ingresos, métodos de pago:** `PaymentStatusDialog` y `ReceiptDetailDialog` usan una lista fija (`CASH`, `TRANSFER`, `CHECK`, `CARD`, `OTHER`). El contrato dice que las etiquetas vienen en `paymentMethods` de `GET /receipts/:id/payments`, endpoint aún no documentado. (`GET /receipts/new-data` ya devuelve `paymentMethods` para el formulario de alta.)
- **Ingresos, verificar ingreso** (`status: VERIFIED`) y **anular ingreso**: no hay acción en el front todavía.
- **Ingresos, filtro por `productId`:** soportado por el backend pero no incluido en el listado (el buscador general ya encuentra por producto).
- **Ingresos, código de impuesto de compra (`purchaseTaxCode`):** no tiene campo visible en el formulario; se carga desde el último ingreso del producto o desde la factura (`tax.code`) y se envía. Falta conocer su catálogo para ofrecer un selector.
- **Ingresos, estados de equipo y acciones del historial:** solo se conocen `AVAILABLE`/`SOLD` y `CREATED`/`UPDATED`. `RESERVED`, `VERIFIED` y `VOIDED` son suposiciones; los valores desconocidos se muestran crudos. Falta la lista real y las etiquetas de `FIELD_LABELS`.
- **Ingresos, límites de archivos:** se asumió 5 fotos por producto, 5 MB por imagen y 10 MB para documento y comprobante. Confirmar con el backend.
- **Tipo `AccessKeySupplier`:** obsoleto desde que `supplier` usa `SupplierSearchItem`; borrarlo de `receipt.types.ts` (sigue declarado).
- **Regla de equipo completo (`DEVICE`)** en el formulario de producto: requiere que `types` de `new-data` incluya `kind`.
- **Backend:** convertir a booleano `isSellable`, `isRepairPart` e `isCustomizable` en `buildProductDto` (llegan como texto en multipart).
- Actualizar este archivo al agregar features, endpoints o convenciones nuevas.

## 10. Datos que NO están en el contexto

- Script o configuración de **lint** (ESLint) y configuración de Prettier.
- Versión instalada de `@angular/cdk` y contenido exacto de `app.config.ts`, `app.ts` y los `tsconfig*.json`.
- Contenido de `products.routes.ts` / `suppliers.routes.ts` (el de `stock-vouchers.routes.ts` y `app.routes.ts` sí se vio).
- El `.ts` de `model-picker` y si `product-images` ya está integrado en el detalle de producto.
- Código de `stock-vouchers.service.ts` tras los últimos cambios (se asume que `getOne`, `create(body, lineImages)`, `getLots`, `getEmployees`, `searchOrders`, `searchProducts` y `list` existen tal como los usan los componentes).
- Los `.css` de los componentes de movimientos (se asumen vacíos) y que `stock-voucher-return-dialog.html` compile sin ajustes (`@let` dentro de `@for`, `lc.origin.value`).
- Código de `date-range-picker` (solo se conoce su uso: `[formControl]` con `{ dateFrom, dateTo }`; no se sabe si garantiza `dateFrom <= dateTo` ni su estado vacío).
- Código de `auth.service.ts`, `auth.guard.ts` y `theme-toggle`.
- **Rutas reales del gateway** de ingresos y movimientos: se usa `/receipts` (con `/receipts/products/search`, `/receipts/suppliers/search` y `/receipts/new-data`), `/sri/access-key/preview`, `/stock-vouchers`, `/employees/basic` y `/inventory-orders/search`. Confirmar cualquier cambio de prefijo.
- Reglas del backend para imágenes de producto: nombre del campo (`images`), máximo por producto (se asumió 5), formatos, tamaño y qué ocurre al eliminar la principal.
- Reglas del backend para fotos de vales: máximo por línea, tamaño y formatos (se asumió 5 y 5 MB), y si un retorno puede llevar fotos en todas sus líneas.
- Valores por defecto de los usos (`isSellable`, `isRepairPart`, `isCustomizable`): el formulario los envía en `false`.
- Ruta real de `theme-toggle`: se importa desde `shared/components/theme-toggle/theme-toggle/theme-toggle` en el layout; unificar con el login.
- `fileReplacements` por entorno: `angular.json` no los define, hay un solo `environment.ts`.
- Código de `entity` de `Country` y catálogo de `documentTypes.code` (el mapeo de `FACTURA` se hace tolerante por `code` o `name`; confirmar el valor real).
- Catálogo de estados de orden (`statusId`): solo se conoce que 8 = ENTREGADA (no admite retornos) y que 8, 9 y 10 no admiten salidas (`canIssue: false`).
- Catálogos de `returnStatus` y `returnBlock` del listado de vales (ver sección 9).