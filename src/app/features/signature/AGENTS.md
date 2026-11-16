# AGENTS.md: feature `signature` (firmas electrónicas)

Hereda las convenciones del `AGENTS.md` raíz del front (standalone, sin sufijo `.component`, 3 archivos por componente, signals, `inject()`, tokens de Tailwind, modales con `@angular/cdk/dialog`). Aquí solo van las reglas propias de este feature.

## Qué hace

Sube firmas electrónicas (.p12/.pfx), las lista con su estado de vigencia y permite asignar o quitar sucursales. Una firma sirve para facturar, así que un error aquí puede dejar a una sucursal sin poder emitir.

## Estructura

```
signature/
├── components/
│   ├── signature-upload-dialog/     Subir firma nueva (archivo + clave + sucursales)
│   └── signature-branches-dialog/   Editar sucursales de una firma existente
├── page/
│   └── signature-list/              Listado (ruta principal)
├── services/
│   └── signatures.service.ts        Único punto de acceso HTTP
├── types/
│   └── signature.types.ts           Contratos con el gateway
├── AGENTS.md
└── signature.routes.ts              SIGNATURE_ROUTES, montada en /firmas
```

Nota: la carpeta es `page/` (singular), tal como está en el repo. No renombrar.

## API (gateway, `/signatures`, requiere sesión)

| Método | Ruta | Uso |
|---|---|---|
| GET | `/signatures` | Listado: `{ items: Signature[] }` |
| GET | `/signatures/new-data` | Sucursales activas con su firma actual: `{ branches: BranchOption[] }` |
| POST | `/signatures` | Crear (multipart) |
| PUT | `/signatures/:id/branches` | Reemplazar el conjunto de sucursales: `{ branchIds }` |

### POST multipart

- Campo `data` con el JSON (`clientRequestId`, `password`, `branchIds`) **antes** del campo `file`.
- No fijar `Content-Type` a mano: el navegador pone el boundary.
- Límite del archivo: 512 KB, solo `.p12` o `.pfx`.
- `clientRequestId` se genera **una sola vez** al abrir el diálogo (`crypto.randomUUID()`) y se reutiliza en cada reintento. Es la idempotencia: no regenerarlo por intento.
- `replayed: true` en la respuesta también es éxito (el backend ya tenía esa solicitud).

## Reglas de negocio que el front debe respetar

1. **Una sucursal tiene máximo una firma** (UNIQUE en backend). En los diálogos, una sucursal que usa otra firma se muestra deshabilitada con "Usa la firma: …".
2. **Mover una sucursal es en dos pasos**: liberarla en la firma origen y luego marcarla en la destino. No automatizar el cambio silencioso: puede dejar a otra sucursal sin firma.
3. `PUT /:id/branches` **reemplaza** el conjunto completo. Enviar siempre la lista final, no un diff. Lista vacía es válida.
4. Subir exige al menos una sucursal; editar permite cero.

## Seguridad

- La clave de la firma y la key de S3 **nunca** llegan al front ni se muestran de nuevo. No agregar campos para leerlas.
- El input de clave usa `autocomplete="new-password"`. No guardar la clave en signals persistentes, `localStorage` ni logs; solo vive en el `FormControl` mientras el diálogo está abierto.
- No versionar archivos `.p12`/`.pfx` (ni de prueba). Deben estar en `.gitignore`.
- Pendiente: decidir qué grupo/feature puede subir y editar. Hoy basta tener sesión. Cuando se defina, se aplica en el gateway con `@Groups`/`@Features`; el front debe además ocultar los botones a quien no tenga permiso.

## Convenciones del feature

- **Errores de carga y de acción van separados** (`loadError` vs `error`) para que elegir un archivo o marcar una casilla no borre el aviso de que no se cargaron las sucursales. Los diálogos distinguen tres casos: error de carga, lista vacía ("No hay sucursales registradas") y todas ocupadas.
- Mensajes de error del backend: `err.error.message` puede ser string o array; se unen con `, `. Usar siempre el helper `errorMessage(err, fallback)`.
- Estado de vigencia (`expired`, `soon`, `ok`) se calcula en el cliente a partir de `expiresAt`; "por vencer" = 30 días o menos (`SOON_DAYS`). Las fechas se muestran en zona Ecuador (`-0500`).
- Mientras `saving()` es true se bloquea cerrar, cancelar y editar. Los diálogos usan `disableClose: true`.
- Tras guardar, el diálogo se cierra devolviendo la firma; la página muestra un `flash` de 4 s y recarga el listado con `reload()`.
- Reutilizar clases globales (`surface-card`, `input-field`, `btn-primary`) y tokens de color. No agregar colores fijos nuevos salvo los de estado (rojo, ámbar, esmeralda) ya usados.

## Al agregar cosas

- Nuevo endpoint: tipar request/response en `types/`, exponerlo en `signatures.service.ts` y no llamar `HttpClient` desde componentes.
- Nuevo diálogo: carpeta propia en `components/`, 3 archivos, abrir con `Dialog` de CDK desde `signature-list.ts`.
- Si el contrato del backend cambia, actualizar primero `signature.types.ts` y la tabla de API de este archivo.

## Pendientes conocidos

- Permisos por grupo/feature (ver Seguridad).
- El gateway convierte los 400 de billing (p. ej. ".p12 inválido o clave incorrecta") en 500 genérico; hasta corregir `RpcToHttpInterceptor`, el front muestra "No se pudo guardar la firma." en esos casos.
- Entrada "Firmas" (`/firmas`, icono shield-check) en `main-layout.ts`.