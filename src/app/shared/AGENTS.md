# AGENTS.md (shared) — Componentes y servicios compartidos

> **Archivo:** `src/app/shared/AGENTS.md`
> **Alcance:** API, uso y trampas de lo que vive en `src/app/shared/`: componentes (`autocomplete`, `image-upload`, `date-range-picker`, `image-lightbox-dialog`, `camera-dialog`, `theme-toggle`, `label-print-dialog`), el servicio `LabelsService` y los tipos de `shared/types`.
> **Se edita cuando:** cambia el código de algo en `shared/`, o se agrega algo nuevo.
> **Reglas generales** (estilos, plantillas, zoneless, URLs firmadas, impresión): ver `/AGENTS.md`. Qué hace cada feature con ellos: ver el `AGENTS.md` de la feature.
> **`shared` no importa nada de ninguna feature.** Quien usa un componente compartido le pasa los datos ya armados.

## 1. Mapa

```
src/app/shared/
├── AGENTS.md                      # este archivo
├── services/
│   └── labels.service.ts          # LabelsService (POST /labels/print)
├── types/
│   └── label.types.ts             # PrinterType, PRINTERS, PrintLabelsRequest/Response, PrintLabelItemResult
└── components/
    ├── theme-toggle/              # botón de tema claro/oscuro
    ├── autocomplete/              # buscador genérico (searchFn), con "crear nuevo" y modo clearOnSelect
    ├── date-range-picker/         # selector de rango; ControlValueAccessor con { dateFrom, dateTo }
    ├── image-upload/              # arrastrar y soltar + selector + cámara; acepta imágenes y PDF
    ├── camera-dialog/             # modal de cámara; devuelve un File JPEG
    ├── image-lightbox-dialog/     # visor con zoom, pan, pellizco, doble toque, swipe y descarga
    └── label-print-dialog/        # LabelPrintDialog: imprime etiquetas por lote con selección y reintento
```

Usados por: `autocomplete` (receipts, stock-vouchers), `image-upload` (products, receipts, stock-vouchers), `date-range-picker` (receipts, stock-vouchers), `image-lightbox-dialog` (receipts, stock-vouchers), `label-print-dialog` y `LabelsService` (receipts).

## 2. `app-autocomplete`

Genérico con `T extends { id: string | number }` (las órdenes usan `id` numérico). Recibe la función de búsqueda y cómo mostrar cada resultado.

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

- **Inputs:** `searchFn`, `label`, `sublabel`, `placeholder`, `ariaLabel`, `createLabel`, `invalid`, `clearOnSelect`, `value`.
- **Salidas:** `valueChange` (selección única), `picked` (con `clearOnSelect`), `createClicked`.
- `searchFn` es `(term: string) => Observable<T[]>`. El componente aplica un debounce de 300 ms y busca también con el término vacío al enfocar.
- `createLabel` muestra la opción "+ texto" al final y emite `createClicked`.
- Navegación con teclado: flechas, Enter, Escape.
- La lista flotante es un `ul` absoluto simple (`mousedown` + `preventDefault` para no perder el foco). Si se necesita posicionamiento más robusto, usar `CdkConnectedOverlay`.

**Trampas conocidas:**

- Un `effect` refleja en el input el `value` que asigna el padre (por ejemplo, `setValue(proveedor)` desde la importación por clave de acceso sí se muestra).
- Si el padre pone `value` en `null`, el input **no** se vacía solo: recrear el componente o llamar a `clear()`. Caso real: el campo de orden de `StockVoucherFormDialog` al cambiar de motivo.
- Al escribir se descarta la selección.
- **No admite término inicial** (pendiente un input `[initialTerm]`).
- Las funciones de etiqueta (`label`, `sublabel`) deben ser métodos o propiedades flecha del `.ts`; no usar funciones flecha en la plantilla.

## 3. `app-image-upload`

```html
<app-image-upload [(files)]="images" [max]="5" />

<!-- un solo archivo, imagen o PDF -->
<app-image-upload [(files)]="documentFiles" [multiple]="false"
  accept="image/jpeg,image/png,image/webp,application/pdf" [maxSizeMb]="10"
  label="Arrastra la factura o proforma aquí" />
```

- `images` es un `signal<File[]>([])`. **Inputs:** `max`, `maxSizeMb`, `accept`, `multiple`, `camera`, `label`.
- Los PDF se muestran con un recuadro "PDF" en lugar de miniatura.
- **Con `FormControl`** (como en salida y retorno de vales, y en las fotos y comprobantes del alta de ingresos): `[files]="c.images.value" (filesChange)="c.images.setValue($event)"`.
- **Plegar sin perder miniaturas:** ocultar con CSS, **no** con `@if`:

```html
<div [class.hidden]="!lc.photosOpen.value">
  <app-image-upload [files]="lc.images.value" (filesChange)="lc.images.setValue($event)"
    [max]="5" [maxSizeMb]="5" label="Arrastra las fotos aquí" />
</div>
```

- Para productos ya creados, `product-images` (en `features/products`) gestiona agregar, poner como principal y eliminar.
- **Límites** usados por las features: ver `receipts` y `stock-vouchers` (se asumieron 5 fotos, 5 MB por imagen y 10 MB para documentos).

## 4. `app-date-range-picker`

- Es un `ControlValueAccessor` cuyo valor es `{ dateFrom, dateTo }` (o `null`). Se usa con `[formControl]`.
- Patrón de uso en listados:

```html
<app-date-range-picker [formControl]="dateRangeControl" placeholder="Seleccionar rango"></app-date-range-picker>
```

```typescript
readonly dateRangeControl = new FormControl<any>(null); // pendiente tiparlo
// valueChanges → { dateFrom, dateTo } | null → se traduce al query (from/to o dateFrom/dateTo)
// al limpiar filtros: setValue(null, { emitEvent: false }) y vaciar las fechas del query
```

- Las fechas son `AAAA-MM-DD`: no pasarlas por `Date`/`DatePipe` (regla en `/AGENTS.md`, sección 7).
- **Sin verificar:** si garantiza `dateFrom <= dateTo` y cuál es su estado vacío. En ingresos se ajusta el orden a mano; en movimientos se asume que el componente lo garantiza.

## 5. `ImageLightboxDialog` (visor)

Recibe `LightboxData = { images: LightboxImage[]; startIndex: number }` con `LightboxImage = { url: string; fileName: string }`. **`images` NO es `string[]`**: pasar strings deja la vista en `undefined`.

```typescript
import { ImageLightboxDialog, LightboxData } from '.../shared/components/image-lightbox-dialog/image-lightbox-dialog';

const data: LightboxData = {
  images: fotos.map(f => ({ url: f.url, fileName: f.originalName })),
  startIndex,
};
this.dialog.open(ImageLightboxDialog, { data, maxWidth: '95vw', autoFocus: false });
```

- Al abrirlo desde una lista filtrada, calcular `startIndex` buscando la foto pulsada por `id` dentro del arreglo ya filtrado.
- Usar siempre `maxWidth: '95vw'` y `autoFocus: false`.
- Funciones: zoom, pan, pellizco, doble toque, swipe y descarga.
- La descarga hace `fetch(url)` a blob; si el bucket no tiene CORS, cae a abrir la imagen en otra pestaña (usa un `console.warn`, intencional).
- Atajos: ← →, `+`, `-`, `0` (Escape lo maneja CDK).
- Es **siempre oscuro a propósito**: es la excepción a la regla de no usar colores base.

## 6. `camera-dialog` y `theme-toggle`

- **`camera-dialog`:** modal de cámara que devuelve un `File` JPEG. Lo usa `image-upload` cuando se activa `camera`.
- **`theme-toggle`:** botón de tema claro/oscuro. Su ruta real es `shared/components/theme-toggle/theme-toggle/theme-toggle` (carpeta anidada); el layout lo importa así. Unificar con el login (pendiente).

## 7. `LabelPrintDialog` y `LabelsService`

Imprime etiquetas de lotes. **No importa nada de ninguna feature**: quien lo abre arma los `items`.

**Contrato:** `POST /labels/print` con `{ printer, items: [{ lotId, cant }] }`. Respuesta: `{ ok, printer, items: [{ lotId, cant, ok, message }] }`.

- `LabelsService.base` = `${environment.apiUrl}/labels` (prefijo del gateway sin confirmar).
- Tipos en `shared/types/label.types.ts`: `PrinterType` (`'DYMO' | 'ZEBRA'`), `PRINTERS` (valor y etiqueta para el selector), `PrintLabelsRequest`, `PrintLabelsResponse`, `PrintLabelItemResult`.
- Límites del DTO del backend (`PrintLabelsDto`): `printer` `DYMO` o `ZEBRA`, `cant` entero de 1 a 999, de 1 a 50 ítems. El modal los valida antes de enviar.
- **`ok: false` en la raíz NO es error HTTP**: llega con 200. Se leen siempre los `items[]`, que se cruzan con las filas por `lotId`.
- Un ítem fallido no cancela los siguientes.

**Datos de entrada (`LabelPrintDialogData`):**

```typescript
{ items: { lotId: string; cant: number; label?: string }[]; printer?: PrinterType }
```

- `label` es opcional y solo sirve para mostrar el nombre en la fila; si falta, se muestra el `lotId`.
- `printer` es la impresora preseleccionada (por defecto `ZEBRA`); el usuario puede cambiarla dentro del modal, también a mitad de un reintento.

**Comportamiento:**

- Cada fila tiene checkbox y cantidad editable. "Seleccionar todas" aplica solo a filas que aún no salieron bien.
- El botón imprime lo marcado que no salió bien ("Imprimir (n)"). Tras una respuesta, las filas `ok` se desmarcan y se bloquean; las fallidas siguen marcadas y el botón pasa a "Reintentar fallidos".
- Con todo impreso, el botón principal desaparece y "Cancelar" pasa a "Cerrar".
- **Sin `clientRequestId`** (ver `/AGENTS.md`, sección 7): cada llamada imprime. El botón se deshabilita con `printing()` y el cierre se bloquea mientras dura la petición.
- Errores HTTP reales: aviso dentro del modal con el patrón de `/AGENTS.md`, sección 4.
- Al cerrar no devuelve nada: no hay cambios que recargar en quien lo abre.

```typescript
// quien abre el modal
this.dialog.open<void, LabelPrintDialogData>(LabelPrintDialog, {
  data: { items, printer } satisfies LabelPrintDialogData,
  width: '36rem', maxWidth: '95vw', autoFocus: 'first-tabbable', disableClose: true,
});
```

**Trampas:**

- Las filas se identifican por `lotId` (`track r.lotId` y el cruce con la respuesta). Dos filas con el mismo lote chocarían.
- Si hay más de 50 filas marcadas, el modal muestra el error del límite; no divide en solicitudes de 50.

## 8. Datos que NO están en el contexto

- **Código de los componentes de `shared/` salvo `label-print-dialog`:** esta documentación se basa en el uso desde las features y en el `AGENTS.md` anterior. Al ver el código real, corregir lo que no coincida (por ejemplo, nombres exactos de inputs y salidas).
- Código de `date-range-picker`: garantía de `dateFrom <= dateTo` y estado vacío.
- Código de `theme-toggle` y su ruta anidada.
- Si `image-upload` valida tipo/tamaño por su cuenta o solo notifica, y qué muestra al superar `max`.
- Si el prefijo real de `/labels` en el gateway coincide con `${apiUrl}/labels`.
- `LabelPrintDialog` y `LabelsService` se escribieron en el hilo de etiquetas y el usuario confirmó que funcionan; no se ha revisado su aspecto en todos los tamaños de pantalla.

## 9. Pendientes

- Agregar `[initialTerm]` a `app-autocomplete`.
- Hacer que `app-autocomplete` vacíe el input cuando el padre asigna `null`.
- Tipar el valor de `date-range-picker` (`{ dateFrom: string; dateTo: string } | null`) y exportar el tipo.
- Unificar la ruta de `theme-toggle`.
- Mover `PaginationMeta` y `PaginatedResponse` a `shared/types` (ver `/AGENTS.md`, sección 9) y documentarlo aquí cuando exista; la carpeta ya existe con `label.types.ts`.
- `LabelPrintDialog`: dividir en solicitudes de 50 si se abre con más de 50 filas.
- Recordar la última impresora elegida (requeriría una clave nueva de storage; documentarla en `/AGENTS.md`, sección 4).