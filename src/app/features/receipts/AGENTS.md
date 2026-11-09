# AGENTS.md (receipts) — Ingresos, pagos e importación por clave de acceso del SRI

> **Archivo:** `src/app/features/receipts/AGENTS.md`
> **Alcance:** ingresos de mercadería: listado, alta (con líneas sin inventario e importación por clave de acceso del SRI), detalle y registro de pagos. Sus endpoints, contratos, reglas y pendientes.
> **Se edita cuando:** cambia algo dentro de `features/receipts/` o un contrato de `/receipts` o `/sri`.
> **Reglas generales** (multipart, idempotencia, montos, fechas, zoneless, estilos): ver `/AGENTS.md`. No se repiten aquí.
> **Componentes compartidos usados** (`app-autocomplete`, `app-image-upload`, `app-date-range-picker`, visor): ver `src/app/shared/AGENTS.md`.
> **Depende de:** `suppliers` (`PaginationMeta`/`PaginatedResponse`, `SupplierDraft`, `SupplierNewDataResponse`, `SupplierFormDialog`).
> **Lo usan otras features:** `products` importa `ProductOption` desde `receipt.types.ts` (**`receipt.types.ts` no debe importar de `product.types.ts`**: crearía un ciclo); `stock-vouchers` reutiliza `GET /receipts/products/search` y los tipos `ProductOption` y `SearchProductsResponse`.

## 1. Descripción y estado

Un ingreso registra la compra de mercadería a un proveedor: documento (factura u otro), líneas con producto, cantidad, costo y precio de venta, seriales/IMEI, fotos y pagos.

Hecho:

- **Listado** con filtros, orden y paginación.
- **Alta** (`ReceiptFormDialog`): proveedor y productos con buscador, seriales/IMEI (de 1 a 4 por equipo), documento y fotos adjuntas, **líneas sin inventario** y **importación por clave de acceso del SRI**.
- **Detalle** (`ReceiptDetailDialog`): pestañas Resumen, Productos, Pagos e Historial.
- **Pagos:** registro de pagos con comprobante (`PaymentStatusDialog`).
- **Importación por clave de acceso** (`AccessKeyDialog`): consulta la factura al SRI, muestra el detalle y devuelve un `AccessKeyPreview` que precarga el formulario.

Pendiente: ver sección 6.

## 2. Estructura

```
features/receipts/
├── AGENTS.md                      # este archivo
├── receipts.routes.ts             # RECEIPTS_ROUTES
├── pages/
│   └── receipt-list/              # ReceiptList
├── components/
│   ├── receipt-form-dialog/       # ReceiptFormDialog: alta de ingreso
│   ├── receipt-detail-dialog/     # ReceiptDetailDialog: detalle por pestañas
│   ├── payment-status-dialog/     # exporta PaymentStatusDialog y PaymentDialogData
│   └── access-key-dialog/         # AccessKeyDialog: consulta de factura por clave (aún sin styleUrl)
├── services/
│   └── receipts.service.ts        # ReceiptsService (base = `${apiUrl}/receipts`)
└── types/
    └── receipt.types.ts
```

Notas de tipos:

- `receipt.types.ts` es importado por `products` (`ProductOption`) y por `stock-vouchers` (`ProductOption`, `SearchProductsResponse`). Cambiar esos tipos obliga a revisar esos dos archivos.
- Se importan `DocumentTypeOption`, `Receipt` y `SupplierOption` sin usar en algunos archivos (ver pendientes).

## 3. Endpoints

Base: `ReceiptsService.base` = `${environment.apiUrl}/receipts`. Si el módulo de ingresos cuelga de `inventory-core`, las rutas pasan a `/inventory-core/receipts...`: se cambia en una sola constante (`base`).

| Uso | Endpoint |
|---|---|
| Datos del formulario | `GET /receipts/new-data` → `{ documentTypes, paymentMethods, defaults?, enums? }` |
| Buscar productos | `GET /receipts/products/search?search=&limit=` → `{ items }` (cada item trae `defaults`, `lastReceipt` y, si aplica, `supplierCodes`) |
| Buscar proveedores | `GET /receipts/suppliers/search?q=&limit=` → arreglo de `SupplierSearchItem` |
| Crear ingreso | `POST /receipts` (**multipart**: `data` con JSON, `document` opcional, `photos_<índice>` y `proof_<índice>` opcionales) |
| Listar | `GET /receipts` (`page`, `limit`, `search`, `dateFrom`, `dateTo`, `status`, `paymentStatus`, `documentTypeId`, `productId`, `sortBy`, `sortDir`, `includeFilters`) → `{ items, meta, filters? }` |
| Detalle | `GET /receipts/:id` |
| Registrar pago | `POST /receipts/:id/payments` (**multipart**: `data` con JSON, `proof` opcional) |

**SRI** (no cuelga de `/receipts`: se usa `environment.apiUrl` directo):

| Uso | Endpoint |
|---|---|
| Consultar factura por clave de acceso | `POST /sri/access-key/preview` con `{ accessKey }` (49 dígitos; acepta espacios o guiones) |

**Endpoints eliminados por el backend (no usar):** `PATCH /receipts/:id/payment-status` y `GET /receipts/:id/payment-history`. El estado de pago lo calcula el sistema a partir de los pagos.

**Existe pero no está implementado en el front (decisión del equipo):** `PATCH /receipts/:id/payments/:paymentId/void` (`{ reason }`, de 3 a 500 caracteres).

**Documentado a medias:** `GET /receipts/:id/payments` (el contrato dice que ahí vienen las etiquetas de `paymentMethods`); endpoint aún no documentado.

Multipart de ingresos y pagos (nombres exactos; las reglas comunes están en `/AGENTS.md`):

- **Ingreso:** JSON en `data`; archivos **`document`**, **`photos_<índice de línea>`** y **`proof_<índice de pago>`**, donde el índice es **base 0** y sigue el orden de `lines` / `payments` en el JSON. Las líneas sin inventario mandan `[]` de fotos (no rompe el índice).
- **Pago:** JSON en `data`; comprobante en **`proof`** (un solo archivo, imagen o PDF).
## 4. Contratos

### 4.1 Consulta por clave de acceso: `POST /sri/access-key/preview`

Respuesta 200 (`AccessKeyPreview`):

- `canImport`: `false` si ya hay un ingreso con esa clave. Entonces `existingReceipt` trae `id`, `code`, `status`, `issueDate`, **no se consulta al SRI** y `sri.available` es `false`.
- `key`: `accessKey`, `issueDate`, `documentType` (ej. `FACTURA`), `documentNumber`, `issuerRuc`, `environment`. Salen de la factura si el SRI respondió; si no, de la clave.
- `supplier`: si el RUC ya existe, trae la misma forma que `GET suppliers/search` (`SupplierSearchItem`). Si es `null`, el RUC no está registrado.
- `supplierDraft` y `supplierForm`: solo cuando `supplier` es `null`.
  - `supplierDraft.source` es `SRI` o `ACCESS_KEY` (si el SRI no respondió, `businessName` y `address` vienen `null`).
  - `supplierForm` trae `identificationTypes` y `countries` para evitar otra llamada.
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
- Un `preview` repetido con la misma clave vuelve a consultar al SRI (el backend sugirió cachear unos minutos si molesta).

### 4.2 Crear ingreso: `POST /receipts` (campo `data`)

- `accessKey` (opcional): el ingreso queda como importado; el servidor consulta al SRI y guarda el XML. Si el SRI no responde, se guarda igual sin XML. No sobrescribe lo que mande el formulario.
- **Línea con inventario** (por defecto, `affectsInventory` omitido o `true`): `productId`, `quantity`, `unitCost`, `salePrice`, `warrantyDays`, opcionales (`discount`, `purchaseTaxCode`, `purchaseTaxRate`, banderas, `units`).
- **Línea sin inventario:** `affectsInventory: false` y `description` obligatoria. **No** lleva `productId`, `salePrice`, `warrantyDays` ni `units`. Sí `quantity`, `unitCost`, `discount` e impuesto; suma a totales y al tope de pagos.
- `supplierCode` (cualquier línea), `supplierDescription` y `supplierQuantity` (cantidad del XML en unidades del proveedor): el backend aprende `código → producto` (o `código → no inventario`). Si el usuario cambia la cantidad, el factor se actualiza solo.
- Un mismo `supplierCode` con destinos distintos dentro del mismo ingreso es 400. Dos líneas con el mismo código y el mismo destino son válidas.
- Errores nuevos: `400` (línea sin inventario con `productId`/`units` o sin `description`, clave inválida), `409` ("Esa clave de acceso ya fue importada en otro ingreso").
- El backend **no** valida que el RUC de la clave coincida con el proveedor elegido (decisión de flexibilidad).
- Gateway: los campos nuevos deben estar en `ReceiptLineGatewayDto` y `CreateReceiptGatewayDto` (whitelist). Ya pasó con `supplierCode`, `supplierDescription` y `supplierQuantity` (esta última admite hasta 4 decimales).

### 4.3 Detalle: `GET /receipts/:id` (cambios)

- Cada línea trae `affectsInventory` y `description`. En líneas sin inventario, `product`, `lot` y `lotConfig` son `null` y `units` está vacío.
- El detalle trae `source` (`MANUAL` | `ACCESS_KEY`), `accessKey`, `authorizationNumber`, `authorizationDate` (ISO con zona) y `hasSourceXml`.
- Anular un ingreso genera `RECEIPT_VOID` solo para líneas con lote.
- En ingresos el backend devuelve solo ids de usuario (`createdById`, `userId`...) y el front muestra el id; no hay nombres (a diferencia de los vales).

### 4.4 Listado: `GET /receipts`

- `includeFilters=true` solo hasta recibir `filters` una vez; no enviarlo después.
- **No existe filtro `supplierId`** (el backend responde 400): el proveedor se busca escribiendo su nombre o RUC en `search`.
- El filtro `productId` está soportado por el backend pero no incluido en el listado del front (el buscador general ya encuentra por producto).
- Los tipos de documento con `active: false` van al final con la marca "(inactivo)".
- Ajustar el rango de fechas para que `dateFrom <= dateTo`.

### 4.5 Registrar pago: `POST /receipts/:id/payments`

- JSON en `data`, comprobante en `proof` (imagen o PDF).
- El backend responde 409 con el pendiente si el monto supera el saldo; el front no lo valida y muestra ese mensaje.
## 5. Reglas de la feature

> Reglas generales (multipart, idempotencia, montos, fechas, zoneless): `/AGENTS.md`, secciones 4 y 7.

### 5.1 Montos y totales

- Los montos de ingresos y pagos llegan como `string` con 2 decimales. **Solo se muestran; no se hacen cálculos con ellos.**
- Únicas cuentas del front, solo informativas:
  - Totales en vivo del formulario de alta (estimado visual).
  - Comparación "Según factura" contra `documentTotals.total` (tolerancia ±0.01).
- Cuadre de totales: el IVA se calcula por línea (`subtotal × tasa / 100`); el SRI puede redondear distinto y dar diferencias de centavos.
- Fechas `AAAA-MM-DD` (`issueDate`, `paidAt`): cortar el string, no usar `Date`/`DatePipe`. `authorizationDate` (ISO con zona) sí usa `DatePipe`.

### 5.2 Registrar pago

- El botón se deshabilita si el ingreso está `VOIDED` o `PAID`, o si `payment.canRegisterPayment` es `false` en el detalle.
- No se valida en el front que el monto no supere el saldo: el backend responde 409 con el pendiente y se muestra ese mensaje.
- `clientRequestId` se genera una vez al abrir el diálogo; `replayed: true` es éxito.
- Anular un pago **no está implementado** por decisión del equipo (ver sección 3).
- **Métodos de pago:** `PaymentStatusDialog` y `ReceiptDetailDialog` usan una lista fija (`CASH`, `TRANSFER`, `CHECK`, `CARD`, `OTHER`). El contrato dice que las etiquetas vienen en `paymentMethods` de `GET /receipts/:id/payments`, endpoint aún no documentado. (`GET /receipts/new-data` ya devuelve `paymentMethods` para el formulario de alta.)

### 5.3 Alta de ingreso: productos y datos precargados

- **Productos repetidos:** al elegir un producto ya agregado no se duplica la línea: suma 1 unidad, o agrega un equipo si es `SERIAL`.
- **Productos `SERIAL`:** la cantidad es siempre el número de equipos. Cada equipo admite de 1 a 4 IMEI/seriales y no puede haber seriales repetidos en el mismo ingreso.
- **Datos precargados:** al elegir un producto se carga el último ingreso (`lastReceipt`) si existe; si no, los `defaults` del producto.
  - El costo precargado es `documentUnitCost` (costo tal como viene en el documento), no `unitCost`.
  - El descuento no se precarga.
- Un solo camino para todos los orígenes: buscador, producto creado y `match.product` de la factura pasan por `applyProduct`.
- `purchaseTaxCode` no tiene campo visible: se carga desde el último ingreso del producto o desde la factura (`tax.code`) y se envía. Falta conocer su catálogo para ofrecer un selector.
- Límites de archivos asumidos: 5 fotos por producto, 5 MB por imagen y 10 MB para documento y comprobante (sin confirmar con el backend).

### 5.4 Líneas sin inventario

- `affectsInventory = false` oculta precio de venta, garantía, fotos, opciones de venta y seriales; exige `description`.
- `quantity` debe ser entero 1–100000 también aquí.
- Se crean con "+ Línea sin inventario", con `markNonInventory` (desde una línea `UNMAPPED`) o desde una línea `NON_INVENTORY` de la factura.
- `assignProduct` las convierte de nuevo en líneas con inventario (así el backend corrige el mapeo).
- Mandan `[]` de fotos en el multipart para no romper los índices.

### 5.5 Importación por clave de acceso

- Botón en la cabecera de `ReceiptFormDialog` → abre `AccessKeyDialog` (consulta, muestra detalle y devuelve `AccessKeyPreview` al aceptar). El formulario guarda el resultado en `accessKeyData` y llama a `applyAccessKey`.
- **Aceptar** solo se habilita si `canImport` es `true` y hay proveedor. Si ya existe un ingreso con esa clave, se muestra el previo.
- **Proveedor no registrado:** se abre `SupplierFormDialog` con `data: { draft: supplierDraft, formData: supplierForm }` (todos los campos editables; sin `formData` cae a `getNewData()`). Al crearlo se **repite el `preview`** para traer mapeos y sugerencias; si falla, se usa un respaldo con las líneas `UNMAPPED`.
- `applyAccessKey` precarga proveedor, `issueDate`, `documentNumber` y `documentTypeId`:
  - Busca en `options().documentTypes` por `code` o `name` en mayúsculas contra `key.documentType`; si no hay coincidencia, avisa y deja elegir.
  - Si ya hay líneas, pide confirmar el reemplazo con `confirm()` del navegador (pendiente reemplazar por diálogo propio).
- Cada línea importada guarda su `AccessKeyLine` en el control `source`. De ahí salen `supplierCode`, `supplierDescription` y `supplierQuantity` al guardar (solo en líneas con inventario, salvo `supplierCode`, que va en todas).
- `applyInvoiceValues`: la factura (y `suggestion` si existe) **ganan** sobre el último ingreso: `unitCost`, descuento, impuesto (`tax.code` → `purchaseTaxCode`, `tax.rate` → `purchaseTaxRate`) y cantidad.
  - `suggestion.quantity: null` → cantidad vacía para que el usuario la escriba.
  - Productos `SERIAL`: un equipo vacío por unidad (el XML no trae IMEI).
- **Validación:** un mismo `supplierCode` no puede apuntar a destinos distintos dentro del ingreso.
- Se manda `accessKey` en `data`. El backend responde 409 si ya fue importada; se muestra con `message()`.
- **Estado del SRI en el diálogo:** `AUTHORIZED` (verde), `NOT_AUTHORIZED` (rojo) y `NOT_FOUND` (ámbar) son solo avisos; `available: false` muestra `sri.message` y permite seguir manual.
- `reasonLabel` está duplicado en `ReceiptFormDialog` y `AccessKeyDialog` (pendiente moverlo a un archivo compartido).

### 5.6 Tipos y nulabilidad

- **Tipos de proveedor:**
  - `SupplierOption` es el mínimo del formulario (`id, code, businessName, tradeName, identificationType, identificationNumber`).
  - `SupplierSearchItem` lo extiende con `status` y `label`.
  - El `supplier` del preview es `SupplierSearchItem`.
  - `Supplier.status` es booleano (no existe `active`).
  - `AccessKeySupplier` está obsoleto desde que `supplier` usa `SupplierSearchItem`, pero sigue declarado en `receipt.types.ts` (pendiente borrarlo).
- **Detalle de ingreso, nulabilidad:** `ReceiptDetailLine.product`, `lot` y `lotConfig` son nulables (líneas sin inventario). En plantillas usar alias: `@if (l.product; as p)` y `@if (l.affectsInventory && l.lotConfig; as cfg)`.
- **Estados de equipo y acciones del historial:** solo se conocen `AVAILABLE`/`SOLD` y `CREATED`/`UPDATED`. `RESERVED`, `VERIFIED` y `VOIDED` son suposiciones; los valores desconocidos se muestran crudos. Falta la lista real y las etiquetas de `FIELD_LABELS`.

### 5.7 Presentación del detalle y del listado

- **Detalle de solo lectura con pestañas:** `Resumen`, `Productos`, `Pagos`, `Historial`.
  - Lista de pagos compacta con miniatura de 40 px que abre el visor de imágenes.
  - El bloque de clave de acceso va en "Documento".
- **Listado:** dos vistas (`md:hidden` / `hidden md:block`). Las filas son `<article>` con utilidades directas.
- `ReceiptList.setDate()` ya no se usa desde la plantilla (el rango lo maneja `DateRangePicker`); eliminarlo o asegurar el orden `dateFrom <= dateTo` en el picker.
- `dateRangeControl` está tipado como `any` (pendiente tiparlo).
- Verificar ingreso (`status: VERIFIED`) y anular ingreso: no hay acción en el front todavía.
## 6. Pendientes del módulo

**Importación por clave de acceso:**

- Decidir con el negocio si una factura `NOT_AUTHORIZED` o `NOT_FOUND` debe **bloquear** el Aceptar (hoy solo avisa).
- Decidir si también se bloquea un proveedor inactivo (`status: false`; hoy solo avisa).
- Avisar (no bloqueante) cuando `key.issuerRuc` ≠ `supplier.identificationNumber` al aplicar la clave.
- `app-autocomplete` no acepta término inicial: en líneas `UNMAPPED` la descripción de la factura se muestra encima pero no se precarga en el buscador. Pendiente un input `[initialTerm]` (ver `src/app/shared/AGENTS.md`).
- Reemplazar el `confirm()` del navegador (reemplazo de líneas) por un diálogo propio.
- Mover `reasonLabel` (duplicado en `ReceiptFormDialog` y `AccessKeyDialog`) a un archivo compartido.
- Facturas con muchos equipos serializados generan una fila de IMEI por unidad (sin límite).
- Botón "Ver XML": cuando el backend exponga el `getPresignedUrl` del XML (`hasSourceXml`). El comparador de auditoría línea a línea es un paso posterior de backend.
- Si el diálogo de consulta se cierra en pleno request, la suscripción sigue viva; considerar `takeUntilDestroyed()`.
- Confirmar límites de longitud de `supplierCode` (100), `supplierDescription` (300) y `supplierQuantity` en el gateway contra las columnas del microservicio.
- Cachear el `preview` repetido unos minutos si molesta (sugerencia del backend).

**Detalle y listado:**

- Mostrar la insignia de origen (`Clave de acceso`) y de líneas sin inventario.
- Nombres de usuario: el backend devuelve solo ids (`createdById`, `userId`...) y se muestra el id. Pedir nombres, como ya vienen en los vales.
- Filtro por `productId` en el listado: soportado por el backend, no incluido en el front.
- Limpieza del listado: eliminar `ReceiptList.setDate()` o asegurar el orden `dateFrom <= dateTo` en el picker; tipar `dateRangeControl` (`{ dateFrom: string; dateTo: string } | null`); quitar imports sin uso (`DocumentTypeOption`, `Receipt`, `SupplierOption` en algunos archivos).
- Borrar el tipo obsoleto `AccessKeySupplier` de `receipt.types.ts`.

**Acciones sin implementar:**

- Verificar ingreso (`status: VERIFIED`) y anular ingreso: no hay acción en el front.
- Anular pago: existe el endpoint, **no** se implementa por decisión del equipo.

**Contratos por confirmar con el backend:**

- Etiquetas de métodos de pago desde `GET /receipts/:id/payments` (endpoint aún no documentado); hoy hay una lista fija.
- Catálogo de `purchaseTaxCode` para ofrecer un selector.
- Lista real de estados de equipo y acciones del historial (`RESERVED`, `VERIFIED` y `VOIDED` son suposiciones) y etiquetas de `FIELD_LABELS`.
- Límites de archivos: se asumió 5 fotos por producto, 5 MB por imagen y 10 MB para documento y comprobante.
- Prefijo real del gateway para `/receipts` (con `/receipts/products/search`, `/receipts/suppliers/search` y `/receipts/new-data`) y `/sri/access-key/preview`.
- Valor real de `documentTypes.code` para `FACTURA` (el mapeo hoy es tolerante por `code` o `name`).

## 7. Datos de esta feature que NO están en el contexto

- **Código de todos los componentes de `receipts`:** este archivo se basa en el `AGENTS.md` original. En el hilo donde se separó el archivo no se vio código de ingresos, así que nada de lo anterior se corrigió contra el repositorio. Al ver código real, aplicar la regla 4 de la raíz (el código manda sobre el texto).
- Código de `receipts.service.ts` y de `receipts.routes.ts`.
- Código de `date-range-picker`: si garantiza `dateFrom <= dateTo` y su estado vacío (ver `src/app/shared/AGENTS.md`).
- Código de `Country` (entidad) y catálogo de `documentTypes.code`.
- Reglas del backend para los límites de archivos de ingresos y pagos.
- Rutas reales del gateway de ingresos (ver sección 6).