# AGENTS.md (raíz) — inventario-ms

> **Archivo:** `/AGENTS.md` (raíz del proyecto)
> **Alcance:** lo que aplica a todo el proyecto: stack, estructura, convenciones, reglas generales y cómo agregar cosas.
> **Se edita cuando:** cambia algo transversal (stack, convención, regla general, HTTP/sesión) o se agrega/elimina una feature.
> **No va aquí:** contratos de endpoints y reglas propias de una feature (van en el `AGENTS.md` de esa feature) ni la API de componentes compartidos (va en `src/app/shared/AGENTS.md`).

## Mapa de archivos AGENTS

| Archivo | Ruta | Qué contiene | Pegarlo cuando |
|---|---|---|---|
| **Raíz** (este) | `/AGENTS.md` | Reglas generales del proyecto | Siempre |
| **Shared** | `src/app/shared/AGENTS.md` | API y trampas de `autocomplete`, `image-upload`, `date-range-picker`, `image-lightbox-dialog`, `camera-dialog`, `label-print-dialog` y `LabelsService` | Se usa o modifica un componente o servicio compartido |
| **Products** | `src/app/features/products/AGENTS.md` | Endpoints, reglas y pendientes de productos | Se toca productos |
| **Suppliers** | `src/app/features/suppliers/AGENTS.md` | Endpoints, reglas y pendientes de proveedores | Se toca proveedores |
| **Receipts** | `src/app/features/receipts/AGENTS.md` | Ingresos, pagos, etiquetas e importación por clave de acceso del SRI | Se toca ingresos, etiquetas o SRI |
| **Stock-vouchers** | `src/app/features/stock-vouchers/AGENTS.md` | Movimientos: salidas, retornos, listado y detalle | Se toca movimientos |

Si una tarea cruza features (por ejemplo, movimientos reutiliza `GET /receipts/products/search`), pegar el archivo de cada una.

## 0. Cómo mantener los archivos AGENTS (leer primero)

Estos archivos son la fuente de verdad del proyecto. Si en un hilo se pide actualizarlos o corregirlos, aplicar estas reglas:

1. **Solo se corrige lo verificado.** Se puede cambiar una línea únicamente si en este hilo se vio:
   - el código real (archivo pegado o leído), o
   - un contrato del backend entregado por el usuario.
   Lo que no se vio, no se toca ni se da por correcto o incorrecto.
2. **Lo no verificado se conserva tal cual.** No borrar, reescribir ni "mejorar" líneas sobre archivos que no se vieron. Ante la duda, dejar el texto original.
3. **No inventar.** Prohibido suponer nombres de archivos, métodos, endpoints, valores de enums, límites o versiones. Si hace falta un dato y no está, se pide el archivo o se anota como pendiente, marcado "(asumido)" o "(sin confirmar)".
4. **El código manda sobre el texto.** Si el código visto contradice el archivo, se corrige el archivo y se avisa de la diferencia. Si lo que contradice es una decisión del usuario, se pregunta antes.
5. **Pendientes:** se quita un pendiente solo si el código visto demuestra que ya está resuelto. Los nuevos se agregan sin duplicar.
6. **"Datos que NO están en el contexto":** al ver código que antes faltaba, se quita de esa lista; al tocar algo que no se pudo ver, se agrega.
7. **Archivos separados:**
   - Cada cambio propuesto debe decir **en qué archivo va** (nombre y ruta, como en la tabla de arriba).
   - Solo se actualiza el archivo cuyo código o contrato se vio. Un hilo de movimientos no edita el de ingresos.
   - Un cambio que afecta a varias features se anota en la **raíz**, y se avisa qué otros archivos habría que revisar sin editarlos si no se vieron.
   - Una regla general no se repite en los archivos de feature: vive solo en la raíz.
8. **Formato de entrega:**
   - Cambio pequeño: entregar solo los bloques modificados, con archivo y sección.
   - Archivo completo: solo si el usuario lo pide, y dividido en partes cortas.
   - Cerrar con dos líneas: "Verificado con: <archivos o contratos>" y "No verificado, sin cambios: <temas>". Este cierre va en cada entrega de código, porque avisa qué se asumió.
9. **La documentación se entrega bajo demanda.** Al terminar una tarea de código (pantalla, endpoint, convención o corrección) NO se proponen ni se entregan cambios a los AGENTS.md. El agente lleva en el hilo una lista interna de lo que quedó sin documentar. Cuando el usuario pida "actualiza agents" (o algo equivalente, por módulo o completo, por ejemplo "actualiza agents de labels"), entrega los bloques consolidados desde la última actualización, aplicando las reglas 1 a 8. Si el usuario pregunta "qué falta documentar", responde con esa lista.

## 1. Descripción

Frontend de un sistema de inventario multi-empresa y multi-sucursal. Es una SPA Angular (standalone) que consume un backend NestJS vía gateway (`/auth`, `/inventory-core`, `/suppliers`, `/receipts`, `/sri`, `/stock-vouchers`, `/labels`, `/employees`, `/inventory-orders`).

Estado general:

- Login con JWT, layout con sidebar colapsable (escritorio) y panel móvil, tema claro/oscuro, dashboard con datos de ejemplo.
- Features (el detalle está en el `AGENTS.md` de cada una):

| Feature | Estado | Archivo |
|---|---|---|
| Productos | Listado con filtros, creación con imágenes y detalle | `features/products/AGENTS.md` |
| Proveedores | Listado, alta, detalle con edición en línea y activar/desactivar | `features/suppliers/AGENTS.md` |
| Ingresos | Listado, alta (con líneas sin inventario, importación por clave del SRI e impresión de etiquetas), detalle, pagos y reimpresión de etiquetas | `features/receipts/AGENTS.md` |
| Movimientos (vales de stock) | Listado, salidas, retornos y detalle | `features/stock-vouchers/AGENTS.md` |
| Stock (existencias por producto/lote) | Aún no existe como pantalla | — |

- **Etiquetas:** no es una feature con ruta propia; son un servicio y un modal en `shared` (`LabelsService`, `LabelPrintDialog`) que hoy usa `receipts`. Detalle en `src/app/shared/AGENTS.md`.

## 2. Stack

| Área | Detalle |
|---|---|
| Framework | Angular `^22.0.0` (standalone, sin NgModules; zoneless: ver sección 4) |
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

## 3. Estructura general

```
AGENTS.md                  # raíz (este archivo)
.postcssrc.json            # OBLIGATORIO en la raíz (ver sección 7)
src/
├── index.html             # script anti-parpadeo del tema (clave: inventario-theme)
├── styles.css             # tokens de tema, clases reutilizables, scrollbars
├── environments/environment.ts   # apiUrl
└── app/
    ├── app.config.ts / app.routes.ts
    ├── core/              # models/, services/ (auth, theme), guards/, interceptors/ (auth)
    ├── layout/main-layout/        # sidebar + topbar + <router-outlet />
    ├── shared/
    │   ├── AGENTS.md              # API de los componentes compartidos
    │   ├── services/              # labels.service.ts
    │   ├── types/                 # label.types.ts (luego, paginación)
    │   └── components/            # theme-toggle, autocomplete, date-range-picker, image-upload, camera-dialog, image-lightbox-dialog, label-print-dialog
    └── features/
        ├── auth/login/
        ├── dashboard/
        ├── products/        # + AGENTS.md  (router propio, pages/, components/, services/, types/)
        ├── suppliers/       # + AGENTS.md
        ├── receipts/        # + AGENTS.md  (además utils/label-items.ts)
        └── stock-vouchers/  # + AGENTS.md
```

Cada feature es el equivalente standalone de un "módulo": su propia carpeta con `pages/`, `components/`, `services/`, `types/` y un `<feature>.routes.ts` que se carga con `loadChildren`. El árbol interno de cada feature está en su `AGENTS.md`.

### Dependencias entre features (se mantienen aquí porque afectan a más de un archivo)

- `receipts` importa `PaginationMeta`/`PaginatedResponse`, `SupplierDraft` y `SupplierNewDataResponse` desde `suppliers`.
- `stock-vouchers` importa `PaginationMeta` desde `suppliers` y `ProductOption`/`SearchProductsResponse` desde `receipts` (reutiliza `GET /receipts/products/search`).
- `products/types/product.types.ts` importa `ProductOption` desde `receipt.types.ts`. **`receipt.types.ts` no debe importar de `product.types.ts`** (crearía un ciclo).
- `receipts` importa `PrinterType` desde `shared/types/label.types.ts` y usa `LabelPrintDialog` y `LabelsService` de `shared`. **`shared` no importa nada de ninguna feature**: quien abre el modal arma los `items`.
- Ya son **tres** features que usan paginación: mover `PaginationMeta` y `PaginatedResponse` a `shared/types` (pendiente global, sección 9). La carpeta ya existe con `label.types.ts`.

## 4. Rendering, routing, HTTP y estado (general)

> Los endpoints y contratos de cada módulo viven en el `AGENTS.md` de su feature.

- **Rendering:** CSR. Proyecto creado con `--ssr=false`; `angular.json` no tiene SSR ni hidratación.
- **Detección de cambios:** zoneless. Los `FormControl` y `FormArray` **no** notifican a la vista: si un valor cambia en un callback asíncrono (por ejemplo, al cargar lotes), llamar a `ChangeDetectorRef.markForCheck()` o guardar el dato en un signal.
- **Routing:** todo con `loadComponent` / `loadChildren` (lazy). `/login` es pública. El layout (`path: ''`) lleva `canActivate: [authGuard]`; **todas las vistas del admin van en sus `children`** (`dashboard`, `productos`, `proveedores`, `ingresos`, `movimientos`). `**` redirige a `login`.
- **HTTP:** `provideHttpClient(withInterceptors([authInterceptor]))`. El interceptor solo añade `Authorization: Bearer <token>` (no toca `Content-Type`, así que los `FormData` funcionan) y llama a `logout()` ante un 401 (salvo si la URL contiene `/auth/login`). La empresa y el usuario salen del token: no se envían en las peticiones.
- **Base de cada servicio:** cada servicio define una constante `base` (`${environment.apiUrl}/<recurso>`). Si el gateway cambia un prefijo, se corrige en esa constante. Un endpoint fuera de la base del servicio usa `environment.apiUrl` directo.
- **Sesión:** `AuthService` guarda el token en un signal; va a `localStorage` con "remember" y a `sessionStorage` si no (clave `token`). `user()` es el payload decodificado del JWT.
- **Otras claves de storage:** `inventario-theme`, `inventario-sidebar-collapsed`.
- **Estado de pantalla:** signals. En listados, un signal `query` es la fuente de verdad: `toObservable(...).pipe(switchMap(...))` dispara cada carga y cancela la anterior. Para forzar recarga con los mismos filtros se usa un contador (`reloadTick`) combinado con `query`. Un detalle que necesita recargar el mismo registro usa el mismo patrón (id + `reloadTick`): reasignar un signal con el mismo valor no emite.
- **Mensajes de error del backend:** `message` puede ser un arreglo; se unen con `', '` y se muestran en un aviso dentro de la pantalla (no hay sistema de toasts).

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

- **Archivos sin sufijo `.component`:** `login.ts`, `login.html`, `login.css`. La clase tampoco: `Login`, `ProductList`, `SupplierFormDialog`, `ReceiptDetailDialog`, `StockVoucherReturnDialog`, `LabelPrintDialog`...
- Cada componente: 3 archivos separados (`.ts`, `.html`, `.css`) con `templateUrl` y `styleUrl`. Prefijo de selector `app-`. (`AccessKeyDialog` aún no tiene `styleUrl`; agregarlo si se quiere uniformar.)
- **DI:** `inject()` como campo de clase, no constructor. Datos de entrada de un diálogo: `inject<T | null>(DIALOG_DATA, { optional: true })`; si son obligatorios (detalles, retorno, etiquetas), `inject<T>(DIALOG_DATA)`.
- **Estado:** `signal`, `computed`, `effect`, `input()`, `output()`, `model()`. Campos `readonly` cuando no se reasignan.
- **Zoneless:** ver sección 4. Ejemplo: `loadLots` en `StockVoucherFormDialog` llama a `markForCheck()`.
- **Plantillas:** control flow nuevo (`@if`, `@for` con `track`, `@else`, `@empty`, `@switch`, `@let`). No `*ngIf` ni `*ngFor`. **No usar funciones flecha en plantillas**: mover la lógica a un método del `.ts`. Evitar lógica inline compleja (etiquetas y clases por estado van en métodos con un `Record`, como `directionLabel` o `returnStatusClass`).
- **Formularios:** reactivos con `nonNullable`. Textos obligatorios con `Validators.pattern(/\S/)` además de `required`. En diálogos con muchos campos (ingreso, vale, retorno) se valida a mano en un método `validate()` que devuelve el mensaje de error y se muestra en un aviso.
- **Modales:** `Dialog` de `@angular/cdk/dialog`. El modal se cierra con `dialogRef.close(resultado)` y quien lo abre lee `ref.closed`. Los modales de creación devuelven el recurso creado; los de detalle devuelven `true` si hubo cambios para que el listado se recargue; los que solo ejecutan una acción sin cambiar datos del negocio (etiquetas) no devuelven nada. Formularios largos (ingreso, pago, vale de salida, retorno) y el modal de etiquetas usan `disableClose: true`.
- **Listas flotantes:** el `app-autocomplete` usa una lista absoluta simple (detalles en `src/app/shared/AGENTS.md`). Si se necesita posicionamiento más robusto, usar `CdkConnectedOverlay`.
- **Estilos:** utilidades Tailwind v4 y los tokens/clases de `styles.css`:
  - Tokens: `bg-bg`, `bg-surface`, `bg-surface-hover`, `border-border`, `text-text`, `text-text-muted`, `text-text-subtle`, `bg-primary`, `bg-primary-soft`.
  - Clases: `surface-card`, `input-field`, `btn-primary`, `nav-item`, `nav-item-active`, `text-heading`, `text-body`.
  - Listados en filas-tarjeta: `row-card`, `row-col`, `col-label`, `col-valor`. (Los listados de ingresos y movimientos usan `<article>` con utilidades directas.)
  - Tema oscuro: clase `.dark` en `<html>`, gestionada por `ThemeService`.
  - Avisos: ámbar (`border-amber-300/60 bg-amber-500/10 text-amber-700 dark:text-amber-300`) para advertencias, rojo para errores, esmeralda para éxito. Son colores semánticos, no base.
  - `shadow-xs` se usa en varias vistas (por ejemplo, la paginación de movimientos); si no existe en el Tailwind del proyecto, cambiar a `shadow-sm`.
- **Patrón de listado (proveedores, ingresos, movimientos):** encabezado con total + botón "Nuevo", panel de búsqueda/filtros/orden (selects compactos + `app-date-range-picker` para fechas), tarjetas, paginación con selector de filas, botón "Ver detalle". Búsqueda con debounce de 300 ms. Ingresos usa dos vistas (`md:hidden` / `hidden md:block`); movimientos usa una sola fila-tarjeta con `flex-wrap`.
- **Acción por fila que necesita cargar datos antes de abrir un modal:** un signal `returningId` (o equivalente) guarda el id en curso. Bloquea el doble clic (`if (this.returningId()) return`), deshabilita los demás botones de la misma acción y muestra el spinner solo en la fila pulsada. Se limpia en `next` y en `error`. Tras cargar, se **revalida** con el detalle (la lista puede ir por detrás) antes de abrir el modal. Ejemplos reales: "Retornar" en `features/stock-vouchers` y "Dymo/Zebra" en `features/receipts` (clave compuesta `printingKey` = `"id:impresora"`); ver su `AGENTS.md`.
- **Rango de fechas:** `dateRangeControl = new FormControl<any>(null)` enlazado a `<app-date-range-picker [formControl]="dateRangeControl">`. Su `valueChanges` entrega `{ dateFrom, dateTo }` (o `null`) y se traduce al `query`. Al limpiar filtros: `setValue(null, { emitEvent: false })` y vaciar las fechas del `query`.
- **Patrón de detalle con edición en línea (productos, proveedores):** cabecera con degradado, secciones etiqueta | valor, lápiz **siempre visible**, edición de un campo a la vez con doble confirmación (Guardar → ¿Confirmar? → Sí) y envío solo del campo que cambió.
- **Patrón de detalle de solo lectura (ingresos, movimientos):** ingresos usa pestañas; movimientos es de una sola página. El detalle de cada uno está en el `AGENTS.md` de su feature.
- **Avisos de éxito:** son temporales (`flash`, 3 a 5 s) y se muestran dentro de la pantalla o del modal que los origina.
- **Avisos con acción** (por ejemplo, "Reintentar" etiquetas fallidas tras crear un ingreso): un signal propio con los datos del reintento y un aviso ámbar con botones "Reintentar" y "Descartar"; no desaparece solo. Ejemplo real: `printRetry` en `features/receipts`.
- Los tests están desactivados al generar (`skipTests: true`).
- La documentación se actualiza bajo demanda (ver regla 9 de la sección 0).

> **Movido a `features/stock-vouchers/AGENTS.md`** (se escribirá allí, no repetir en la raíz): la navegación interna del detalle con `currentId` + `reloadTick`, el pie del detalle con "Registrar retorno" y el aviso `notice` de 5 s.

## 7. Reglas generales / NO hacer

> Las reglas propias de una feature están en su `AGENTS.md`. Aquí solo van las que aplican a todo el proyecto.

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
- **No** guardar `imageUrl`/`proofUrl`/`url` de archivos: son URLs firmadas que caducan; usar siempre la de la última respuesta (recargar el detalle las renueva). Antes de usar una URL firmada, verificar que empiece por `http` (si la firma falla, el backend puede devolver la key cruda de S3): si no, mostrar un recuadro "Sin vista". La vigencia de cada tipo de archivo está en el `AGENTS.md` de su feature (fotos de vales: 30 min).
- **Multipart (reglas comunes):** los campos de texto/JSON se anexan **antes** que los archivos. No fijar `Content-Type` a mano (el navegador agrega el boundary). Los índices de archivos (`photos_<n>`, `proof_<n>`) son **base 0** y siguen el orden del arreglo en el JSON; las líneas y sus archivos se arman en un solo recorrido para que siempre coincidan. Los nombres exactos por módulo están en cada feature.
- **Índices de línea en el JSON (`lineIndex`):** cuando un contrato referencia líneas por posición (por ejemplo, `labels.items[].lineIndex` en ingresos), es el índice **base 0** en el arreglo `lines` del mismo JSON, igual que `photos_<n>`. Se toma del índice real en el formulario, nunca de un contador aparte.
- **Idempotencia (`clientRequestId`):** en ingresos, pagos y vales (salida y retorno) se genera con `crypto.randomUUID()` **una vez al abrir el diálogo** y se reutiliza en todo reintento. Solo se genera uno nuevo al abrir otro diálogo. Deshabilitar el botón mientras la petición está en curso (`saving()`). En pagos y vales, `replayed: true` se trata como éxito.
- **Impresión de etiquetas (`POST /labels/print`):** **no** usa `clientRequestId` (imprimir no cambia el estado del negocio). Cada llamada imprime, por eso el botón se deshabilita mientras `printing()` está activo y no se permite cerrar el modal durante la petición. Una respuesta HTTP 200 puede traer `ok: false`: se leen siempre los `items[]` para saber cuáles fallaron y reintentar solo esos. Límites del DTO: `cant` entero de 1 a 999, máximo 50 ítems por solicitud, impresora `DYMO` o `ZEBRA`. Al crear un ingreso con `labels`, un fallo de impresión **no deshace el ingreso** y `replayed: true` nunca imprime. El servicio y el modal viven en `shared`; quien los usa arma los `items`. Detalle en `src/app/shared/AGENTS.md`, sección 7.
- **Montos:** llegan como `string` (2 decimales en ingresos/pagos; `unitCost` de vales con 4). **Solo se muestran; no se hacen cálculos con ellos.** Excepciones, solo informativas, en `receipts` (totales en vivo del alta y comparación "Según factura"). Las cantidades enteras de vales también se muestran tal cual.
- **Fechas `AAAA-MM-DD`** (`issueDate`, `paidAt`, `from`/`to` de vales): formatear cortando el string; **no** pasar por `Date`/`DatePipe` (evita desfases de zona horaria). Fechas con hora (`createdAt`, `authorizationDate`) sí usan `DatePipe`. La zona fija de Ecuador es `'-0500'` (sin horario de verano); los formatos por módulo están en cada feature.
- **Gateway: DTOs con whitelist.** El `ValidationPipe` rechaza cualquier propiedad que no esté decorada (`property X should not exist`). Cada vez que un contrato agregue campos al request, hay que agregarlos también al DTO del gateway (`ReceiptLineGatewayDto`, `CreateReceiptGatewayDto`, `ReceiptLabelsGatewayDto`, `ReceiptLabelItemGatewayDto`, `PrintLabelsDto`, `StockVoucherLineGatewayDto`, `CreateStockVoucherGatewayDto`...).
- **No** dejar `console.log` (los stubs sin implementar deben reemplazarse). Excepción intencional: el visor de imágenes usa un `console.warn` en el respaldo de descarga.
- Si un componente usa `*ngTemplateOutlet`, importar `NgTemplateOutlet`. Si usa el pipe `number`, importar `DecimalPipe`. Si usa `date`, importar `DatePipe`.
- Los SVG llevan tamaño explícito (`h-5 w-5`).
- El JWT está en storage del navegador (riesgo XSS aceptado por ahora).

## 8. Cómo agregar cosas (ejemplos generales)

> Ejemplos de buscador, subida de archivos, visor y modal de etiquetas: `src/app/shared/AGENTS.md`. Ejemplos de detalle con acción y acción por fila: `features/stock-vouchers/AGENTS.md`; acción por fila que abre el modal de etiquetas: `features/receipts/AGENTS.md`, sección 5.8.

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

Iconos ya definidos en `ICONS`: `dashboard`, `products`, `suppliers`, `receipts` (bandeja con flecha hacia abajo), `movements` (flechas de intercambio), `logout`, `menu`, `close`. El menú actual: Dashboard, Productos, Proveedores, Ingresos y Movimientos (`{ label: 'Movimientos', path: '/movimientos', icon: ICONS.movements }`).

**Al crear una feature nueva:** crear también su `AGENTS.md` dentro de la carpeta de la feature, con el encabezado estándar (archivo, alcance, se edita cuando), y agregarla al mapa de archivos y a la tabla de la sección 1 de este archivo (cuando el usuario pida actualizar los AGENTS; ver regla 9).

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
// quien abre el modal (ejemplo real: retorno de un vale)
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

### Modal de acción que no devuelve nada (ejemplo: etiquetas)

```typescript
// quien abre el modal: arma los items y no espera resultado
this.dialog.open<void, LabelPrintDialogData>(LabelPrintDialog, {
  data: { items, printer } satisfies LabelPrintDialogData,
  width: '36rem', maxWidth: '95vw', autoFocus: 'first-tabbable', disableClose: true,
});

// dentro del modal: close() { if (this.printing()) return; this.dialogRef.close(); }
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

### Campo de formulario con estilos del proyecto

```html
<label for="nombre" class="mb-1.5 block text-sm font-medium text-heading">Nombre</label>
<input id="nombre" formControlName="nombre" class="input-field" />
<button type="submit" class="btn-primary">Guardar</button>
```

## 9. Pendientes globales

> Los pendientes de cada módulo están en el `AGENTS.md` de su feature. Aquí solo van los transversales.

- **Auditoría (backend):** registrar quién crea, edita y elimina. Recomendado: clase base con `createdAt/By`, `updatedAt/By`, `deletedAt/By` y una tabla `audit_logs` solo de inserción. Falta decidir ORM y si se guarda solo el id del usuario o también una copia del nombre.
- **Refactor:** mover `PaginationMeta` y `PaginatedResponse` a `shared/types` (los usan suppliers, receipts y stock-vouchers; la carpeta ya existe con `label.types.ts`). Al hacerlo, revisar los imports de los tres archivos de tipos y actualizar los `AGENTS.md` afectados.
- **Migrar** las plantillas que aún usan `bg-gradient-to-br` a `bg-linear-to-br`.
- **Tipar `dateRangeControl`** (hoy `FormControl<any>` en ingresos y movimientos) como `{ dateFrom: string; dateTo: string } | null`.
- **Prefijos del gateway:** confirmar los prefijos reales de `/receipts`, `/stock-vouchers`, `/labels`, `/employees/basic` y `/inventory-orders/search` (se cambian en la constante `base` de cada servicio).
- **Tests:** desactivados al generar (`skipTests: true`); decidir si se activan para servicios y lógica de formularios.
- **Lint y formato:** no hay script de lint; falta definir ESLint y fijar la configuración de Prettier.

## 10. Datos generales que NO están en el contexto

- Script o configuración de **lint** (ESLint) y configuración de Prettier.
- Versión instalada de `@angular/cdk` y contenido exacto de `app.config.ts`, `app.ts` y los `tsconfig*.json`.
- Código de `auth.service.ts`, `auth.guard.ts` y `theme-toggle`.
- Ruta real de `theme-toggle`: se importa desde `shared/components/theme-toggle/theme-toggle/theme-toggle` en el layout; unificar con el login.
- `fileReplacements` por entorno: `angular.json` no los define, hay un solo `environment.ts`.
- Contenido de `products.routes.ts` / `suppliers.routes.ts` (el de `stock-vouchers.routes.ts` y `app.routes.ts` sí se vio).
- Prefijo real de `/labels` en el gateway (hoy se asume `${apiUrl}/labels`).