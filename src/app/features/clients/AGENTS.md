# AGENTS.md: feature `clients` (datos de facturación)

Hereda las convenciones del `AGENTS.md` raíz del front (standalone, sin sufijo `.component`, 3 archivos por componente, signals, `inject()`, tokens de Tailwind, modales con `@angular/cdk/dialog`). Aquí solo van las reglas propias de este feature.

## Qué hace

Administra los **datos de facturación** (`BillingData`) de la empresa del usuario: listar, buscar, crear, editar y seleccionar. Estos datos se usan para emitir facturas, así que un error aquí puede producir facturas con datos incorrectos.

No confundir con `Customer` (clientes de órdenes). Esta feature **no** usa `POST /customers/list`, `save` ni `update`.

## Estructura

```
clients/
├── components/
│   └── client-billing-dialog/   Crear / editar / seleccionar (hijo)
├── pages/
│   └── clients-search/          Lista, buscador y paginación (padre, ruta principal)
├── services/
│   └── clients.service.ts       Único punto de acceso HTTP
├── types/
│   └── clients.types.ts         Contratos con el gateway
├── AGENTS.md
└── clients.routes.ts            CLIENTS_ROUTES, montada en /clientes
```

Regla del proyecto: `pages/` contiene los padres (pantallas); `components/` contiene los hijos que esas pantallas abren.

## API (gateway, `/customers`, requiere sesión y feature `orders`)

| Método | Ruta | Uso |
|---|---|---|
| GET | `/customers/billing/list?q=&active=&page=&limit=` | Lista paginada: `{ items, total, page, limit }` |
| GET | `/customers/billing/search?idNumber=` | Búsqueda por número: mín. 3 caracteres, máx. 10 resultados, solo activos |
| GET | `/customers/billing/form-catalogs` | `{ idTypes, personTypes, genders }` para los selects |
| POST | `/customers/billing` | Crear |
| PUT | `/customers/billing/:id` | Editar |

- El controller del gateway exige `@Features('orders')` y `@Auth()`. El usuario necesita la feature `orders` activa.
- **No usar** `billing/initialdata`: lo consumen otras pantallas y devuelve otra forma.
- Backend: gateway `customers.controller.ts`; ms `clients` en `billing/billing.service.ts` (cmds `list_billing`, `search_billing`, `create_billing`, `update_billing`) y `catalogs/catalogs.service.ts` (cmd `get_billing_form_catalogs`).

### Forma de las respuestas

- `BillingClient` llega con **relaciones anidadas**: `idType` (con `code`), `personType`, `gender`. No existen `idTypeName` ni `genderId`.
- `id` es `string` (ObjectId de 24 caracteres).
- `create` y `update` devuelven el `BillingClient` completo.

## Reglas de negocio que el front debe respetar

1. **La empresa sale del token** (`user.companyId`) en el backend. El front nunca la envía.
2. **No se envían `pin` ni `isCompanyClient`.** El backend usa `isCompanyClient ?? false`.
3. **Tipo de identificación** (códigos SRI):
   - 10 dígitos → cédula `05`.
   - 10 dígitos + `001` → RUC `04`.
   - Con letras → pasaporte `06` (5 a 20 caracteres alfanuméricos).
   - Pasaporte solo numérico, Consumidor Final y Exterior no se detectan: se eligen a mano.
4. **Tipo de persona**: por defecto NATURAL. Natural muestra Nombres + Apellidos; Jurídica muestra Razón social + Nombre comercial. Al cambiar, se vacía el campo oculto.
5. **Celular obligatorio.** Género opcional (`0` = "Sin especificar").
6. `idNumber`, tipo de identificación y tipo de persona **no se editan** en un registro existente: se deshabilitan.
7. **Búsqueda al escribir el número** (solo al crear): 400 ms de debounce y solo si el número ya es válido. Se busca coincidencia **exacta** de `idNumber`, porque el backend usa `Like %...%` y puede devolver varios.
   - Si existe, se rellena el formulario y se bloquean los dos selects.
   - Botón principal: **Guardar** (no existe), **Seleccionar** (existe sin cambios), **Actualizar** (existe con cambios).
8. `changes()` compara en mayúsculas (el backend guarda en mayúsculas) y envía solo los campos modificados.
9. **El género no se puede limpiar**: el backend ignora `genderId: null`.

## Contrato del diálogo

- Recibe `BillingClient | null` por `DIALOG_DATA` (`null` = crear).
- Devuelve `BillingDialogResult { action: 'created' | 'updated' | 'selected'; client }`. Si se cancela, cierra sin valor.
- Otras pantallas (p. ej. crear orden) pueden abrirlo y usar `res.client` con `action: 'selected'`.

## Convenciones del feature

- **Errores de carga y de acción van separados** (`loadError` vs `error`) para que escribir en el formulario no borre el aviso de que los catálogos no cargaron.
- Mensajes de error del backend: `err.error.message` puede ser string o array; se unen con `, `. Usar siempre el helper `errorMessage(err, fallback)`.
- Mientras `saving()` es true se bloquea cerrar y cancelar. El diálogo usa `disableClose: true`.
- Tras cerrar el diálogo con resultado, la página muestra un `flash` de 4 s y recarga la lista.
- La lista carga al abrir: activos, orden por nombre, 20 por página. El buscador (300 ms) filtra por identificación, nombres, nombre comercial y correo.
- El backend usa `ILike` en la lista (no distingue mayúsculas, pensado para Postgres).
- Hay una sola `BillingCatalogsResponse`. No duplicar interfaces: TypeScript las fusiona y marca el error 2717.
- Reutilizar clases globales (`surface-card`, `input-field`, `btn-primary`) y tokens de color. No agregar colores fijos nuevos salvo los de estado (rojo, esmeralda) ya usados.

## Al agregar cosas

- Nuevo endpoint: tipar request/response en `types/`, exponerlo en `clients.service.ts` y no llamar `HttpClient` desde componentes.
- Nuevo campo editable: tipo en `clients.types.ts`, control en el `form`, entrada en `editable`, DTO del gateway y `billing.service.ts` (`create` y `update`).
- Si el contrato del backend cambia, actualizar primero `clients.types.ts` y la tabla de API de este archivo.

## Pendientes conocidos

- Confirmar con Network la forma real de `billing/search`, `billing/list` y `billing/form-catalogs`.
- `search` solo trae activos y `list` no. Un cliente inactivo no aparece al escribir su número en el diálogo, y al guardar sale el error de duplicado (índice único empresa + `idNumber`).
- Los registros sin celular no se podrán actualizar hasta completarlo.
- Apellidos no es obligatorio en persona natural.
- Si el usuario tiene PIN obligatorio, el backend rechazará el guardado (la UI ya no lo pide).
- Permisos por grupo: hoy basta la feature `orders`. Si se restringe a un grupo, aplicarlo en el gateway con `@Groups` y ocultar los botones en el front.
- Entrada "Clientes" (`/clientes`, `ICONS.clients`) en `main-layout.ts` y ruta en `app.routes.ts`.