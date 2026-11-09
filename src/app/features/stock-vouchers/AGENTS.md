# AGENTS.md (stock-vouchers) — Movimientos / vales de stock

> **Archivo:** `src/app/features/stock-vouchers/AGENTS.md`
> **Alcance:** movimientos de stock (vales): listado, alta de salidas, alta de retornos y detalle. Sus endpoints, contratos, reglas y pendientes.
> **Se edita cuando:** cambia algo dentro de `features/stock-vouchers/` o un contrato de `/stock-vouchers`, `/employees/basic` o `/inventory-orders/search`.
> **Reglas generales** (multipart, idempotencia, montos, fechas, zoneless, estilos): ver `/AGENTS.md`. No se repiten aquí.
> **Componentes compartidos usados** (`app-autocomplete`, `app-image-upload`, `app-date-range-picker`, visor): ver `src/app/shared/AGENTS.md`.
> **Depende de:** tipos de `suppliers` (`PaginationMeta`) y de `receipts` (`ProductOption`, `SearchProductsResponse`, endpoint `GET /receipts/products/search`).

## 1. Descripción y estado

Un vale de stock registra una **salida** (repuestos que salen del stock hacia un empleado, con o sin orden) o un **retorno** (lo que no se usó vuelve al lote original). Salida y retorno usan el mismo endpoint (`POST /stock-vouchers`); el motivo (`reasonId`) define cuál es.

Hecho:

- **Listado** con filtros (tipo, motivo, empleado, rango de fechas, búsqueda), orden y paginación. Cada fila muestra estado de devolución, cantidades devueltas/pendientes, orden con estado y cliente, y fotos.
- **Alta de salida** (`StockVoucherFormDialog`): motivo, empleado, orden (si el motivo la exige), productos, lotes, seriales y fotos por producto.
- **Alta de retorno** (`StockVoucherReturnDialog`): se abre desde el botón "Retornar" de la lista o "Registrar retorno" del detalle, solo cuando `canReturn` es `true`.
- **Detalle en modal** (`StockVoucherDetailDialog`): cabecera, líneas, equipos con IMEI, fotos, navegación salida ↔ retorno y botón de retorno.

Pendiente: filtro por orden y nombre del producto en el detalle (sección 6).

## 2. Estructura

```
features/stock-vouchers/
├── AGENTS.md                      # este archivo
├── stock-vouchers.routes.ts       # STOCK_VOUCHERS_ROUTES
├── pages/
│   └── stock-voucher-list/        # StockVoucherList: filtros, tarjetas, paginación, botón "Retornar"
├── components/
│   ├── stock-voucher-form-dialog/     # StockVoucherFormDialog: alta de salida (lotes, seriales, fotos)
│   ├── stock-voucher-return-dialog/   # StockVoucherReturnDialog: alta de retorno (recibe el VoucherDetail de la salida)
│   └── stock-voucher-detail-dialog/   # StockVoucherDetailDialog: detalle de solo lectura + "Registrar retorno"
├── services/
│   └── stock-vouchers.service.ts      # StockVouchersService (base = `${apiUrl}/stock-vouchers`)
└── types/
    └── stock-voucher.types.ts
```

Quién abre a quién:

- `StockVoucherList` abre `StockVoucherFormDialog` (nuevo), `StockVoucherDetailDialog` (ver detalle) y `StockVoucherReturnDialog` (retornar; carga antes el detalle con `GET /stock-vouchers/:id`).
- `StockVoucherDetailDialog` abre `StockVoucherReturnDialog` con el detalle que ya tiene y `ImageLightboxDialog` para las fotos.
- `StockVoucherReturnDialog` no importa de la lista ni del detalle.

Métodos que los componentes esperan del servicio (**asumido por el uso; el archivo del servicio no se ha visto**): `list(query, includeFilters)`, `getOne(id)`, `getNewData()`, `create(body, lineImages)`, `getLots(productId)`, `getEmployees()`, `searchOrders(term)` y `searchProducts(term)`.

## 3. Endpoints

Base: `StockVouchersService.base` = `${environment.apiUrl}/stock-vouchers`. **Verificar el prefijo del gateway** (puede llevar el de `RouterModule`). Los endpoints marcados "fuera de la base" usan `environment.apiUrl` directo.

| Uso | Endpoint | Quién lo usa |
|---|---|---|
| Datos del formulario | `GET /stock-vouchers/new-data` → `{ reasons }` (cada motivo: `id, code, name, direction, orderLink, isReturnable`). Salidas usan `direction: 'OUT'`; retornos, `'IN'` | Form de salida, diálogo de retorno |
| Crear vale (salida **o** retorno) | `POST /stock-vouchers` (**multipart**: `data` con JSON y `photos_<índice de línea>`) → `StockVoucherCreated` (incluye `replayed`) | Form de salida, diálogo de retorno |
| Listar | `GET /stock-vouchers` (`page`, `limit`, `sortBy` `createdAt\|code`, `sortDir`, `direction` `OUT\|IN`, `reasonId`, `employeeId`, `orderId`, `from`, `to`, `search`, `includeFilters`) → `{ items, meta, filters? }` | Lista |
| Detalle | `GET /stock-vouchers/:id` → `VoucherDetail` | Detalle, lista (antes de retornar) |
| Lotes de un producto | `GET /stock-vouchers/products/:productId/lots` → `StockLot[]` (con `units` si es SERIAL) | Form de salida |
| Costo neto de una orden | `GET /stock-vouchers/orders/:orderId` (documentado, **no usado aún**) | — |
| Empleados | `GET /employees/basic` (**fuera de la base**) → `Employee[]` (`id, username, name`) | Lista (filtro), form de salida |
| Buscar órdenes | `GET /inventory-orders/search?search=` (**fuera de la base**; vacío devuelve las 20 más recientes) → `OrderSearchItem[]` | Form de salida |
| Buscar productos | `GET /receipts/products/search` (reutilizado de `receipts`) | Form de salida |
## 4. Contratos

### 4.1 Listado: `GET /stock-vouchers`

Parámetros y búsqueda:

- `filters` (con `reasons`) solo viene con `includeFilters=true`.
- `search`: solo dígitos (hasta 9) coincide con el **código del vale o el número de orden** (puede traer ambos); cualquier otro texto busca por nombre de empleado (ILIKE, sensible a tildes). `#123` **no** funciona aquí: se envía `123`.
- `orderId` es el id interno de la orden (el de `inventory-orders/search`), no el número visible.
- `from`/`to` `AAAA-MM-DD`, rango inclusivo en hora de America/Guayaquil.
- Errores 400 llegan en español desde el DTO.

Item (`VoucherListItem`):

| Campo | Detalle |
|---|---|
| `id`, `code`, `direction`, `createdAt` | `createdAt` en ISO UTC |
| `reason` | `{ id, code, name, isReturnable }` |
| `employee`, `createdBy` | `{ id, name }`; `name` puede ser `null` |
| `orderId`, `orderNumber`, `orderStatus`, `customerName` | `null` sin orden (o si la réplica no sincronizó). `orderStatus` es `{ id, name }` |
| `originVoucherId`, `originVoucher` | Solo en retornos. `originVoucher` es `{ id, code }` |
| `lineCount` | Número de líneas |
| `totalQuantity` | **Unidades** (suma de `quantity` de las líneas), no líneas |
| `returnedQuantity`, `pendingQuantity`, `returnStatus` | Solo en salidas; `null` en retornos |
| `returnCount`, `photoCount` | Cantidad de retornos y de fotos |
| **`canReturn`** | Única condición que el front usa para mostrar "Retornar" en la fila. `false` en retornos |
| `returnBlock` | Motivo por el que no se puede retornar; `null` si `canReturn`. En retornos es `IS_RETURN` |

Sin confirmar con el backend:

- `returnStatus`: se asume `NONE | PARTIAL | FULL` (solo se confirmó `PARTIAL`). Un valor desconocido se muestra crudo.
- `returnBlock`: solo se conoce `IS_RETURN`; falta la lista completa.
- Nulabilidad real de `orderStatus`, `customerName` y `createdBy.name` (se marcaron anulables por prudencia).

La lista puede ir unos instantes por detrás del estado real de la orden. Al pulsar "Retornar" el front revalida con `GET /stock-vouchers/:id` y el servidor valida igual al crear.

### 4.2 Detalle: `GET /stock-vouchers/:id`

- `reason` y los `name` de `employee`/`createdBy` pueden ser `null`.
- `order` es `null` sin orden; sus `statusId`/`statusName`/`customerName` pueden ser `null` si la réplica no sincronizó.
- `originVoucher` solo en retornos; `returns[]` solo en salidas (más antiguo → más nuevo).
- Cada línea trae `productSku` (**no** el nombre), `lotCode`, `unitCost` y `salePrice` (strings, snapshot del lote), `billableInSales`, `billableInRepairOrders`, `originLineId`, `units` (vacío si es por cantidad) y `attachments` (fotos por línea con URL firmada de 30 min).
- `returned` y `pending` solo existen en salidas. `units[].returned` solo sirve en salidas.
- **El detalle aún no trae `canReturn` ni `returnBlock`**: `StockVoucherDetailDialog` lo calcula en el front. Pendiente pedirlos al backend.
- Errores: 400 si `:id` no es UUID (mensaje en inglés de `ParseUUIDPipe`), 404 "El vale no existe" (también de otra empresa).

### 4.3 Crear: `POST /stock-vouchers` (campo `data`)

Mismo endpoint y mismo DTO del gateway para salida y retorno (`CreateStockVoucherGatewayDto` con `StockVoucherLineGatewayDto`). El motivo (`reasonId`) define cuál es. En el gateway: `parseMultipartRequest` → `parseJsonField(CreateStockVoucherGatewayDto, formData.data)` → `prepareStockVoucherFiles(files, dto.lines.length)`.

Comunes:

- `clientRequestId` (UUID v4), `reasonId` (UUID), `note` (≤ 500), `lines[]` (de 1 a 100).
- Por línea: `quantity` entero de 1 a 100000; `unitIds` (hasta 1000, UUID v4) solo en productos SERIAL, con `length = quantity`.

Salida:

- `employeeId` (quien recibe).
- `orderId` (entero ≥ 1) solo si el motivo tiene `orderLink = REQUIRED`.
- Por línea: `lotId` (UUID del lote del que sale).

Retorno:

- `originVoucherId` (UUID del vale de salida) y por línea `originLineId`.
- `quantity` de una línea no puede superar su `pending` (el front lo valida; el servidor también).
- `unitIds` (solo seriales): los `unitId` con `returned: false` de esa línea.
- **No** se envían `lotId`, `employeeId` ni `orderId`: el backend los hereda del vale original y devuelve al lote original.
- El motivo debe ser de `direction: 'IN'`.

Fotos (campo `photos_<índice base 0>`, en el orden de `lines`; nombres en `STOCK_VOUCHER_FIELDS`):

- Salida: las fotos de un producto van en la **primera** línea (lote) de ese producto; las demás líneas llevan `[]`.
- Retorno: cada línea seleccionada lleva sus propias fotos.
- Límites que aplica el front: 5 por producto o línea y 5 MB por imagen. **Asumidos; confirmar con el backend.**

Respuesta 201 `StockVoucherCreated` (`id`, `code`, `direction`, `reason`, `employeeId`, `orderId`, `orderNumber`, `originVoucherId`, `note`, `createdAt`, `lines[]`, `replayed`). `replayed: true` se trata como éxito.

### 4.4 Datos de apoyo

- **Lotes** (`GET /stock-vouchers/products/:productId/lots` → `StockLot[]`): `lotId`, `code` (número de la etiqueta/QR), `branchId`, `onHand`, `reserved`, `available` (máximo a sacar), `salePrice` (string), `warrantyDays`, banderas de facturación, `createdAt` y `units` (`{ id, serials[] }`, vacío si es por cantidad). El backend filtra la sucursal principal; el front no la elige.
- **Órdenes** (`GET /inventory-orders/search` → `OrderSearchItem[]`): `id` (**numérico**, se envía como `orderId`), `orderNumber` (el que ve el usuario), `customerName`, `device`, `deviceType`, `orderType`, `status { id, name }` y `canIssue`. `canIssue: false` en estados 8, 9 y 10 (no admiten salidas). En este endpoint **sí** funciona `#123` para número exacto.
- **Empleados** (`GET /employees/basic` → `Employee[]`): `id` (se envía como `employeeId`), `username`, `name` (primer nombre + primer apellido).
- **Motivos** (`StockVoucherReason`): `direction` `OUT | IN`, `orderLink` `REQUIRED | FORBIDDEN`, `isReturnable`.
## 5. Reglas de la feature

> Reglas generales (multipart, idempotencia, montos, fechas, zoneless): `/AGENTS.md`, secciones 4 y 7.

### 5.1 Formato y presentación

- **Hora de vales:** `createdAt` llega en UTC; mostrar con `DatePipe` y zona fija de Ecuador: `{{ v.createdAt | date:'dd/MM/yyyy HH:mm':'-0500' }}` (sin horario de verano). En el formulario de salida, `lot.createdAt` se muestra solo como `dd/MM/yyyy` sin zona (informativo).
- **Montos y cantidades:** `unitCost` y `salePrice` se muestran tal cual (strings, snapshot del lote). `totalQuantity`, `returnedQuantity`, `pendingQuantity` y `quantity` son enteros y también se muestran tal cual. El único cálculo del front es el total a sacar o devolver mientras se llena el formulario (`lineTotalQty`, `lineQty`).
- **Insignias:** `directionLabel()` / `directionClass()` para Salida/Retorno y `returnStatusLabel()` / `returnStatusClass()` para el estado de devolución. Se resuelven con un `Record` en el `.ts`, no inline en la plantilla.
- **Fotos de vales:** la URL firmada dura 30 min. Antes de usarla verificar que empiece por `http` (`isUrl`); si no, mostrar el recuadro "Sin vista". Al abrir el visor, `startIndex` se calcula buscando la foto pulsada por `id` dentro del arreglo ya filtrado por URL válida (`openPhoto`).

### 5.2 Listado (`StockVoucherList`)

- `includeFilters=true` solo hasta recibir `filters`; el select de motivos se llena con `filters.reasons` y se acota por la dirección elegida. Al cambiar la dirección, si el motivo elegido ya no corresponde, se descarta.
- Quitar el `#` inicial del `search` antes de enviarlo (`#123` no funciona en este endpoint). Placeholder: "Código, nº de orden o empleado".
- Textos por defecto: `employee.name` null → "Empleado no disponible"; sin orden → "Sin orden". Retornos se distinguen por `direction: 'IN'` (insignia "Retorno") y muestran "Retorno de la salida #código" con `originVoucher` (hoy es texto, no enlace).
- **Insignia de devolución** (`returnStatus`): solo en salidas. Etiquetas: `NONE` → "Sin devolver", `PARTIAL` → "Devolución parcial", `FULL` → "Devuelto". **`NONE` y `FULL` son asumidos**; un valor desconocido se muestra crudo con estilo neutro.
- En salidas se muestran "Devueltas" y "Pendientes" (`returnedQuantity ?? 0`, `pendingQuantity ?? 0`). En retornos esos campos son `null` y no se muestran.
- **Botón "Retornar":** visible solo si `v.canReturn`. **No recalcular** la regla en el front: el servidor la decide. Llama a `openReturn(v)`, que sigue la convención de acción por fila (ver sección 7.2). Al cerrar con resultado: aviso `Retorno registrado: #código` y `reload()`.
- `returnBlock`, `createdBy` y `returnCount` llegan pero aún no se muestran. Cuando el backend entregue la lista de valores de `returnBlock`, usarlo como `title` explicativo cuando no hay botón.
- Los empleados del filtro salen de `GET /employees/basic`; si falla, el filtro queda vacío (es opcional).
- `app-date-range-picker` reemplaza a los dos inputs de fecha; no se valida `from <= to` a mano si el componente ya lo garantiza (**sin verificar**, ver sección 8).

### 5.3 Detalle (`StockVoucherDetailDialog`)

- **Navegación interna:** guarda `currentId` en un signal y recarga con `toObservable(computed(() => ({ id: currentId(), t: reloadTick() })))` + `switchMap`. `goTo(id)` cambia de vale (salida ↔ retorno) sin cerrar el modal; `reload()` incrementa `reloadTick` para recargar el mismo vale. Reasignar `currentId` con el mismo valor no emite.
- Muestra `unitCost` y `salePrice` tal cual. `units[].returned` y `returned`/`pending` solo se muestran en salidas (`isOut()`).
- Solo hay `productSku`; el nombre del producto no viene en el contrato (pendiente).
- **Pie:** botón "Registrar retorno" (solo si `canReturn()`) y "Cerrar". Un aviso `notice` verde de 5 s confirma el retorno.
- **`canReturn()` del detalle** se calcula en el front hasta que el backend lo mande: `direction === 'OUT'`, `reason.isReturnable`, alguna línea con `pending > 0` y `order.statusId !== 8` (ENTREGADA). El servidor valida igual.
- `openReturn()` abre `StockVoucherReturnDialog` con el `VoucherDetail` ya cargado. Al cerrar con resultado: `changed = true` (el listado recarga al cerrar el detalle), aviso y `reload()`.
- `close()` devuelve `changed` (`true` si hubo retorno) para que el listado recargue.
- Botón oculto, no deshabilitado, cuando no se puede retornar.

### 5.4 Alta de salida (`StockVoucherFormDialog`)

- `StockVoucherFormDialogData` solo lleva `product?` (para abrir desde la lista de productos). **No** lleva `originVoucher`: los retornos tienen su propio diálogo.
- Si se abre con `product`, `showProductSearch` arranca en `false` y la línea se crea y carga sus lotes en el constructor.
- Solo ofrece motivos `direction === 'OUT'` (`outReasons`). El motivo define si hay orden (`orderLink === 'REQUIRED'`); al cambiarlo se limpia la orden.
- **Empleado:** se carga una sola vez con `getEmployees()` (`shareReplay(1)`), se ordena por nombre con `localeCompare('es')` y se filtra en el front sin tildes ni mayúsculas (máx. 20 resultados).
- **Orden:** `GET /inventory-orders/search` (aquí `#123` busca número exacto). Si `canIssue` es `false` se muestra un aviso rojo y `validate()` bloquea el guardado. Los errores de búsqueda van a `orderSearchError`.
- **Productos:** no se repiten (aviso "Ese producto ya está en el movimiento"). Cada línea de la UI es un producto; cada lote marcado genera una línea del vale.
- **Lotes:** `GET .../products/:id/lots`; si solo hay **un** lote con `available > 0` se marca solo. El máximo a sacar por lote es `available` (confirmado en el código). Un lote con `available <= 0` no se puede marcar. Si falla la carga, la línea muestra "Reintentar" (`loadLots`) y se llama a `markForCheck()` por ser zoneless.
- **Seriales (`trackingMode === 'SERIAL'`):** `unitIds` con `length = quantity` (la cantidad es el número de equipos marcados) y no puede superar `available`. Los productos por cantidad no envían `unitIds` y `quantity` es entero 1–100000.
- **Fotos:** el cargador se pliega con CSS (`[class.hidden]`), no con `@if`, para no perder las miniaturas. Van en la primera línea (lote) de cada producto (`buildPayload`: `k === 0 ? images : []`).
- **Límites:** un vale admite hasta 100 líneas; la nota hasta 500 caracteres. Si algún lote aún carga (`lots === null`), `validate()` pide esperar.
- **Idempotencia:** `clientRequestId` se genera una vez al abrir; `replayed: true` es éxito.
- **Conocido:** al cambiar entre dos motivos que exigen orden, `order.setValue(null)` no vacía el texto del `app-autocomplete` (ver sección 6).

### 5.5 Alta de retorno (`StockVoucherReturnDialog`) — **sin probar**

> Se escribió en un hilo y aún no se ha pegado el código real de vuelta ni probado de punta a punta. Al ver el código real, corregir esta sección.

- Recibe el `VoucherDetail` de la salida en `DIALOG_DATA` (`StockVoucherReturnDialogData = { voucher }`). Quien lo abre es responsable de que ya esté cargado (lista: `GET /stock-vouchers/:id` + revalidación; detalle: el que ya tiene).
- Solo lista líneas con `pending > 0`. Si hay una sola, viene marcada. Solo se envían las líneas **marcadas**; las fotos de líneas no marcadas se descartan.
- Solo ofrece motivos `direction === 'IN'`; si hay uno solo, se preselecciona.
- **Por cantidad:** `quantity` entre 1 y `pending` (parte en `pending`). **Por serial** (se decide con `units.length > 0`): se marcan equipos con `returned: false` y `quantity = unitIds.length`.
- Se envía `originVoucherId` y, por línea, `originLineId`, `quantity` y `unitIds` (solo seriales). **No** se envía `lotId`, `employeeId` ni `orderId`.
- Cada línea seleccionada lleva sus propias fotos (`photos_<índice>` alineado con `lines`).
- Los errores del servidor (por ejemplo orden entregada) se muestran tal cual en el pie.
## 6. Pendientes del módulo

**Probar el retorno de punta a punta** (aún no se ha hecho):

- Salida sin usar → retorno total (el botón debe desaparecer en lista y detalle).
- Retorno parcial por cantidad y luego el resto.
- Retorno de seriales (solo equipos con `returned: false`).
- Orden ENTREGADA (8): no debe mostrar el botón; probar que el servidor también lo rechaza.
- Reintento con el mismo `clientRequestId` (`replayed: true` como éxito).
- Lista desactualizada: pulsar "Retornar" en un vale ya devuelto desde otra pestaña (debe avisar y recargar).

**Contrato del backend (confirmar):**

- Valores reales de `returnStatus` (hoy se asume `NONE | PARTIAL | FULL`; solo se confirmó `PARTIAL`).
- Lista completa de `returnBlock` (hoy solo `IS_RETURN`). Con ella, mostrar un `title` explicativo cuando no hay botón (orden entregada, sin pendientes, motivo no retornable...).
- Nulabilidad real de `orderStatus`, `customerName` y `createdBy.name` en el listado.
- Pedir `canReturn` y `returnBlock` también en `GET /stock-vouchers/:id` para no duplicar la regla del front.
- Pedir `productName` en las líneas del detalle (hoy solo `productSku`).
- Límites de fotos por línea (se asumió 5 por producto y 5 MB por imagen) y si un retorno puede llevar fotos en todas sus líneas.
- Prefijo real del gateway para `/stock-vouchers`, `/employees/basic` y `/inventory-orders/search`.
- Confirmar que el `employeeId` del filtro usa el mismo `id` que devuelve `GET /employees/basic`.

**Front, listado:**

- Filtro por orden (`orderId`) con `GET /inventory-orders/search` y `app-autocomplete` (`OrderSearchItem.id` es numérico). Por ahora el `search` ya cubre el número de orden.
- Convertir "Retorno de la salida #código" en botón que abra `openDetail(ov.id)`.
- Mostrar `createdBy` y `returnCount` si se necesitan.
- Filtro por estado de devolución o "solo retornables", si el backend lo soporta.
- Tipar `dateRangeControl` (hoy `FormControl<any>`).

**Front, alta de salida:**

- `order.setValue(null)` al cambiar de motivo no vacía el texto del `app-autocomplete` de orden: usar `clear()` o recrear el componente.
- Costo neto de una orden: `GET /stock-vouchers/orders/:orderId`, sin usar.
- Revisar imports sin uso (`StockVoucherNewDataResponse`, `Employee`, entre otros) en `stock-voucher-form-dialog.ts`.

## 7. Ejemplos propios de la feature

### 7.1 Detalle que se recarga y abre un modal de acción (`StockVoucherDetailDialog`)

```typescript
private readonly reloadTick = signal(0);
readonly notice = signal<string | null>(null);

// carga: id + tick, así el mismo id también recarga
toObservable(computed(() => ({ id: this.currentId(), t: this.reloadTick() })))
  .pipe(
    tap(() => { this.loading.set(true); this.error.set(null); }),
    switchMap(({ id }) =>
      this.api.getOne(id).pipe(
        catchError(err => {
          const msg = err?.error?.message;
          this.error.set(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'No se pudo cargar el movimiento.'));
          this.loading.set(false);
          return EMPTY;
        }),
      ),
    ),
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

### 7.2 Acción por fila que carga datos antes de abrir el modal (`StockVoucherList`)

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

En la plantilla, el botón "Retornar" se muestra con `@if (v.canReturn)`, se deshabilita con `[disabled]="!!returningId()"` y muestra el spinner solo si `returningId() === v.id`.

### 7.3 Etiquetas por estado (lista)

```typescript
const RETURN_STATUS_LABEL: Record<string, string> = {
  NONE: 'Sin devolver', PARTIAL: 'Devolución parcial', FULL: 'Devuelto', // NONE y FULL asumidos
};
returnStatusLabel(s: string | null) { return s ? (RETURN_STATUS_LABEL[s] ?? s) : ''; }
```

## 8. Datos de esta feature que NO están en el contexto

- **Código real de `stock-voucher-return-dialog`** (`.ts` y `.html`): se escribió en un hilo y no se ha pegado de vuelta. La sección 5.5 describe lo que se diseñó, no lo que está en el repositorio.
- **Código de `stock-vouchers.service.ts`:** los métodos de la sección 2 se asumen por cómo los usan los componentes.
- Cambios aplicados al `.ts` y `.html` de `StockVoucherDetailDialog` y `StockVoucherList` tras las partes 3A/3B y 2 de este hilo (botón "Retornar", `returningId`, `reloadTick`, `notice`): se propusieron, pero no se ha visto el archivo resultante.
- Los `.css` de los componentes (se asumen vacíos) y `stock-vouchers.routes.ts` actual (solo se conoce su nombre `STOCK_VOUCHERS_ROUTES`).
- Código de `date-range-picker`: no se sabe si garantiza `dateFrom <= dateTo` ni su estado vacío (ver `src/app/shared/AGENTS.md`).
- Catálogo de estados de orden (`statusId`): solo se conoce que 8 = ENTREGADA (no admite retornos) y que 8, 9 y 10 no admiten salidas (`canIssue: false`).
- Catálogos de `returnStatus` y `returnBlock` del listado (ver sección 6).
- Reglas del backend para fotos de vales: máximo por línea, tamaño y formatos.