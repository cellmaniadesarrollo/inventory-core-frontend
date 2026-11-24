# Contrato Frontend: Búsqueda de productos para ventas

## Endpoint
`GET /inventory-core/products/search-sale`  
*(Requiere sesión; la empresa y la sucursal salen del token del usuario).*

---

## Query Params

| Param | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `q` | `string` (1–100) | **Sí** | Lo que escribió o escaneó el usuario. Se recorta con `trim`. |
| `source` | `'SCANNER' \| 'MANUAL'` | No (default: `'MANUAL'`) | `SCANNER` si lo escribió el lector; `MANUAL` si se escribió o pegó. |
| `lotCode` | `entero ≥ 1` | No | Número del lote que trae el QR. Solo con `source=SCANNER`; con `MANUAL` responde `400`. |

> **Nota:** No se aceptan otros parámetros (el servidor responderá con `400`).

---

## Cómo armar la petición

| Caso | Qué enviar |
| :--- | :--- |
| **Lector con QR (SKU + lote)** | `q=<sku>&source=SCANNER&lotCode=<n>` |
| **Lector sin lote** | `q=<sku>&source=SCANNER` |
| **IMEI** | `q=<15 dígitos>&source=MANUAL` |
| **UPC** | `q=#<upc>&source=MANUAL` *(con el `#` delante, codificado como `%23` en la URL)* |
| **SKU escrito o pegado** | `q=<sku>&source=MANUAL` |
| **Texto libre** (`pan sam a54`) | `q=pan sam a54&source=MANUAL` |

> **Importante:** El carácter `#` debe ir codificado (`encodeURIComponent`), de lo contrario el navegador lo interpretará como un ancla y no llegará al servidor.

---

## Respuesta Exitosa (`200 OK`)

Siempre devuelve un arreglo plano (sin `{ items, meta }`, sin paginación) con un máximo de **20 productos**. Puede retornar `[]` en búsquedas de texto libre.

```typescript
export type SaleSearchItem = {
  product: {
    id: string;
    code: number;
    sku: string;
    upc: string | null;
    name: string;
    description: string | null;
    kind: 'DEVICE' | 'PART' | 'ACCESSORY';
    trackingMode: 'QUANTITY' | 'SERIAL';
    typeName: string | null;
    colorName: string | null;
    qualityName: string | null;
    brands: string[];
    models: {
      id: number;
      name: string;
      brand: string;
      technicalCodes: string[];
    }[];
    imageUrl: string | null;
  };
  stock: {
    onHand: number;     // Suma de los lotes devueltos
    available: number;  // Suma de los lotes devueltos
  };
  lots: {
    lotId: string;
    code: number;                  // Número del lote (el del QR)
    onHand: number;
    reserved: number;
    available: number;
    salePrice: string;             // Numeric como string, 2 decimales
    warrantyDays: number;
    hasTax: boolean;
    priceIncludesTax: boolean;
    billableInSales: boolean;      // Informativo; la decisión de facturar es de billing
    billableInRepairOrders: boolean;
    createdAt: string;             // ISO String
    units: {                       // Vacío si trackingMode = 'QUANTITY'
      unitId: string;
      serial: string;              // IMEI/serial principal
      serials: string[];           // Todos (IMEI 1, IMEI 2, …)
    }[];
  }[];                             // Ordenados: más antiguos primero
};

export type SaleSearchResponse = SaleSearchItem[];
```

### ¿Qué contiene según el modo?
* **Lector con `lotCode`:** Un solo producto con un solo lote.
* **IMEI:** Un solo producto, un solo lote y una sola unidad dentro de `units`.
* **SKU, UPC o texto libre:** Todos los lotes con stock de la sucursal, con todas sus unidades disponibles.
* **`stock`:** Suma únicamente los lotes devueltos en la respuesta. En los modos de lote o IMEI refleja ese lote específico, no el total global del producto.

---

## Reglas para pintar en UI

1. **Precios:** `salePrice` llega como `string`. No operar matemáticamente con él en el frontend; solo mostrarlo (o formatearlo visualmente).
2. **Impuestos:** Si `hasTax` y `priceIncludesTax` son ambos `true`, el precio mostrado ya incluye el impuesto.
3. **Seguridad:** `unitCost` no viaja en la respuesta (es un dato sensible).
4. **Productos Serializados (`SERIAL`):** El usuario debe elegir entre `lots[].units[]`. El `unitId` es el identificador que se enviará posteriormente al crear la venta.
5. **Productos por Cantidad (`QUANTITY`):** El arreglo `units` viene vacío y se vende por cantidad contra el `lotId`.

---

## Manejo de Errores

El cuerpo de error sigue el estándar del gateway (mensajes en español). Se debe mostrar el `message` tal cual llega.

| HTTP | Cuándo ocurre | Ejemplo de Mensaje |
| :--- | :--- | :--- |
| **400** | `q` vacío, >100 caracteres, `source` inválido, `lotCode` inválido o enviado sin `SCANNER` | *"Escribe qué buscar"*, *"El lote solo se envía desde el lector"*, etc. |
| **400** | SKU y lote no coinciden | *"El lote no corresponde al producto"* |
| **400** | `#` sin texto | *"Escribe el código de barras después del #"* |
| **404** | SKU no existe (lector o texto que no coincidió) | *"El producto no existe"* |
| **404** | IMEI no existe | *"No existe ninguna unidad con ese IMEI"* |
| **404** | UPC no existe | *"No existe un producto con ese código de barras"* |
| **409** | SKU, UPC o lote sin stock en la sucursal | *"El producto no tiene stock en esta sucursal"* / *"El lote #N no tiene stock en esta sucursal"* |
| **409** | IMEI existe pero no se puede vender | *"Ese IMEI ya fue vendido"*, *"Ese IMEI está en otra sucursal"*, *"Ese IMEI está fuera de bodega…"*, etc. |

> **Nota sobre Texto Libre:** Cuando no hay resultados en búsqueda libre, **no es un error**; el servidor responde `200 OK` con `[]`. Mostrar *"Sin resultados"* en la UI.

---

## Comportamiento recomendado en el Frontend

* **Lector (Scanner):** El input debe detectar la ráfaga de teclas rápidas + el `Enter` final. Si el QR trae SKU y lote, separarlos y enviar `source=SCANNER` junto con `lotCode`. Si la respuesta devuelve 1 producto con 1 lote, agregarlo directamente al carrito/venta.
* **Manual:** Enviar `source=MANUAL`. Aplicar *debounce* (`≈300 ms`) **solo** al texto libre. Para búsquedas exactas como IMEI (15 dígitos), `#UPC` o SKU, conviene disparar la búsqueda al pulsar `Enter`.
* **Múltiples resultados:** Mostrar una lista para que el usuario elija. Si `trackingMode = 'SERIAL'`, solicitar también la selección de la unidad (`unitId`).
* **UPC:** Aunque hoy el UPC es único por empresa, la respuesta puede devolver más de un producto; manejarlo siempre como una lista.
* **Cancelación de peticiones:** Si el usuario sigue escribiendo, cancelar la petición en curso usando `AbortController`, ya que no hay paginación ni orden de llegada garantizado.

---

## Pendientes por confirmar (Frontend / Etiquetas)
* [ ] **Formato del QR:** Validar cómo codifica el lote la etiqueta (módulo `labels/`) para definir la lógica de separación entre `SKU` y `lotCode`.
* [ ] **Código sin lote:** Un SKU escaneado sin lote devolverá todos los lotes con stock; la interfaz debe permitir al usuario elegir cuál lote descontar.