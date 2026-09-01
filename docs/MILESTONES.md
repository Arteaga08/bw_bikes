# Black and White Bikes — Tablero de milestones

Fuente de verdad de qué está realmente hecho y mergeado a `main`. La spec completa vive en
`docs/superpowers/specs/2026-08-03-black-and-white-bikes-design.md`; el detalle de entrega y
verificación de cada milestone vive en `~/.claude/plans/nuevo-proyecto-black-and-prancy-dewdrop.md`.

| Milestone | Fase | Estado | Rama | Notas |
|---|---|---|---|---|
| M1 — Scaffolding seguro del monorepo | 1 | ✅ Hecho | `feat/m01-scaffolding` (mergeado, tag `m01`) | Ver detalle abajo |
| M2 — Auth y usuarios | 1 | ✅ Hecho | `feat/m02-auth` (mergeado, tag `m02`) | Ver detalle abajo |
| M3 — Catálogo | 1 | ✅ Hecho | `feat/m03-catalogo` (mergeado) | Ver detalle abajo |
| M4 — Inventario y reservas | 1 | ✅ Hecho | `feat/m04-inventario` (mergeado) | Ver detalle abajo |
| M5 — Carrito, órdenes y pagos | 1 | ✅ Hecho (mergeado) | `feat/m05-ordenes-pagos` | Módulo crítico. Ver detalle abajo |
| M6 — Envíos, estatus y solicitudes | 1 | ✅ Hecho (mergeado) | `feat/m06-envios-solicitudes` | Cierra la decisión abierta #1. Ver detalle abajo |
| M7 — Settings, analítica y adapters | 1 | ✅ Hecho (mergeado) | `feat/m07-settings-analitica` | Cierra la fase 1. Ver detalle abajo |
| M8 — Shell del dashboard | 2 | ✅ Hecho (mergeado) | `feat/m08-dashboard-shell` | Arranca la fase 2. Ver detalle abajo |
| M9 — Órdenes y cola de confirmación | 2 | ✅ Hecho (mergeado); verificación Stripe pospuesta a M10 | `feat/m09-ordenes` (mergeado) | Ver `docs/DESIGN_REFERENCES.md`. Ver detalle abajo |
| M10 — Catálogo en admin | 2 | ✅ Funcionalmente hecho; ⚠️ verificación Stripe en curso | `feat/m10-catalogo-admin` (en `main`, commit directo sin `merge:` propio) | Ver detalle abajo |
| M11 — Inventario, solicitudes, settings, analítica, auditoría | 2 | ✅ Hecho (mergeado); cierra la fase 2 | `feat/m11-inventario-settings` (mergeado, rama borrada) | Ver detalle abajo y `docs/DESIGN_REFERENCES.md` |
| M12 — Catálogo público | 3 | 🚧 En progreso — home sección por sección, entrega 2/10 (hero) | — | Ver detalle abajo |
| M13 — Carrito, checkout y cuenta | 3 | ⏳ Pendiente — plan de entregas escrito | — | Ver `docs/m13/00-CONTEXTO.md` (entregas A1–A6 de cuenta, luego B de carrito; checkout es fase 2, sin documentar aún) |
| M14 — Embajadores, patrocinios y SEO | 3 | ⏳ Pendiente | — | |
| M15 — Correos y alertas logísticas | 4 | ⏳ Pendiente | — | |
| M16 — Bot Instagram/Facebook DM | 4 | ⏳ Pendiente | — | Requiere trámite Meta iniciado en fase 3 |
| M17 — Bot WhatsApp | 4 | ⏳ Pendiente | — | Requiere número dedicado + verificación Meta |
| M18 — Cupones: backend núcleo | 5 | ✅ Hecho | `feat/m18-cupones-backend` | Cierra parte de la decisión abierta #3. Ver detalle abajo |
| M19 — Cupones: panel admin | 5 | ✅ Hecho | `feat/m18-cupones-backend` | Ver detalle abajo |
| M20 — Clientes: backend CRM | 5 | ✅ Hecho | `feat/m18-cupones-backend` | Ver detalle abajo |
| M21 — Envío de cupones por correo | 5 | ✅ Hecho | `feat/m18-cupones-backend` | Cierra la fase 5. Ver detalle abajo |
| M22 — Clientes: panel admin | 5 | ✅ Hecho | `feat/m18-cupones-backend` | Ver detalle abajo |

---

## M1 — Scaffolding seguro del monorepo

**Entregado:**
- Monorepo pnpm (`pnpm-workspace.yaml`) con `apps/api`, `apps/web` (vacío, se llena en fase 2/3) y
  `packages/shared`.
- `packages/shared`: `ApiResponse`/`ApiResponseMeta`, `ItemType`, `FulfillmentMode`, `OrderStatus`.
- `apps/api`:
  - `config/`: `env.ts` (`loadEnv()` fail-fast, objeto congelado), `db.ts` (connect/disconnect
    separados de `server.ts`), `cors.ts` + `allowed-origins.ts` (whitelist única compartida con
    `verifyOrigin`), `logger.ts` (pino con redacción de PII/secretos).
  - `utils/`: `AppError`, `asyncHandler`, `sendResponse`.
  - `middlewares/`: `mongoSanitize` (recursivo, anti prototype-pollution), `sanitizeInput` (XSS
    recursivo con `xss`, respeta campos de credencial), `verifyOrigin` (anti-CSRF defensa en
    profundidad), `rateLimit` (factory + limiters de login/lectura pública/backstop global, no-op
    fuera de producción), `validate` (Joi `stripUnknown`), `errorHandler` (global, sin stack en
    prod, mapea errores conocidos de Mongoose/JWT/body-parser), `notFound`.
  - `app.ts`: `buildApp()` testeable sin abrir puerto ni DB, cadena de middleware en el orden exacto
    del estándar.
  - `server.ts`: `loadEnv → connectDb → listen → graceful shutdown` (SIGINT/SIGTERM + timeout de
    seguridad).
  - `routes/health.route.ts` montado en `/api/v1/health`.
- `.env.development.example` y `.env.production.example` versionados con placeholders;
  `.env.*.local` cubierto por `.gitignore`. Sin `.env.test` committeado — los tests inyectan sus
  propias variables fixture vía `vitest.config.ts` para no versionar ni un archivo `.env` que no sea
  `*.example`.
- Tests (`tests/health.test.ts`, vitest + supertest): health check, 404 en ruta no encontrada,
  cabeceras de helmet presentes, límite de body de 10kb respetado, sanitización de operador `$` en
  query string.

**Verificado:**
```
pnpm -r exec tsc --noEmit   → limpio (shared + api)
pnpm --filter @bw-bikes/api lint   → limpio
pnpm --filter @bw-bikes/api build  → limpio
pnpm --filter @bw-bikes/api test   → 5/5 tests pasan
node dist/server.js sin variables de entorno → aborta con mensaje claro (fail-fast verificado)
```
`pnpm audit --prod` pendiente de correr en el paso de cierre (después de que el usuario apruebe el
diff y se congelen las dependencias).

**Decisiones tomadas durante la implementación (no estaban explícitas en el plan):**
- Errores `PayloadTooLargeError` de `express.json({limit})` (y cualquier error `http-errors`-style
  con `statusCode` + `expose: true`) se mapean a un `AppError` operacional con su propio código en
  vez de cerrar en 500 genérico — evita que un límite de tamaño de body se reporte como bug interno.
- Los umbrales de rate limit para login (5/15min) y lectura pública (500/15min) quedan definidos
  como constantes reusables en `middlewares/rate-limit.ts`, listas para montarse en M2/M3.

**Fuera de este milestone:** cualquier ruta de negocio (auth, catálogo, etc.) — llegan en M2/M3.
`apps/web` queda vacío hasta la fase 2.

---

## M2 — Auth y usuarios

**Entregado:**
- `packages/shared`: `UserRole`, `AuthUser` (forma pública sin secretos), `AuditAction`.
- `apps/api/src/models/`: `User` (password `select:false` + bcrypt 12 rounds, `emailVerification` y
  `passwordReset` como subdocumentos con `tokenHash` `select:false` + TTL propio, `twoFactor.secret`
  cifrado AES-256-GCM `select:false`, `passwordChangedAt` para invalidar tokens viejos, `toJSON`
  como defensa en profundidad), `Session` (refresh token opaco hasheado, rotación con `familyId` +
  índice TTL en `expiresAt`), `AuditLog` (append-only, índices en `actorId`/`module`).
- `apps/api/src/services/`: `auth.service` (registro, verificación, login, forgot/reset, logout —
  anti-enumeración con timing constante vía hash dummy en login), `token.service` (JWT de acceso +
  challenge, sesiones de refresh con **detección de reuso**: un token ya rotado que vuelve a
  presentarse revoca toda la familia), `two-factor.service` (enroll en dos pasos, verify, disable —
  todos sobre `otplib`), `audit-log.service` (`recordAuditLog` best-effort), `mailer/` (interfaz +
  stub que loguea a `debug`, nunca en producción — M7/M15 registran el adapter real sin tocar código
  de negocio).
- `apps/api/src/middlewares/`: `protect` (JWT de cookie + `passwordChangedAt` + exige 2FA activo en
  cada request si el rol es admin/superadmin, no solo al login) y `restrictTo(...roles)`.
- Rutas `/api/v1/auth/*`: registro, verificación de correo, reenvío, login (con desvío a challenge de
  2FA si el rol es administrativo), enrolamiento de 2FA en dos pasos, verificación de 2FA,
  desactivación de 2FA (exige código), refresh (rotación), logout, logout-all, forgot/reset password,
  `/me`.
- Login de admin: la contraseña correcta nunca emite sesión por sí sola — solo una cookie de
  challenge de 5 min; la sesión completa solo se emite al validar el TOTP (enrolamiento o verify).
  Desactivar 2FA invalida la sesión del propio admin en la siguiente request (`protect` re-chequea
  `twoFactor.enabled` siempre), forzando reenrolamiento en el próximo login.
- `apps/api/src/scripts/seed-admin.ts` (`pnpm --filter @bw-bikes/api seed:admin`): idempotente, crea
  o actualiza el primer admin con `emailVerified: true` y 2FA pendiente de enrolar.
- Rate limiters dedicados y en buckets separados: `loginRateLimiter` (5/15min, solo `/login`),
  `twoFactorRateLimiter` (5/15min, propio — compartir el bucket de login con los pasos de 2FA
  bloqueaba a un admin legítimo en su propio primer enrolamiento) y `authActionRateLimiter`
  (10/15min, endpoints anónimos con efecto secundario de correo: registro, reenvío, forgot/reset).

**Correcciones a M1 (detectadas al construir M2, no eran features nuevas):**
- `validate` hacía `Object.assign(req[target], value)`, que no elimina las claves que Joi
  `stripUnknown` descartó — un `role` en el payload de registro habría llegado igual al controller.
  Ahora reconcilia in-place (borra lo que no está en `value` antes de mergear).
- Los rate limiters eran no-op fuera de `production`, así que "5/15min" no era verificable en tests.
  Ahora son no-op solo en `development`; `test` y `production` los aplican. Se agregó
  `resetRateLimiters()` (usa `MemoryStore` explícito por limiter) para limpiar contadores entre tests.
- `CREDENTIAL_FIELDS` de `sanitizeInput` no cubría los campos nuevos de auth — se agregaron
  `totpCode`, `verificationToken`, `resetToken`, `refreshToken`, `secret`.
- `trust proxy` no estaba configurado — en Render/Railway el rate limit habría visto la IP del proxy
  y throttleado a todos los usuarios como si fueran uno solo. Ahora se activa solo en producción.
- `tests/` estaba fuera del `include` de `tsconfig.json`, así que `tsc --noEmit` no los
  typechequeaba. Se agregó `tsconfig.test.json` (incluye `src` + `tests`) y el script `typecheck` de
  `apps/api` corre ambos; el `typecheck` de la raíz ahora delega a `pnpm -r run typecheck` en vez de
  invocar `tsc` directo, para que cada paquete controle su propio alcance.
- `packages/shared/tsconfig.tsbuildinfo` estaba commiteado por accidente; se agregó `*.tsbuildinfo`
  al `.gitignore` y se destrackeó.

**Verificado:**
```
pnpm --filter @bw-bikes/shared build   → limpio (api resuelve shared por dist/)
pnpm typecheck   (pnpm -r run typecheck, incluye tests) → limpio (shared + api)
pnpm lint        → limpio
pnpm build       → limpio
pnpm test        → 6 archivos, 20/20 tests pasan (mongodb-memory-server real, no mocks)
pnpm audit --prod → sin vulnerabilidades conocidas
```
Tests cubren: registro→verificación→login→refresh (con rotación y detección de reuso)→logout;
enrolamiento y login con 2FA real (códigos generados con `otplib`), y el auto-bloqueo de sesión al
desactivar 2FA; `protect` sin cookie → 401, `restrictTo` sin rol → 403 sobre una ruta admin real
(`/2fa/disable`); mismo mensaje para email inexistente y contraseña incorrecta; `role: "admin"`
inyectado en el registro se ignora (verificado contra la DB); `password` nunca aparece en una
respuesta; bloqueo de login al 6.º intento; reset de contraseña de un solo uso, con token expirado
rechazado, que revoca sesiones existentes y permite login con la contraseña nueva.

**Decisiones tomadas durante la implementación (no estaban explícitas en el plan):**
- Sesión con refresh token rotativo revocable (ASVS L2), no solo el access JWT que pedía el
  milestone a secas — decisión tomada con el usuario al arrancar el chat.
- Roles `customer | admin | superadmin` (no solo `admin`), para no migrar cuando llegue el visor de
  auditoría restringido de M11.
- Verificación de correo con TTL de 24h y reset de contraseña con TTL de 1h — ambos cortos per spec,
  pero distintos porque el reset es más sensible (riesgo de takeover) que la verificación inicial.
- Login compara contra un hash dummy cuando el email no existe, para que el tiempo de respuesta no
  delate la existencia de la cuenta (además del mensaje genérico ya exigido).

**Fuera de este milestone:** mailer real (stub hasta M7/M15); QR de 2FA (el endpoint devuelve el URI
`otpauth://`, el dashboard lo renderiza en M8); cualquier ruta de negocio no-auth.

---

## M3 — Catálogo

**Entregado:**
- `packages/shared`: `SpecGroup`/`SpecField`, `ProductImage`, `ProductVariant`, DTOs
  públicos (`PublicCategory`, `PublicCategoryTreeNode`, `PublicBike`, `PublicAccessory`), `CURRENCY`
  y `PriceCents` (enteros en centavos), nuevas `AuditAction` de catálogo, y `buildImageUrl` +
  `RESPONSIVE_IMAGE_WIDTHS` — única fuente de verdad para armar URLs derivadas de Cloudinary,
  consumida por la API y por el storefront de M12.
- `apps/api/src/utils/`:
  - **`list-query.ts`** — el utilitario transversal del milestone: `parseListQuery` (page/limit/skip/
    sort/search con whitelist de orden por caller y tope duro de 100), `buildMeta` (`total`/`page`/
    `pages`/`limit`, con `pages: 1` en colección vacía) y `escapeRegex` (anti-ReDoS). Los filtros de
    negocio quedan explícitos en cada service a propósito — un parser genérico terminaría
    reenviando el query object del cliente a Mongo.
  - `slugify.ts` (pliega acentos y `ñ` vía NFD), `magic-bytes.ts` (firmas de JPEG/PNG/WebP/AVIF),
    `express-query.ts` (ver correcciones a M1/M2 abajo).
- `apps/api/src/models/`: sub-esquemas embebidos compartidos (`spec-group`, `product-image`,
  `product-variant`, todos con topes que impiden crecer un documento sin límite); `BikeCategory` y
  `AccessoryCategory` como **dos colecciones independientes** generadas por un mismo motor de
  esquema; `Bike` y `Accessory` como **dos entidades separadas** (la bici tiene `shortDescription`
  y `relatedAccessories`; el accesorio no).
- Campos de primera clase para filtros exactamente los que nombra la spec — categoría, marca,
  precio, más talla y color a nivel variante. `specGroups[]` es solo de exhibición y nunca se
  filtra, que es la consecuencia que el cliente aceptó al pedir ficha libre.

  > **Corrección (M10.5, 2026-08-12):** `brakeType` se planeó aquí como campo de primera clase por
  > ser "lo que el storefront va a filtrar", pero el storefront nunca llegó a existir y ningún query
  > param, índice ni agregación lo usó jamás como filtro — quedó como un enum obligatorio decorativo.
  > Se eliminó de `Bike`/`packages/shared` en M10.5; el dato, si hace falta, se captura como fila de
  > la ficha técnica libre (`specGroups`).
- `apps/api/src/services/`: `category.service` (factory instanciado por árbol: jerarquía de dos
  niveles validada contra el documento padre, slug único, borrado real solo si la categoría está
  vacía), `product.service` (factory: listado paginado, archivado lógico, ficha técnica, galería),
  `bike.service` / `accessory.service` con sus campos y DTOs propios, y `storage/` (cadena
  multer → magic bytes → coherencia de tipo declarado → strip EXIF → Cloudinary).
- Rutas: `/api/v1/catalog/*` públicas y de solo lectura (`publicReadRateLimiter`, solo activo/no
  archivado, DTO recortado) y `/api/v1/admin/*` con `protect` + `restrictTo("admin","superadmin")`
  montado sobre el router completo y sin rate limit (§7: la barrera es auth + rol).
- Auditoría en cada escritura de catálogo, sobre el `recordAuditLog` best-effort de M2.

**Correcciones a M1/M2 (detectadas al construir M3, no eran features nuevas):**
- **`mongoSanitize`, `sanitizeInput` y `validate` eran no-ops sobre `req.query`.** En Express 5
  `req.query` es un *getter* que re-parsea la URL en cada acceso, así que mutarlo en el lugar no
  persiste: borrar una clave y volver a leerla la devolvía intacta. El test de M1 solo assertaba un
  200, por eso nunca lo detectó. `utils/express-query.ts` (`materializeQuery`, llamado al tope de
  `mongoSanitize`) reemplaza el getter por una propiedad de datos real y con eso los tres middlewares
  se comportan como su código dice. Es load-bearing para los filtros de M3: sin él la coerción de Joi
  (`minPrice=1200000` → número) se perdía y el filtro de rango de precio nunca se aplicaba.
- `routeParam()` para leer `:id`/`:slug`: Express 5 tipa `req.params` como `string | string[]`.

**Verificado:**
```
pnpm --filter @bw-bikes/shared build   → limpio
pnpm typecheck   (incluye tests)       → limpio (shared + api)
pnpm lint                              → limpio
pnpm build                             → limpio
pnpm test                              → 14 archivos, 87/87 tests pasan (Mongo real en memoria)
pnpm audit --prod                      → sin vulnerabilidades conocidas
```
Los cuatro criterios de cierre, con su prueba:
1. **CRUD de ambos árboles y ambos productos vía API** — `catalog-categories.test.ts` (9),
   `catalog-bikes.test.ts` (10) y `catalog-accessories.test.ts` (5) recorren create/read/update/
   delete-archive contra las rutas reales con sesión de admin real (login + 2FA con `otplib`).
2. **`.png` renombrado a `.jpg` es rechazado** — `catalog-uploads.test.ts`: 400 y el spy del SDK de
   Cloudinary sin llamadas. Un test hermano sube el mismo PNG con su nombre correcto y da 201, para
   probar que el rechazo fue por la contradicción y no por ser PNG.
3. **Listado paginado devuelve `meta` correcto** — `list-query.test.ts`: 25 bicis, `?page=2&limit=10`
   → `{total:25, page:2, pages:3, limit:10}`, página 3 con 5 documentos, `limit=5000` topado en 100.
4. **Ficha técnica: agregar, renombrar, reordenar, borrar** — `catalog-spec-groups.test.ts` hace las
   cuatro operaciones sobre grupos y campos, releyendo por API después de cada una.

**Decisiones tomadas durante la implementación (no estaban explícitas en el plan):**
- **Ficha técnica con un solo `PUT /spec-groups`** que reemplaza el arreglo completo, en vez de
  endpoints sub-recurso por grupo y por campo. Una sola escritura atómica cubre las cuatro
  operaciones y es como va a guardar el editor de M10. La regla de "endpoints por sección" del
  estándar aplica a `Settings` (singleton con editores concurrentes independientes), no a una ficha
  que se edita como unidad.
- **Rechazo por contradicción de tipo, no solo por firma.** Detectar el formato por magic bytes
  aceptaría un PNG llamado `foto.jpg` (PNG es un formato válido). El criterio del milestone pide
  rechazarlo, así que además de la firma se exige que la extensión y el `Content-Type` declarados
  coincidan con los bytes reales.
- **Compresión en entrega, no en subida.** La API sube el original normalizado (EXIF removido, tope
  de 2400px) y la compresión ocurre al servir vía `f_auto`/`q_auto` de Cloudinary. Por eso se
  persiste el `publicId` y no una URL fija: el `srcset` de M12 pide varios anchos del mismo original.
- **Unicidad de SKU por colección, no global.** `InventoryItem` de M4 se indexa por
  `{itemType, itemId, sku}`, así que un SKU de bici igual a uno de accesorio no es ambiguo; un
  chequeo cruzado entre colecciones sería racy sin aportar nada.
- **Borrado**: productos con archivado lógico (`isActive:false` + `archivedAt`, reversible con
  `/restore`); categorías con borrado real solo si no tienen hijos ni productos, si no 409 con los
  conteos.
- **Precio en el producto con override opcional por variante** (talla XL o color de edición especial),
  todo en centavos enteros.
- **Cloudinary: obligatorio en producción, opcional en desarrollo.** `CLOUDINARY_CLOUD_NAME`/
  `API_KEY`/`API_SECRET` abortan el arranque en producción (verificado: `node dist/server.js` con
  `NODE_ENV=production` y sin ellas imprime el fatal y sale). Fuera de producción la API arranca con
  una advertencia y **solo** las rutas de galería responden 503 con mensaje explícito — no existe un
  stub que finja una subida exitosa. Esto es lo que permite construir el resto de la fase 1 sin
  depender de una cuenta de Cloudinary; las credenciales reales se cargan al cerrar el backend.
  Los tests inyectan valores fixture y espían el SDK, así que nunca tocan la red.

**Pendiente para el cierre de la fase 1 (M7):** cargar las credenciales reales de todos los
servicios externos (`CLOUDINARY_*`, `STRIPE_*`, y lo que sumen M5–M7) en `.env.development.local` y
en el secret manager del hosting, y correr una pasada de pruebas manuales end-to-end contra ellos.
Hasta entonces cada integración arranca en modo "no configurada": la API levanta y solo la ruta que
depende de ese servicio responde con un error explícito.

**Fuera de este milestone:** inventario y `fulfillmentMode` efectivo (el campo existe por variante,
pero nadie reserva contra stock hasta M4); precios por tier/canal; búsqueda full-text (por ahora
regex escapada sobre nombre, marca y SKU); cualquier UI — el CRUD de catálogo en admin es M10 y el
storefront M12.

---

## M4 — Inventario y reservas

**Entregado:**
- `packages/shared`: `ReservationStatus`, `ReservationReferenceType`, `InventoryAvailability`,
  `ProductVariant.preorderReleaseDate` y tres `AuditAction` nuevas de inventario (una de ellas la
  escribe el job con `actorType: "system"`, sin actor humano).
- `apps/api/src/models/`:
  - **`InventoryItem`** en colección aparte, keyed por `{itemType, itemId, sku}` (índice único) más
    índice en `sku` para la búsqueda del listado. Dos contadores, nunca uno: `onHand` (físico) y
    `reserved` (apartado); **disponible = onHand − reserved**, siempre derivado, nunca almacenado.
  - **`StockReservation`** con `status` (`held`/`committed`/`released`), `expiresAt`, `purgeAt`,
    índices `{status, expiresAt}` (query del job) y `{referenceType, referenceId}` (release/commit
    por orden).
  - `productVariantSchema` suma `preorderReleaseDate`.
- `apps/api/src/services/inventory.service.ts`: `reserve` / `release` / `commit` /
  `releaseExpiredReservations` / `getAvailability` (el contrato que consume M5), más la superficie
  admin `listItems` / `createItem` / `adjustStock`.
- `apps/api/src/jobs/reservation-reaper.job.ts`: barrido periódico sobre `setInterval(...).unref()`,
  arrancado en `server.ts` después de `connectDb()` y detenido en `shutdown()` antes de
  `disconnectDb()`. **Nunca desde `buildApp()`** — un timer ahí dejaría handles abiertos en supertest.
- Rutas `/api/v1/admin/inventory` con `protect` + `restrictTo("admin","superadmin")` sobre el router
  completo y sin rate limit (§7). Auditoría en alta y en cada ajuste.
- Variables de entorno `STOCK_RESERVATION_TTL_MINUTES` (30), `RESERVATION_REAPER_INTERVAL_MS`
  (60000) y `RESERVATION_RETENTION_DAYS` (30), opcionales con default explícito; un valor malformado
  sigue abortando el arranque.

**Las cuatro decisiones de diseño que sostienen el milestone:**

1. **La condición y el incremento viven en la misma operación de Mongo.** El `$expr` está en el
   *filtro* del `findOneAndUpdate`, no en lógica de aplicación:
   ```ts
   { itemType, itemId, sku, $expr: { $gte: [{ $subtract: ["$onHand", "$reserved"] }, qty] } }
   ```
   Verificado por mutación: al sustituir esa operación por un read-then-write equivalente, el test de
   5 requests simultáneos por 5 unidades pasa a vender 10 y 2 de 2 tests de concurrencia fallan.
2. **El mutex es el documento de reserva, no el contador.** Toda transición terminal reclama primero
   `findOneAndUpdate({_id, status:"held"})` y solo quien reclamó toca `reserved`. De ahí sale la
   idempotencia de `release`/`commit`, que el job y el flujo normal puedan competir por la misma
   reserva, y que la API corra en más de una instancia sin lock distribuido.
3. **El índice TTL va sobre `purgeAt`, no sobre `expiresAt`.** Un TTL sobre `expiresAt` borraría la
   reserva vencida sin devolver las unidades y dejaría `reserved` inflado para siempre — el borrado
   se lleva el único registro de cuánto devolver. `purgeAt` solo se escribe al llegar a estado
   terminal, así que una reserva `held` nunca desaparece sola: si el job se cae, el stock queda
   apartado de más (conservador y visible), no perdido.
4. **Las dos escrituras van dentro de una transacción de Mongo.** Toda operación de este módulo
   escribe en dos colecciones — el documento de reserva y el contador de inventario — y las dos
   tienen que aterrizar o fallar juntas. `withOptionalTransaction` usa `session.withTransaction`
   cuando el despliegue lo soporta (cualquier replica set, o sea todo despliegue gestionado) y cae a
   escrituras compensatorias en un `mongod` standalone. `connectDb()` sondea la topología al arrancar
   y avisa fuerte si encuentra un standalone, en vez de descubrirlo en el primer checkout.

**Verificado:**
```
pnpm --filter @bw-bikes/shared build   → limpio
pnpm typecheck   (incluye tests)       → limpio (shared + api)
pnpm lint                              → limpio
pnpm build                             → limpio
pnpm test                              → 17 archivos, 136/136 tests pasan (Mongo real en memoria,
                                          replica set de un nodo para cubrir el camino transaccional)
pnpm audit --prod                      → sin vulnerabilidades conocidas
node dist/server.js + SIGTERM          → arranca, loguea el reaper y la topología detectada, lo
                                          detiene y sale con código 0 (probado contra standalone y
                                          contra replica set)
```
Los dos criterios de cierre, con su prueba (`inventory-reservations.test.ts`, 19 tests;
`inventory-expiration.test.ts`, 10; `inventory-admin.test.ts`, 20):
1. **Dos requests simultáneos por la última unidad** — `Promise.allSettled` de dos `reserve()`:
   exactamente uno resuelve, el otro recibe 409, `reserved` queda en 1 y `available` en 0. Un test
   hermano lanza cinco reservas de 2 unidades sobre un stock de 5 y solo ganan dos. **El inventario
   nunca queda negativo**: cada caso de concurrencia reasserta `onHand >= 0`, `reserved >= 0` y
   `onHand >= reserved` sobre toda la colección.
2. **Una reserva vencida se libera sola** — con el reaper corriendo de verdad (intervalo de 50 ms
   bajo test), una reserva backdateada vuelve a `reserved: 0` sin que nadie la toque; queda
   `released`, con `purgeAt` sellado y su entrada de auditoría `actorType: "system"`. Una reserva
   vigente y una ya committeada no se tocan, y el barrido compitiendo con un `release` manual
   descuenta exactamente una vez.

**Decisiones tomadas durante la implementación (no estaban explícitas en el plan):**
- **Sin ruta HTTP de reserva.** El checkout es de M5; exponer un endpoint que aparta stock sin orden
  detrás sería superficie que M5 tendría que rediseñar. El test de concurrencia dispara dos
  `reserve()` en paralelo, que es exactamente en lo que colapsan dos requests simultáneos porque el
  controller solo delega en el servicio.
- **Alta manual de filas de inventario** (`POST /admin/inventory`), no auto-provisión desde el
  catálogo — el catálogo de M3 no se toca. La fila sí valida que el triplete resuelva a una variante
  real; `reserved` no se acepta nunca en el payload (es consecuencia de una reserva, no un dato que
  el admin dicte).
- **Ajuste de stock con `onHand` o `delta`, mutuamente excluyentes.** `onHand` sobrescribe (recuento
  físico, donde sobrescribir es la intención); `delta` suma, para que dos admins recibiendo el mismo
  embarque no se pisen (lost update). Ambos guardados por `$expr` para que el ajuste no pueda dejar
  el físico por debajo de lo ya reservado.
- **Transacción con compensación como fallback, no compensación a secas.** `reserve`, `release` y
  `commit` corren dentro de `session.withTransaction` cuando la topología lo permite; contra un
  `mongod` standalone caen a compensar (las líneas ya apartadas se revierten en orden inverso,
  borrando el documento de reserva vía claim atómico, no marcándolo `released` — la reserva se está
  deshaciendo, no concluyendo). La compensación cubre un fallo de negocio, que es el caso que de
  verdad ocurre, pero **no** una caída del proceso, porque un proceso muerto no ejecuta su propia
  compensación. Por eso producción no debe correr standalone y el arranque lo grita.
  Los tests corren sobre `MongoMemoryReplSet` de un nodo precisamente para ejercitar el camino
  transaccional, que es el que corre en producción; contra un standalone habrían probado el fallback
  creyendo que probaban el camino real.
- **`setInterval` y no `node-cron`/BullMQ.** Un job, periodo fijo, sin semántica de calendario ni
  cola que coordinar. Cierra la decisión abierta #2 de la spec a favor de "cron + TTL de Mongo" para
  la fase 1, sin dependencia ni infraestructura nueva.
- **Solo las líneas `in_stock` generan `StockReservation`.** `on_request` y `preorder` no tienen
  unidades que apartar; una "reserva de stock" que no reserva stock sería un registro mentiroso. Su
  estado lo lleva la orden en M5 (`awaiting_supplier_confirmation`).
- **`preorderReleaseDate` en la variante**, no en inventario: es dato de merchandising que el
  storefront pinta en la ficha, y un preorder por definición no tiene fila de inventario que pudiera
  cargarlo.
- El schema de `sku` se movió a `common.validator.ts` y ahora lo comparten catálogo e inventario —
  las dos capas tienen que coincidir en la forma exacta o se podría dar de alta stock para un código
  que ninguna variante puede igualar.

**Requisito de despliegue:** Mongo debe correr como **replica set** (Atlas lo es por definición; un
`mongod` suelto no). Sin él no hay transacciones y el módulo cae al camino compensatorio, que deja
una ventana: si el proceso muere entre el `$inc` de `reserved` y la creación del documento de
reserva, quedan unidades apartadas sin registro que las respalde. `connectDb()` sondea la topología
al arrancar y lo advierte en los logs. La reconciliación automática (comparar `reserved` contra la
suma de reservas vivas) y el umbral de stock bajo con alertas siguen siendo de M11.

**Fuera de este milestone:** carrito, órdenes, Stripe y quién llama a `commit` (M5); ruta pública de
disponibilidad (M12) y UI de inventario (M11); migración de los umbrales a `Settings` (M7).

**Corrección a M1 (detectada después del merge de M4, al crear los archivos de entorno reales):**
`config/env.ts` hacía `import "dotenv/config"`, que carga **únicamente** `.env` desde el directorio
de trabajo. Ningún `.env.development.local` se leía jamás, pese a que los dos `.env.*.example`
instruían "copia esto a `.env.development.local`" — seguir esa instrucción al pie de la letra dejaba
la API abortando por variables faltantes. Ahora el cargador resuelve, desde la raíz del paquete y no
desde `process.cwd()`, primero `.env.<NODE_ENV>.local` y después `.env` como base compartida. Como
`dotenv` nunca pisa una variable ya definida, la precedencia queda
`entorno real del proceso > .env.<NODE_ENV>.local > .env`, que es lo que importa en producción: los
secretos que inyecta el hosting mandan sobre cualquier archivo que viaje dentro de la imagen.
`NODE_ENV` tiene que venir del entorno real porque es quien elige el archivo; sin definir asume
`development`. Verificado con el build de producción: arranque sin inyectar una sola variable (todo
sale del archivo), `MONGODB_URI` inyectada pisando al archivo, y `NODE_ENV=production` seleccionando
`.env.production.local`. Efecto colateral bueno: los tests ya no pueden heredar por accidente un
`.env` suelto del disco, porque `NODE_ENV=test` busca un `.env.test.local` que no existe.

---

## M5 — Carrito, órdenes y pagos ⚠️ módulo crítico

**Entregado:**
- `packages/shared`: `CaptureMethod`, `PaymentState` (vocabulario propio del dominio, no el de
  Stripe), `PaymentProviderName`, `OrderLineSnapshot`, `OrderTotals`, `PaymentSummary`,
  `OrderStatusHistoryEntry`, `PublicOrder`, `AdminOrder`, `CheckoutResult`, y `types/cart.ts` nuevo
  (`CartLineInput`, `PublicCart`, `PublicCartLine`). Once `AuditAction` nuevas de órdenes y pagos.
- `apps/api/src/models/`: `Cart` (una por cliente, índice único por `userId`, TTL de 90 días),
  `Order` + `schemas/order-line.schema.ts` (snapshot inmutable por línea), `PaymentEvent` (dedupe de
  webhooks por índice único en `eventId`, con TTL de retención de 60 días).
- `apps/api/src/services/`:
  - `order-state.ts` — la máquina de estados como **dato**: tabla de transiciones, `canTransition`,
    `assertTransition`, `isTerminal`. Pura, sin I/O.
  - `order-pricing.ts` — `resolveCartLines` (relee el catálogo), `buildLineSnapshots`,
    `calculateTotals` (IVA incluido) y `resolveCaptureMethod` (la regla del carrito mixto).
  - `cart.service.ts` — el carrito no aparta stock y no guarda precios.
  - `order.service.ts` — la saga de checkout, `applyTransition`, las acciones de admin y los
    aplicadores de resultado de pago que comparten webhook y reconciliación.
  - `order-maintenance.service.ts` — los dos barridos de fondo.
  - `payment-webhook.service.ts` — firma → dedupe → despacho, en ese orden.
  - `payments/` — `payment-provider.interface.ts`, `stripe.provider.ts` (el **único** archivo que
    importa el SDK) e `index.ts` (factory + guarda de "no configurado").
- `apps/api/src/jobs/`: `order-authorization.job.ts` y `payment-reconciliation.job.ts`, con el patrón
  exacto del reaper de M4 (intervalo `unref`, guarda anti-solapamiento, arrancados en `server.ts`
  después de `connectDb()` y detenidos primero en `shutdown()`).
- Rutas: `/cart` y `/orders` con `protect`; `POST /orders` con `checkoutRateLimiter` dedicado
  (10/15min); `/admin/orders` con `protect` + `restrictTo` y sin rate limit (§7);
  `POST /api/v1/webhooks/stripe` **montado antes de `express.json`** con `express.raw`.
- Variables de entorno nuevas: `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` (obligatorias en
  producción, opcionales fuera, con `isStripeConfigured` propio), más siete umbrales opcionales con
  default explícito y nota de migración a `Settings` (M7).
- `inventory.service.ts`: **una sola** ampliación al contrato de M4 — `extendHold`.

**Las cinco decisiones de diseño que sostienen el milestone:**

1. **El TTL de checkout (15 min) y la ventana de autorización (7 días) son dos relojes distintos.**
   Un carrito mixto —bici `on_request` + casco `in_stock`— aparta unidades del casco. Si esa reserva
   venciera a los 15 minutos, el reaper devolvería el casco mientras el admin todavía confirma la
   bici con el proveedor, y la captura tendría éxito sobre stock inexistente. Por eso el webhook de
   autorización llama a `inventoryService.extendHold(ref, expiresAt)`, un `updateMany` sobre
   `expiresAt` de las reservas `held`. Es **aditivo**: no toca contadores ni
   `reserve/release/commit`.
2. **La creación de la orden es una saga, no una transacción.** Crear el PaymentIntent es una
   llamada de red, y una transacción de Mongo abierta esperando a un tercero mantiene locks durante
   la caída de otro. Los pasos corren en orden con compensación explícita: sin stock → la orden pasa
   a `cancelled` y se propaga el 409; falla el proveedor → `release()` + `cancelled`. Una caída del
   proceso a mitad no necesita compensación: la reserva vence a los 15 minutos y el job de
   reconciliación cierra la orden huérfana. `withOptionalTransaction` sí se reutiliza —movido tal
   cual de `inventory.service.ts` a `utils/with-transaction.ts`— para las escrituras que sí son
   puramente de base de datos.
3. **El dedupe del webhook es un índice único, y ocurre antes del despacho.** `PaymentEvent.create`
   con `eventId` único: un `findOne`-luego-insert sería un read-then-write y dos reentregas
   simultáneas leerían "no visto" las dos. Dejar que la base rechace el segundo insert es lo que de
   verdad las serializa. Los handlers son idempotentes igual, porque toda transición se valida contra
   el estado actual — dos guardas independientes, que es lo que corresponde en el único lugar donde
   equivocarse significa cobrar dos veces.
4. **Solo `in_stock` se cobra al instante.** Cualquier línea `on_request` **o `preorder`** fuerza
   `capture_method: "manual"` en toda la orden. No se parte la compra en dos pagos: duplicaría el
   checkout, duplicaría la superficie de reembolso y dejaría al cliente con media compra cuando una
   mitad falla.
5. **El precio del catálogo ya incluye IVA.** `taxCents` es un desglose de `totalCents`
   (`round(total × 16/116)`), nunca una suma encima. Cobrar `subtotal + 16%` facturaría a cada
   cliente un 16% por encima del precio que vio en la ficha.

**Correcciones a milestones previos (detectadas al construir M5, no eran features nuevas):**
- **El índice único `{ userId, idempotencyKey }` no puede ser `sparse`.** En Mongo un índice
  compuesto sparse incluye el documento si **cualquiera** de sus campos existe, y `userId` siempre
  existe: la versión sparse indexaba toda orden sin key como `{ userId, null }`, así que un cliente
  que hiciera una segunda compra sin idempotency key chocaba con su propia orden anterior.
  Se usa `partialFilterExpression: { idempotencyKey: { $type: "string" } }`, que es lo que "único por
  cliente, cuando está presente" significa de verdad. Mismo tratamiento para `payment.intentId`.
  Detectado por un test que fallaba con 500, no por revisión.
- El helper de tests de Stripe devolvía un `intentId` fijo, lo que chocaba con el índice único de
  `payment.intentId` en cuanto un test creaba dos órdenes. Ahora genera uno por llamada y **respeta
  la idempotency key** como hace Stripe de verdad: sin eso, el camino de replay del checkout habría
  parecido funcionar mientras acuñaba un segundo cargo.

**Verificado:**
```
pnpm --filter @bw-bikes/shared build   → limpio
pnpm typecheck   (incluye tests)       → limpio (shared + api)
pnpm lint                              → limpio
pnpm build                             → limpio
pnpm test                              → 25 archivos, 255/255 tests pasan (Mongo real en memoria,
                                         replica set de un nodo)
pnpm audit --prod                      → sin vulnerabilidades conocidas
node dist/server.js + SIGTERM          → arranca los tres jobs, los detiene y sale con código 0
```

**Los 7 escenarios end-to-end, contra Stripe en modo test con `stripe listen`** (36 aserciones, todas
verdes; PaymentIntents reales confirmados con `pm_card_visa`, webhooks reales firmados llegando por
el túnel del CLI):

| # | Escenario | Evidencia observada |
|---|---|---|
| 1 | Sobreventa | Dos checkouts simultáneos por la última unidad → 201 y 409; `onHand=1, reserved=1`, nunca negativo |
| 2 | Bajo pedido feliz | PaymentIntent en `requires_capture` con `amount_received=0`; el webhook la mueve a `awaiting_supplier_confirmation`; el admin confirma → `paid` y `amount_received=25000000` |
| 3 | Bajo pedido rechazado | PaymentIntent `canceled`, cero cargo, reserva `released`, `reserved=0` |
| 4 | Expiración | Con el reloj de autorización atrasado, el cron avisa (`adminAlertedAt`), cancela en Stripe y deja la orden en `authorization_expired` con motivo; stock devuelto |
| 5 | Webhook duplicado | `stripe events resend` del mismo `event.id` (verificado en el log del túnel: dos entregas, dos 200) → un solo `PaymentEvent`, una sola entrada `paid` en el historial |
| 6 | Carrito mixto | Una sola orden, dos líneas, `capture_method: manual` en Stripe, monto igual al calculado por el servidor, y **solo** la línea `in_stock` con reserva |
| 7 | Anti-IDOR | La orden ajena responde 404 con cuerpo byte a byte idéntico al de una orden inexistente |

**Decisiones tomadas durante la implementación (no estaban explícitas en el plan):**
- **El carrito no se vacía al crear la orden, sino cuando el pago aterriza** (autorización o
  captura). Perderlo en el instante en que se crea la orden castigaría a todo cliente cuya tarjeta
  luego se rechaza.
- **Un checkout vivo por cliente**: un nuevo intento cancela el `pending_payment` anterior y libera
  sus unidades de inmediato, en vez de esperar los 15 minutos. Si no, un cliente indeciso apartaría
  la misma bici tres veces y bloquearía a compradores reales.
- **`confirmSupplierStock` aplica `paid` con la respuesta síncrona de la captura**, no esperando al
  webhook. La regla "solo el webhook decide pagado" existe para que un **navegador** no declare un
  pago exitoso; una captura es una llamada servidor-a-servidor autenticada cuya respuesta viene del
  proveedor. El webhook llega después y encuentra la orden ya `paid`, así que no hace nada — dos
  caminos, un resultado, sin doble commit. Verificado en test y en el escenario 2.
- **`charge.dispute.created` no cambia el estatus.** Una disputa es un reclamo, no un desenlace; se
  sella `disputedAt` y se audita.
  > **Corrección (auditoría pre-producción, Sesión 3, 2026-08-24):** el supuesto original de esta
  > línea — "si se pierde, el reembolso resultante sí mueve el estatus" — era incorrecto. Stripe
  > **no** emite `charge.refunded` al perder un contracargo; el dinero sale por su propio proceso de
  > chargeback, no por el flujo de reembolso de esta tienda. `charge.dispute.updated`/`.closed`
  > (ausentes hasta M5, cerrados en Sesión 3) persisten el desenlace en `disputeStatus` sin tocar
  > `status`, que se queda en `paid` — y se excluye del ingreso reportado (`orders.stats.ts`) para
  > que Analítica no siga contando dinero que el banco ya retiró. Ver detalle en M10.
- **`delivered` no es terminal**, porque un reembolso todavía puede seguirle. `cancelled`,
  `authorization_expired` y `refunded` sí lo son.
- **Una orden nunca capturada termina en `cancelled` o `authorization_expired`, jamás en
  `refunded`** — no hay dinero que devolver, solo un hold que soltar. Y a la inversa: una orden ya
  cobrada nunca retrocede a `cancelled`.
- **Card only en Stripe** (`payment_method_types: ["card"]`): la captura manual es una función de
  las redes de tarjeta; OXXO y transferencia no pueden retener fondos para capturar después.
  Consecuencia ya aceptada por el cliente (las bicis bajo pedido no ofrecen MSI).
- **El `clientSecret` no se persiste nunca.** En un reintento idempotente se recupera pidiéndole al
  proveedor que cree el pago otra vez con la misma key, que por definición devuelve el original.
- **Sin stub de pagos.** Toda otra integración degrada a algo inofensivo (el mailer loguea, las
  subidas dan 503); un pago falso no puede serlo, porque una orden marcada como pagada por una
  pasarela ficticia es indistinguible de una venta real hasta que alguien busca el dinero.
- **El webhook responde 200 a todo lo que logró verificar**, incluidos eventos ignorados y handlers
  que fallaron: un no-2xx hace que el proveedor reintente, y un handler con fallo determinista
  fallaría para siempre. Solo una firma inválida se rechaza, y esa se rechaza duro.
- **Los totales del carrito solo suman líneas comprables.** Mostrar un total que el cliente no puede
  pagar sería mentir; la línea bloqueada se sigue listando, con su motivo, pero no cuenta.

**Fuera de este milestone:** dirección y costo de envío (M6, decisión abierta #1) — `shippingCents`
existe y vale 0 para que M6 no migre órdenes; migración de los umbrales a `Settings` (M7); correos
reales al cliente (M15 — hasta entonces la auditoría es el registro durable); la cola de confirmación
en el panel (M9) y el checkout visual (M13); cupones, MSI y facturación CFDI (decisión abierta #3).

---

## M6 — Envíos, estatus y solicitudes

**Entregado:**
- **Cierra la decisión abierta #1 (costo de envío).** `shippingService.quote()` (nuevo,
  `apps/api/src/services/shipping.service.ts`), función pura sobre `lineTotalCents`: subtotal ≥
  `FREE_SHIPPING_THRESHOLD_CENTS` → gratis, si no `SHIPPING_ACCESSORY_FLAT_CENTS`. Sin excepción
  explícita para bicis — su propio precio ($80k–$300k MXN) ya rebasa el umbral, así que la regla
  única basta. No lee catálogo ni categorías: cada línea ya trae `itemType` en su snapshot
  inmutable. `calculateTotals` (M5) perdió su constante `SHIPPING_CENTS = 0` fija; ahora recibe el
  monto cotizado como parámetro, tanto en el checkout (`order.service.ts`) como en la vista previa
  del carrito (`cart.service.ts`).
- **Dirección de envío**: `packages/shared` suma `ShippingAddress` (formato mexicano, `MEXICAN_STATES`
  cerrado a 32 estados) y `apps/api/src/models/schemas/shipping-address.schema.ts`. Se captura en el
  carrito (`PUT /api/v1/cart/shipping-address`), **no en el body del checkout** — `createOrderSchema`
  sigue siendo `Joi.object({})`, así que la garantía de M5 de "ningún dato del body del checkout llega
  a la orden" queda intacta. El checkout la copia del carrito como snapshot y responde 400 explícito
  si falta, antes de apartar stock o llamar a Stripe. `PATCH /api/v1/admin/orders/:id/shipping-address`
  permite al admin capturarla o corregirla, bloqueado (409) una vez la orden llegó a `shipped`,
  `delivered` o un estatus terminal.
- **Paquetería, guía y rastreo**: `ShipmentSummary` en shared + `schemas/shipment.schema.ts`
  (`carrier`, `carrierName?`, `trackingNumber`, `trackingUrl`, `shippedAt`). `PATCH
  /api/v1/admin/orders/:id/shipment` con dos comportamientos según el estatus actual: sobre
  `processing`, captura la guía **y** dispara `processing → shipped` en la misma llamada a
  `applyTransition` (una sola entrada de historial); sobre `shipped`/`delivered`, corrige la guía sin
  tocar el estatus. `shippingService.buildTrackingUrl` arma la URL de rastreo a partir de la guía
  para las paqueterías conocidas; `"otro"` exige `carrierName` y `trackingUrl` explícitos.
- **Actualización masiva de estatus**: `PATCH /api/v1/admin/orders/bulk-status` (`orderIds[]`, 1–50,
  `status` restringido a `processing`/`delivered`, `reason?`). Itera sobre `applyTransition` —
  nunca un `updateMany` — y reporta el resultado por orden (`updated`/`unchanged`/`rejected`) sin
  abortar el lote ante un 409 individual. Una entrada de auditoría por orden actualizada, no una del
  lote.
- **Historial de eventos con timestamp**: ya existía (`Order.statusHistory[]`, M5). Lo único nuevo es
  exponer `actorId` en el DTO de admin (`AdminOrderStatusHistoryEntry`) para que el panel diga *quién*
  movió la orden; el DTO público lo sigue omitiendo.
- **Solicitudes de embajador y patrocinio**: una sola colección `Application` (`apps/api/src/models/application.model.ts`)
  discriminada por `type`, con sub-documentos opcionales `ambassador`/`sponsorship` y un validador de
  esquema que exige exactamente el que corresponde al tipo. Máquina de estados propia
  (`services/application-state.ts`, `pending → approved | rejected`, ambos terminales). Rechazo con
  motivo obligatorio; cooldown de reaplicación (`APPLICATION_COOLDOWN_DAYS`, default 90) contado desde
  el rechazo, cerrado ante condiciones de carrera por un **índice único parcial**
  `{ userId, type }` con `partialFilterExpression: { status: "pending" }` — el mismo razonamiento que
  el dedupe de webhooks de M5. Rutas `POST /api/v1/applications/{ambassador,sponsorship}` (solo con
  cuenta, `applicationRateLimiter` 10/15min), `GET /api/v1/applications/mine`, y la bandeja admin
  (`GET /admin/applications`, `GET /admin/applications/:id`, `POST .../approve`, `POST .../reject`).
- **Adjuntos imagen + PDF**: se extiende la cadena de M3 sin tocarla — `utils/magic-bytes.ts` suma la
  firma `%PDF-1.x` (`detectAttachmentFormat`); `middlewares/upload-attachments.ts` nuevo (campo
  `attachments`, 10 MB, hasta 5 archivos); `services/storage/attachment-pipeline.ts` nuevo
  (`prepareAttachment`): imagen pasa por el mismo strip de EXIF que la galería
  (`normalizeImageBuffer`, extraído de `image-pipeline.ts` para reuso), PDF se sube tal cual. El
  rechazo sigue siendo por **contradicción** entre extensión, `Content-Type` y bytes reales, nunca
  solo por firma. `storage.service.ts` sube los adjuntos con `resource_type` `raw` (PDF) o `image`, y
  con **entrega privada** (`type: "authenticated"` de Cloudinary) — una solicitud de embajador trae
  fotos de una persona y una de patrocinio documentos de un tercero, así que la URL nunca es pública
  ni adivinable desde el `publicId`. `buildSignedAttachmentUrl` genera la URL firmada al leer el DTO.
  Nota de alcance: es una URL firmada, no todavía de vida corta — expirar de verdad requiere una
  llave `auth_token` en la cuenta de Cloudinary, pendiente como mejora futura si se quiere esa
  garantía adicional.
- **Sanitización explícita en rutas multipart**: `sanitizeMultipartBody` (ya existía desde M3) se hizo
  **recursivo** (antes solo escapaba claves de primer nivel) — corrección, no feature nueva. Se agregó
  `readOptionalUploadedFiles` para los formularios cuyos adjuntos son opcionales (a diferencia de la
  galería del catálogo, que exige al menos una imagen).
- Variables de entorno nuevas, con default explícito y nota de migración a `Settings` (M7):
  `SHIPPING_ACCESSORY_FLAT_CENTS` (25000 = $250 MXN), `FREE_SHIPPING_THRESHOLD_CENTS` (200000 =
  $2,000 MXN), `APPLICATION_COOLDOWN_DAYS` (90).

**Verificado:**
```
pnpm --filter @bw-bikes/shared build   → limpio
pnpm typecheck   (incluye tests)       → limpio (shared + api)
pnpm lint                              → limpio
pnpm build                             → limpio
pnpm test                              → 28 archivos, 308/308 tests pasan (Mongo real en memoria,
                                          replica set de un nodo)
pnpm audit --prod                      → sin vulnerabilidades conocidas
node dist/server.js + SIGTERM          → arranca los tres jobs de M4/M5 (M6 no agrega jobs propios),
                                          los detiene y sale con código 0
```

Los cuatro criterios de cierre, con su prueba (`order-fulfillment.test.ts`, 22; `applications.test.ts`, 24):
1. **Transición de estatus inválida rechazada** — `PATCH /shipment` sobre una orden en `paid` → 409;
   `bulk-status` a `delivered` sobre una orden en `processing` → `outcome: "rejected"` sin afectar a
   las demás del lote; `bulk-status` con `status: "shipped"` → 400 en el validador.
2. **Solicitud rechazada sin motivo → 400** — `reason` vacío y `reason: "   "`, ambos 400; con motivo
   válido → 200 y `rejectionReason`/`rejectedAt` persistidos.
3. **Reenvío dentro del cooldown rechazado** — reenvío inmediato tras un rechazo → 409; con
   `rejectedAt` retrodatado más allá del cooldown → 201. Caso concurrente: dos envíos simultáneos del
   mismo tipo → exactamente un 201 y un 409, cerrado por el índice único parcial.
4. **XSS en campo de texto multipart queda escapado** — payload `<script>` en `motivation`, verificado
   **contra la DB**, no solo en la respuesta.

**Decisiones tomadas durante la implementación (no estaban explícitas en el plan):**
- **La regla de envío es una sola condición, sin caso especial para bicis.** Nombrar "bicis gratis"
  como regla aparte habría sido redundante: toda bici por sí sola ya rebasa el umbral de $2,000.
- **La dirección se captura en el carrito, no en el body del checkout**, precisamente para no romper
  la garantía estructural de M5 (`createOrderSchema` vacío). Es además el flujo real que va a usar
  M13 (paso de dirección, luego paso de pago).
- **Una sola colección `Application`, no dos.** Embajador y patrocinio comparten el 100% del flujo de
  aprobación (estados, cooldown, adjuntos, bandeja); separarlas habría duplicado esa máquina de
  estados para ganar nada.
- **`bulk-status` excluye `shipped`, `cancelled` y `refunded` a propósito.** `shipped` exige guía por
  orden (solo alcanzable por `recordShipment`); los otros dos mueven dinero y stock, que no es una
  operación de lote.
- **Entrega privada para los adjuntos de solicitudes**, a diferencia de la galería pública del
  catálogo — es el único punto del milestone donde se subió el nivel de exigencia por encima del
  enunciado literal, dado que estos archivos identifican a una persona o a un tercero.

**Fuera de este milestone:** migración de los tres umbrales nuevos a `Settings` (M7); bandeja de
solicitudes en el panel visual (M11); URLs de adjuntos con expiración real vía `auth_token` de
Cloudinary (mejora futura, no pedida); checkout visual con paso de dirección (M13).

---

## M7 — Settings, analítica y adapters de notificación

**Cierra la fase 1.**

**Entregado:**
- **`Settings` singleton editable por secciones** (`apps/api/src/models/settings.model.ts`):
  documento único (`key: "global"`, índice único, creado de forma perezosa en el primer `get()`) con
  seis secciones — `inventory`, `orders`, `pricing`, `shipping`, `applications`, `jobs` — cada una con
  su propio endpoint `PUT /api/v1/admin/settings/:seccion` y su propia `AuditAction`
  (`settings.*_updated`). Nunca un PUT que reemplace el documento entero. `apps/api/src/config/settings.defaults.ts`
  es la única fuente de los valores por defecto, heredados textualmente de los `DEFAULT_*` que vivían
  en `config/env.ts`.
- **Migración real de los trece umbrales acumulados de M4/M5/M6** —
  `STOCK_RESERVATION_TTL_MINUTES`, `RESERVATION_REAPER_INTERVAL_MS`, `RESERVATION_RETENTION_DAYS`,
  `ORDER_PAYMENT_TTL_MINUTES`, `ORDER_AUTH_ALERT_HOURS`, `ORDER_AUTH_CANCEL_HOURS`,
  `ORDER_AUTH_SWEEP_INTERVAL_MS`, `PAYMENT_RECONCILIATION_INTERVAL_MS`,
  `PAYMENT_RECONCILIATION_AFTER_MINUTES`, `TAX_RATE_BPS`, `SHIPPING_ACCESSORY_FLAT_CENTS`,
  `FREE_SHIPPING_THRESHOLD_CENTS`, `APPLICATION_COOLDOWN_DAYS` — eliminados de `config/env.ts`, de los
  dos `.env.*.example` y de `vitest.config.ts`. `shipping.service.ts` (`quote`) y `order-pricing.ts`
  (`calculateTotals`) siguen siendo **funciones puras**: reciben los umbrales como parámetro en vez de
  leer `Settings` dentro, con un default de conveniencia para llamadas aisladas; `inventory.service.ts`,
  `application.service.ts` y `order.service.ts` sí son async y hacen `await settingsService.get()`.
  `STRIPE_WEBHOOK_TOLERANCE_SECONDS` se queda en `env` a propósito: es un control de seguridad
  (ventana anti-replay de firma), no una regla de negocio.
- **`settingsService`** (`apps/api/src/services/settings.service.ts`): `get()` cacheado en proceso con
  TTL de 60s y una sola promesa en vuelo (colapsa lecturas concurrentes en un solo viaje a Mongo).
  `updateSection()` usa `document.save()`, nunca `findOneAndUpdate` — es lo que permite que dos
  escrituras concurrentes a secciones distintas apliquen cada una un `$set` dirigido a sus propios
  paths sin pisarse, y lo que hace que el hook `pre("validate")` del modelo (el invariante
  `orderAuthAlertHours < orderAuthCancelHours`, ya no solo verificado en Joi) se ejecute de verdad.
- **Jobs a `setTimeout` autoreagendado**: los tres (`reservation-reaper`, `order-authorization`,
  `payment-reconciliation`) dejaron el `setInterval` fijo de M4/M5 por un ciclo que relee
  `Settings.jobs` antes de cada tick — un cambio del admin surte efecto en el siguiente tick, no tras
  un redeploy. Desaparece el flag `running`: como el siguiente tick solo se agenda al terminar el
  anterior, un barrido lento no puede solaparse consigo mismo por construcción. Una lectura de
  `Settings` fallida cae al default en vez de dejar el job sin reagendar.
- **Stats por módulo con ventana compartida**: `apps/api/src/utils/stats-range.ts`
  (`parseStatsRange`, hermano de `parseListQuery`) resuelve `{preset, from, to}` una sola vez por
  request — presets `today|7d|30d|90d|custom`, tope de 365 días, `from < to` obligatorio.
  `apps/api/src/services/stats/`: `orders.stats.ts` (conteo por estatus, ingresos — solo estatus con
  dinero capturado, ticket promedio, órdenes por día), `inventory.stats.ts` (unidades comprometidas
  dentro de la ventana; SKUs agotados/bajo umbral **fuera** de ella, expuestos también para
  `alerts.stats.ts`), `applications.stats.ts` (enviadas por `createdAt`, aprobadas/rechazadas por el
  momento de la decisión). Endpoints `GET /api/v1/admin/stats/{orders,inventory,applications,preferences,alerts}`.
- **Alertas operativas fuera del filtro de fechas** (`stats/alerts.stats.ts`): firma **sin** `range` a
  propósito — órdenes en cola de proveedor, autorizaciones por vencer y órdenes `pending_payment`
  atrasadas reutilizan literalmente los mismos umbrales y funciones (`alertThreshold`,
  `reconciliationThreshold`) que ya usan los jobs de fondo, más solicitudes `pending` y SKUs agotados.
- **Analítica de preferencias, sin dimensión "disciplina"**: decisión de Manuel al planear — todo el
  catálogo es ciclismo, así que no existe "disciplina más vendida". `preferences.stats.ts` entrega
  cuatro rankings (modelos y tallas, más vistos y más vendidos, top 10). Los dos de "más vendidos"
  salen enteros del snapshot inmutable de `Order.lines` — el módulo de órdenes sigue sin leer jamás el
  catálogo. Los de "más vistos" sí hacen un lookup acotado (≤10 ids, máximo dos queries) porque
  `ProductView` no guarda nombre/marca.
- **Vistas de producto anónimas**: `apps/api/src/models/product-view.model.ts` (sin `userId`, sin IP,
  TTL de 90 días fijo en el índice — no configurable desde `Settings`, documentado en el modelo).
  `POST /api/v1/catalog/views`, público, con `productViewRateLimiter` propio (300/15min, además del
  `publicReadRateLimiter` del router) y **silencio anti-enumeración**: id inexistente, producto
  archivado o SKU que no resuelve a una variante real responden el mismo 202 genérico que un evento
  válido, sin persistir nada.
- **`/admin/stats/overview`, al final, por composición pura**: resuelve `parseStatsRange` una vez y
  reparte el mismo objeto a los cuatro módulos más `alerts.stats.ts` sin ventana. Cero agregación
  propia.
- **`mailer` y `notifier` con factory**: `services/mailer/index.ts` pasa de stub duro a factory con
  aviso único por proceso (`logger.warn`) cuando no hay proveedor — M15 registra Resend sin tocar
  `auth.service.ts`. `services/notifier/` (nuevo): misma forma, interfaz `notifyAdmin({kind, title,
  body, meta})`, stub que loguea a `warn`. Único punto de llamada: `order-maintenance.service.ts` en
  `alertExpiringAuthorizations`, justo donde ya se sella `adminAlertedAt` — no se inventan emisiones
  nuevas.
- **Datos fiscales opcionales (decisión abierta #3, cerrada parcialmente)**: `BillingInfo` en
  `packages/shared` (`rfc`, `legalName`, `cfdiUse`, `taxRegime`, `postalCode`, catálogos `CFDI_USES`/
  `TAX_REGIMES` cerrados). Se captura en el carrito (`PUT /api/v1/cart/billing-info`), nunca en el
  body del checkout — mismo patrón que la dirección de envío de M6 — y se copia como snapshot a la
  orden. Ningún PAC integrado; el RFC se agrega a la redacción de `config/logger.ts` por ser PII.
- Fila de `docs/superpowers/specs/…-design.md` actualizada: decisión abierta #3 → cerrada
  parcialmente (se capturan datos, sin timbrado); decisión abierta #4 (Sentry) → cerrada a favor,
  implementación baja a M15.

**Verificado:**
```
pnpm --filter @bw-bikes/shared build   → limpio
pnpm typecheck   (incluye tests)       → limpio (shared + api)
pnpm lint                              → limpio
pnpm build                             → limpio
pnpm test                              → 31 archivos, 324/324 tests pasan (Mongo real en memoria,
                                          replica set de un nodo)
pnpm audit --prod                      → sin vulnerabilidades conocidas
node dist/server.js + SIGTERM          → arranca los tres jobs (ahora releyendo Settings), detecta
                                          replica set, los detiene y sale con código 0
```

Los tres criterios de cierre, con su prueba (`settings.test.ts`, 6; `stats.test.ts`, 5;
`product-views.test.ts`, 5):
1. **Editar una sección de Settings no pisa otra** — `PUT /shipping` y `PUT /orders` en paralelo
   (`Promise.all`), releídos directo de la base: los cuatro valores de `orders` y los dos de
   `shipping` quedan correctos, y `pricing`/`inventory` conservan sus defaults intactos. Un caso
   hermano manda un campo de otra sección en el body y confirma que Joi `stripUnknown` lo descartó
   antes de llegar al servicio.
2. **Stats de dos módulos del mismo panel usan la misma ventana** — `GET /admin/stats/overview?preset=7d`:
   el `range` que hace eco cada uno de los cuatro módulos es **idéntico** (`toEqual`) al `range` del
   overview. Una orden sembrada hace 30 días en `awaiting_supplier_confirmation` sigue apareciendo en
   `alerts.awaitingSupplierConfirmation` incluso con `preset=today`.
3. **Evento de vista con id inexistente responde éxito genérico sin persistir nada** — un id
   inexistente, un producto archivado y uno real devuelven el **mismo cuerpo** byte a byte;
   `ProductView.countDocuments()` contra la base confirma que solo el evento válido escribió.

**Decisiones tomadas durante la implementación (no estaban explícitas en el plan):**
- **No existe la dimensión "disciplina" en la analítica de preferencias** — decisión de Manuel: todo
  el catálogo es ciclismo, así que "disciplina más vendida" no aporta información. Se quedó en
  modelos y tallas, lo que además evitó tener que denormalizar categoría en el snapshot de línea.
- **`updateSection` usa `document.save()`, no `findOneAndUpdate`** — la única forma de que el hook
  `pre("validate")` del modelo corra de verdad (Mongoose no ejecuta middleware de documento en
  `findOneAndUpdate`, ni con `runValidators: true`) y, a la vez, la única forma de que dos escrituras
  concurrentes a secciones distintas no puedan pisarse: `save()` envía un `$set` dirigido solo a los
  paths modificados en memoria.
- **El invariante de `Settings.pre("validate")` usa `this.invalidate(path, msg)`, no `next(new Error())`**
  — es lo que garantiza que Mongoose levante un `mongoose.Error.ValidationError` de verdad (que
  `error-handler.ts` mapea a 400); un `Error` genérico pasado a `next()` desde un hook de documento se
  propaga tal cual y el handler lo trataría como 500.
- **El TTL de `ProductView` es una constante del modelo, no una sección de `Settings`** —
  `expireAfterSeconds` se fija al crear el índice; cambiarlo exige recrear el índice, no es del mismo
  tipo de operación que escribir un documento.
- **`mailer`/`notifier` avisan una sola vez por proceso**, no en cada llamada — un `warnedOnce`
  módulo-local, para que el modo stub sea visible en el log de arranque sin inundarlo en cada correo o
  alerta.
- **Un solo punto de llamada para `notifier`** (`alertExpiringAuthorizations`), no uno por cada alerta
  operativa — el resto ya se expone por `/admin/stats/overview`; inventar más emisiones habría sido
  una feature no pedida.
- **`resetSettingsCache()` se agregó a `tests/setup.ts`**, mismo patrón que `resetRateLimiters()` —
  sin él, el caché en proceso de 60s sobreviviría al `deleteMany` entre tests y un test posterior
  leería un snapshot obsoleto en vez de lo que la base realmente tiene.

**Fuera de este milestone:** timbrado CFDI real (ningún PAC integrado — decisión abierta #3 sigue
parcialmente abierta como decisión de negocio, no como pendiente técnico); Sentry (decisión #4 sí,
pero implementación en M15); adapters reales de Resend/Telegram (M15); panel visual de Settings y
analítica (M11).

---

## M8 — Shell del dashboard

**Arranca la fase 2.** `apps/web` estaba vacío desde M1; este milestone es el scaffolding real.

**Entregado:**
- **Scaffolding de `apps/web`**: Next 16.3 (App Router, Turbopack) + React 19.2 + TypeScript estricto
  (extiende `tsconfig.base.json`) + Tailwind v4 (`@theme` CSS-first). Integrado a los scripts raíz
  (`build`/`lint`/`typecheck`/`test` vía `pnpm -r`, más `dev:web` hermano de `dev:api`).
  `.env.development.example` / `.env.production.example` versionados (`API_URL`, server-only, sin
  `NEXT_PUBLIC_*`); `.env.*.local` y `.next/` ya cubiertos por `.gitignore`.
- **Transporte por proxy, no CORS directo**: `next.config.ts` reescribe `/api/v1/:path*` hacia
  `API_URL`. El navegador solo conoce el origen del dashboard — las cookies `HttpOnly`+`Secure`+
  `SameSite=strict` y host-only del backend llegan como cookies same-origin, sin tocar
  `apps/api/src/utils/cookies.ts` ni debilitar `allowedOrigins`. `corsMiddleware` y `verifyOrigin`
  siguen intactos, protegiendo el acceso directo a la API.
- **Tokens de marca** (`src/app/globals.css`): traducción completa de `handoff/tokens.css` +
  `handoff/tailwind.config.snippet.js` a `@theme` — colores (negro/blanco/grafito/dorado + estados de
  botón), tipografía (`text-display`…`text-badge` con line-height/letter-spacing), espaciado de 8px,
  radios. Fuentes Hanken Grotesk (3 pesos) vía `next/font/local`. Se agregaron tres tokens de estado
  semántico (`estado-exito/advertencia/error` + variantes `-soft`) que no existían en el sistema de
  diseño — el badge de estatus operativo necesita más semántica que negro/blanco/grafito/dorado, y el
  dorado es acento exclusivo del CTA. **Pendiente de tu revisión de diseño**, documentado también en
  el comentario del propio `globals.css`.
- **`lib/auth/session.ts`**: `requireAdminSession()`, el guard server-side. Sin cookie → `redirect`;
  `/auth/me` no-OK o inalcanzable → `redirect` a login (nunca un 500); rol fuera de
  `admin`/`superadmin` (ej. un `customer` con sesión válida) → `redirect` a `/admin/sin-acceso`, ruta
  distinta del login. `lib/api/server.ts` (`serverApiFetch`, `cache: "no-store"` siempre, reenvía
  `Cookie` a mano porque un fetch de servidor no la adjunta solo) y `lib/api/client.ts` (`apiFetch`,
  mismo origen gracias al proxy) comparten el mapeo `fail`/`error` → `ApiError` vía
  `lib/api/parse-response.ts`.
- **Login de dos pasos** (`admin/login/`): `LoginForm.tsx` maneja las tres ramas reales del backend
  — sin 2FA, 2FA ya enrolado (pide TOTP), 2FA sin enrolar (arranca `2fa/enroll/start`, renderiza QR
  con `qrcode` desde el `otpauthUrl` + secreto en texto). Cierra el pendiente que M2 dejó
  explícitamente para el dashboard. Countdown de los 5 minutos de la cookie de challenge con reset a
  credenciales al expirar (UX, no control de seguridad — el backend sigue siendo quien de verdad
  rechaza la cookie vencida).
- **Shell** (`components/shell/`): `Sidebar` (fija en desktop, drawer en móvil vía
  `MobileNavContext`, cierra sola al cambiar de ruta) + `TopBar` + `Breadcrumbs` (derivados de
  `usePathname` contra el mapa `{slug: label}` de `lib/nav.ts`) + `CommandPalette` con `Cmd/Ctrl+K`,
  **lazy** de verdad (el `dynamic()` solo se monta tras la primera apertura, `everOpened` gatea el
  `import()`). Nav completa con los 7 destinos reales de la fase 2 (Inicio/Órdenes/Catálogo/
  Inventario/Solicitudes/Analítica/Configuración), cada uno con una página placeholder
  (`PlaceholderPage`) que anuncia su milestone real. El rinoceronte aparece **una sola vez en todo el
  panel**: en `/admin/login`, junto al eyebrow — nunca dentro del shell, por decisión ya tomada en
  `DESIGN_SYSTEM.md` §5.
- **Componentes base** (`components/ui/`): `Button` (4 variantes × 6 estados reales, `loading`
  conserva ancho), `Input` (label/error/helper con `aria-describedby`/`aria-invalid`), `Badge`,
  `Modal` (`role="dialog"`, focus trap, Escape, overlay), `Toast`+`ToastProvider` (`aria-live`, máx 3,
  auto-dismiss por variante, error sin auto-dismiss), `DataTable` (deliberadamente tonto — no decide
  estados de carga/vacío, eso es de la página), `Pagination` (consume `ApiResponseMeta` de
  `packages/shared`), `Skeleton` + presets, `EmptyState`, `ErrorBoundary`, `PageHeader`.
  `hooks/use-focus-trap.ts` reutilizado por `Modal` y `CommandPalette`.

**Verificado:**
```
pnpm --filter @bw-bikes/shared build   → limpio
pnpm typecheck   (shared + api + web)  → limpio
pnpm lint        (api + web)           → limpio
pnpm build       (shared + api + web, con API_URL en el entorno) → limpio
pnpm test        (api + web)           → api: 33 archivos, 344/344; web: 6 archivos, 24/24
pnpm audit --prod                      → sin vulnerabilidades conocidas
```
Los dos criterios de cierre están cubiertos por test, no solo por inspección manual
(`src/lib/auth/session.test.ts`): sesión inválida (sin cookie, `/auth/me` rechaza, o la API está
inalcanzable) → siempre `redirect` a `/admin/login`, nunca un 500; un `customer` con sesión
**válida** → `redirect` a `/admin/sin-acceso`, ruta distinta; `admin`/`superadmin` → el guard
devuelve el usuario. `src/app/admin/login/LoginForm.test.tsx` cubre las tres ramas del login
(directo al panel, pide TOTP, pide enrolamiento con QR).

**Pendiente, no automatizable en este entorno:** el checklist manual con la API viva (login real →
QR → TOTP → panel; confirmar en DevTools que el proxy relaya `Set-Cookie` correctamente) quedó
preparado en el plan pero no se ejecutó aquí por no contar con una instancia de Mongo real en este
entorno — los tests automatizados de `apps/api` sí corren contra Mongo real en memoria, pero el
servidor de desarrollo necesita una URI real. Ejecutarlo antes de mergear.

**Decisiones tomadas durante la implementación (no estaban explícitas en el plan):**
- **`vitest ^4.1.10` + `@vitejs/plugin-react ^5.2.0` + `vite ^7.3.6` explícitos** — `vitest`
  necesitaba `test.projects` (nativo desde v3) para separar los tests `node` de los `jsdom` sin un
  archivo de workspace aparte; `@vitejs/plugin-react` en su versión más reciente (6.x) exige
  `vite ^8`, que solo existe en beta. Se fijó `@vitejs/plugin-react@5.2.0` (soporta `vite ^7` estable)
  en vez de arrastrar una dependencia en beta a un monorepo de producción.
- **`pnpm.packageExtensions` en el `package.json` raíz, inyectando `vitest` como peer opcional de
  `@testing-library/jest-dom`** — `apps/api` (vitest 2.x) y `apps/web` (vitest 4.x) conviviendo en el
  mismo workspace hacían que pnpm resolviera la carpeta de "hoist" compartida (`.pnpm/node_modules/`)
  con la versión de `apps/api`, y como `jest-dom` no declara `vitest` como peer, su `declare module
  "vitest"` (los matchers `toHaveClass`, `toBeInTheDocument`, etc.) terminaba aumentando el tipo
  equivocado — `tsc` compilaba pero cada matcher de jest-dom era un error de tipos. La extensión
  fuerza a pnpm a crear una instancia de `jest-dom` con el `vitest` correcto de `apps/web` inyectado.
- **Imports relativos en `apps/web` sin sufijo `.js`**, a diferencia de `apps/api`. `tsconfig.json`
  usa `moduleResolution: "bundler"` (lo que exige Next), y aunque `tsc` acepta el sufijo `.js` sobre
  archivos `.ts` bajo ese modo, Turbopack (el bundler real de `next build`) resuelve rutas relativas
  de forma literal y no encuentra un `server.js` que no existe. Se detectó con un `next build` real,
  no con `tsc` ni con Vitest.
- **`eslint.config.js` usa las exportaciones flat nativas de `eslint-config-next`
  (`eslint-config-next/core-web-vitals`) en vez de `FlatCompat`** — la traducción de nombres legacy
  (`"next/core-web-vitals"`) vía `FlatCompat` producía un `TypeError: Converting circular structure to
  JSON` con ESLint 9.39 + Next 16. Next 16 ya publica sus configs como arrays flat listos para
  spread, sin capa de compatibilidad.
- **Cinco componentes reescritos para no llamar `setState` sin condición dentro de un efecto**
  (`LoginForm`, `MobileNavContext`, `CommandPalette`, `CommandPaletteWrapper`) — regla nueva
  `react-hooks/set-state-in-effect` de `eslint-plugin-react-hooks` 6 (empaquetada con
  `eslint-config-next` en Next 16). Se migró al patrón documentado de React "ajustar estado durante
  el render" (comparar contra un `prev` guardado en estado) en vez de un `useEffect` que solo
  sincroniza estado interno, no un sistema externo. El único efecto real que sí sobrevive
  (`LoginForm`, el countdown del challenge de 2FA) se dejó como efecto porque sí sincroniza con un
  reloj — se le quitó únicamente el `setState` incondicional de su rama "deshabilitado".
- **Bug real encontrado por el build, no por el linter**: un comentario en `globals.css` contenía
  literalmente `*/` dentro del texto (`--color-*/--text-*`), cerrando el comentario CSS a la mitad y
  corrompiendo el resto del bloque `@theme`. Lo detectó el parser de CSS de Turbopack en `next build`;
  ni `tsc` ni `eslint` lo ven porque no tocan `.css`.
- **`afterEach(cleanup())` agregado a `vitest.setup.ts`** — `@testing-library/react` no registra
  limpieza automática para Vitest (a diferencia de Jest); sin esto, cada `render()` de un `it()`
  posterior se apilaba sobre el DOM del anterior, y `LoginForm.test.tsx` empezó a fallar con
  "multiple elements" al tener varias pruebas en el mismo archivo.

**Fuera de este milestone:** cualquier página de negocio real (órdenes, catálogo, inventario,
solicitudes, analítica, configuración) — los siete destinos de la nav son placeholders, M9–M11 los
reemplazan. Storefront público (M12–M14). `proxy.ts` de Next (no hace falta — el guard vive en el
layout server-side). Ajuste de `app.set("trust proxy", ...)` a dos saltos para producción con el
proxy delante — anotado para el momento del despliegue, no aplica en desarrollo. Playwright / pruebas
contra servicios externos reales (siguen pospuestas al recorrido final de la fase, según lo acordado).

---

## M9 — Órdenes y cola de confirmación de proveedor

**Backend:** sin cambios (M5/M6/M7 ya exponían todo lo necesario). Reemplaza el placeholder de
`/admin/ordenes` de M8.

**Entregado:**
- **`SlideOver`** (`apps/web/src/components/ui/SlideOver.tsx`), componente nuevo que
  DASHBOARD_GUIDELINES.md §5 especificaba por nombre y M8 no había construido. Mismo contrato de
  accesibilidad que `Modal` (`role="dialog"` + `aria-modal` + `aria-labelledby`, Escape/overlay
  cierran, foco atrapado con `useFocusTrap` y devuelto al disparador) pero panel lateral (~480px)
  con body de scroll independiente del header/footer — lo que el detalle de una orden necesita y
  el `Modal` centrado de 448px no da cómodamente. `Modal` se conserva para los diálogos de
  confirmar/rechazar, que sí son decisiones cortas de sí/no.
- **Lógica de dominio pura** (`apps/web/src/lib/orders/`): `status.ts` (labels en español y
  variante de `Badge` para los 10 `OrderStatus`, ambos como `Record` exhaustivo por tipo — agregar
  un estatus sin actualizarlos rompe `tsc`, no falla en silencio); `authorization-deadline.ts`
  (`authorizationDeadline`, proyección pura hacia adelante desde `payment.authorizedAt` de los
  mismos umbrales que ya usa el job de expiración, con niveles `ok`/`critical`/`expired`);
  `format.ts` (moneda MXN, fecha/hora `es-MX`).
- **Capa de acceso a datos** (`apps/web/src/lib/api/admin-orders.ts`): un wrapper por endpoint
  admin de órdenes, con querystring por whitelist explícita (nunca reenvía el estado de filtros
  completo) y **tipado honesto**: `confirmSupplierStock`/`rejectSupplierStock`/
  `recordOrderShipment`/`updateOrderShippingAddress` devuelven `PublicOrder`, no `AdminOrder` —
  exactamente lo que esos cuatro endpoints serializan de verdad (sin `customer`, `adminAlertedAt`,
  `cancelReason`, `paymentIntentId`) — así el compilador bloquea un optimistic-update que lea un
  campo que esa respuesta no trae.
- **La página** (`apps/web/src/app/admin/(panel)/ordenes/`): `page.tsx` (Server Component) resuelve
  `GET /admin/settings` una vez para pasar `orderAuthAlertHours`/`orderAuthCancelHours` ya
  resueltos, sin round-trip de cliente. `OrdersView.tsx` (Client, el orquestador) seis piezas:
  tabs **Cola de proveedor** (fija `status=awaiting_supplier_confirmation`, `sort=createdAt`
  ascendente como proxy de urgencia — el whitelist de sort del backend no incluye
  `payment.authorizedAt`) / **Todas** (filtros libres) → `OrderFilters` (solo lo que el backend
  soporta: estatus, `orderNumber` exacto, los 3 campos de sort — sin buscador libre, sin filtro de
  fecha/cliente/monto, porque `listForAdmin` los ignora o no existen) → doble layout con
  `DataTable` → `Pagination` → `OrderDetailSlideOver` cargado con `next/dynamic` (`ssr:false`,
  gateado por un latch `everOpenedDetail`, mismo patrón que `CommandPaletteWrapper` de M8).
- **`ConfirmSupplierDialog`/`RejectSupplierDialog`**: viven en `OrdersView`, no en la fila ni en el
  detalle, porque ambos disparadores (la fila de la cola y el pie del `SlideOver`) deben abrir la
  **misma** instancia. El de confirmar advierte en texto explícito que captura el cargo real; el
  de rechazar valida motivo (5–300 caracteres, trim) en el cliente espejando
  `rejectSupplierStockSchema`, con contador de caracteres.
- **`ShipmentForm`/`ShippingAddressForm`**: el primero solo exige `carrierName`/`trackingUrl`
  cuando `carrier === "otro"` (misma condición que `recordShipmentSchema`); el segundo alimenta su
  `<select>` de estado con `MEXICAN_STATES` de `@bw-bikes/shared`, nunca una lista duplicada.
- **`BulkStatusBar`**: solo aparece con selección en la pestaña "Todas", limitado a
  `processing`/`delivered` (lo único que `PATCH /orders/bulk-status` acepta). Como ese endpoint
  **siempre responde 200**, el resultado se lee de `summary` y se reporta con un toast que separa
  actualizadas/sin cambio/rechazadas.
- **Sin endpoint individual de cambio de estatus**: el backend no lo expone. Los botones "Marcar en
  preparación"/"Marcar entregada" del `SlideOver` llaman a `bulkUpdateOrderStatus` con un arreglo
  de un solo id — documentado como comentario en el código para que no se lea como bug.
- **Refetch, nunca optimistic update**: toda acción (confirmar, rechazar, guía, dirección, estatus)
  hace `toast` + refetch de la lista y, si el detalle de esa orden está abierto, de su detalle
  también — consecuencia directa de que las cuatro acciones no devuelven `AdminOrder` completo.

**Verificado:**
```
pnpm --filter @bw-bikes/shared build   → limpio
pnpm typecheck   (shared + api + web)  → limpio
pnpm lint        (api + web)           → limpio
pnpm build       (shared + api + web, con API_URL en el entorno) → limpio
pnpm test        → api: 33 archivos, 344/344 (sin regresiones) · web: 14 archivos, 61/61
pnpm audit --prod                      → sin vulnerabilidades conocidas
```
Tests nuevos de `apps/web` (8 archivos): `authorization-deadline.test.ts` (niveles `ok`/`critical`/
`expired` con los umbrales reales 120h/156h, los dos bordes exactos, `null` sin `authorizedAt`),
`status.test.ts` (los 10 `OrderStatus` tienen label y variante), `admin-orders.test.ts` (querystring
solo con params de la whitelist, `ApiError` con `httpStatus` en un `fail`), `SlideOver.test.tsx`
(abre/cierra, Escape, overlay, foco atrapado y devuelto), `RejectSupplierDialog.test.tsx` (motivo de
4 caracteres bloquea el envío, uno válido dispara la llamada con el texto recortado),
`ShipmentForm.test.tsx` (`carrier="otro"` exige `carrierName`+`trackingUrl`, los otros 6 no),
`OrdersView.test.tsx` (estado vacío de la cola, fila renderizada, y el flujo completo de confirmar:
POST real → toast → refetch de la lista, con `fetch` mockeado).

**Mergeado a `main`** (commit `c9e2677`). La whitelist de IP en Atlas, que bloqueaba levantar
`apps/api` en esta máquina, ya se resolvió (Network Access → Add IP Address con la IP pública
correcta — la que estaba puesta había quedado desactualizada por IP dinámica).

**✅ Verificación manual contra Stripe test — cerrada en la auditoría pre-producción, Sesión 3
(2026-08-24).** Pospuesta aquí a propósito, retomada en `apps/api/src/scripts/seed-batch-orders.ts`
(sucesor de `verify-m9-stripe.ts`, que en efecto no sobrevivió entre sesiones como se anticipaba):
22 órdenes reales contra Stripe test-mode (`stripe listen --api-key ... --forward-to
localhost:4000/api/v1/webhooks/stripe`), cubriendo los 9 `OrderStatus` alcanzables más las dos
resoluciones de contracargo. Cada orden se releyó de Mongo después de correr — no autoreportada —
y las 22 coincidieron con su objetivo. Detalle completo en la sección M10 de abajo (la verificación
pendiente de M9 se resolvió como parte del cierre de esa sesión, tal como este mismo renglón ya
preveía) y en el plan de auditoría (`~/.claude/plans/el-dashboard-ya-esta-encapsulated-whale.md`,
"Sesión 3 — resultado").

**Incidente de sesión, para quien retome:** durante el cierre de M9 un `git branch <nombre>` sin
`-f` falló en silencio porque la rama ya existía (de un checkout previo), y el siguiente comando
(`git branch -f feat/m08-dashboard-shell dde22ca`) dejó los commits de M9 sin ninguna rama
apuntándolos — recuperados con `git branch -f feat/m09-ordenes <hash>` sobre el commit huérfano
(`git fsck --dangling` los encontró intactos). Nada se perdió, pero es una lección para el protocolo
de cierre: **verificar con `git branch -a` que el nombre de rama no exista ya** antes de crearlo,
sobre todo si el chat anterior lo dejó creado sin usar.

**Decisiones tomadas durante la implementación (no estaban explícitas en el plan):**
- **`SlideOver` reusa `useFocusTrap` de `Modal`** en vez de un hook de foco propio — misma garantía
  de accesibilidad, cero código nuevo para mantenerla sincronizada entre los dos.
- **Patrón "ajustar estado durante el render" para el fetch de la lista**, no `setState` directo al
  inicio del `useEffect` — `react-hooks/set-state-in-effect` (regla nueva de
  `eslint-plugin-react-hooks` 6, ya activa desde M8) lo rechaza. Se compara una clave serializada de
  `effectiveParams` contra la del render anterior (mismo patrón que `MobileNavProvider` de M8) para
  decidir si resetear a `loading`; un refetch disparado por una acción (confirmar/rechazar/etc.) dejó
  `requestKey` sin cambios a propósito, así la tabla no parpadea a un skeleton completo después de
  cada acción — solo se reemplazan las filas en cuanto llega la respuesta.
- **`OrderRowActions` ofrece "Ver detalle" en las dos pestañas**, no solo en "Todas" — el plan
  original solo mencionaba confirmar/rechazar para la cola, pero decidir sin ver las líneas, el
  cliente y el historial de una orden bajo pedido es una decisión a ciegas; el costo de agregarlo
  es un botón `text` por fila.
- **`markSingleStatus`/`handleBulkStatus` leen `summary`/`results[0]`, nunca el código HTTP**, para
  reflejar correctamente que `bulk-status` siempre responde 200 — un `try/catch` a secas habría
  reportado éxito en una transición rechazada.

**Fuera de este milestone:** catálogo en admin (M10); inventario, solicitudes, settings y analítica
visuales (M11); gráficos/KPIs de la referencia de Dribbble (M11 — librería de charts sin decidir);
rediseño del Sidebar a dos columnas (cambio transversal al shell, se decide aparte); reembolsos y
cancelación de órdenes ya pagadas (el backend no los expone al admin — decisión cerrada en la
auditoría Sesión 3: se queda así a propósito, ver M10); búsqueda libre, filtro por
fecha/cliente/monto (el backend no los soporta); correos al cliente (M15).

---

## M10 — Catálogo en admin

**Backend:** dos colecciones nuevas independientes de bicis/accesorios (`Brand`, `Badge`), dos
sistemas de plantilla (`SpecTemplate`, `SizeTemplate`) y una migración one-off (`migrate-brands.ts`,
de la marca como string libre a referencia). Todo sobre el patrón CRUD ya establecido en M3.

**Entregado:**
- **`Brand`** (`apps/api/src/models/brand.model.ts`): nombre, slug, logo opcional en Cloudinary. Bike
  y Accessory pasan de `brand: string` a `brand: ObjectId` (`ref: "Brand"`) — de ahí el script de
  migración, que resuelve cada string existente a una marca nueva o reutilizada.
- **`Badge`** (`apps/api/src/models/badge.model.ts`): catálogo de insignias ("Nuevo", "E-Bike") con
  variante visual, reutilizable entre productos. `MAX_PRODUCT_BADGES = 1` — bajado de 3 a 1 durante
  la iteración de diseño de M10.5, con `BadgesPicker.tsx` como selector único en el editor.
- **`SpecTemplate`** (`apps/api/src/models/spec-template.model.ts`): plantillas de ficha técnica por
  categoría, con `source: "manual" | "auto"` — una plantilla `auto` se aprende sola la primera vez
  que un producto de esa categoría guarda un grupo de ficha que no existía, sin bloquear nunca la
  escritura que la dispara. El editor de ficha técnica (`SpecSheetEditor.tsx`) permite agregar,
  renombrar, reordenar y borrar grupos y campos libremente; la plantilla solo sugiere.
- **`SizeTemplate`** (`apps/api/src/models/size-template.model.ts`): plantillas de talla, con el
  mismo patrón de auto-aprendizaje, separadas por catálogo (bicis / accesorios) porque sus rangos de
  talla no tienen nada en común. `Category.usesSizes: boolean` (default `true`) marca qué categorías
  ofrecen selector de talla al crear un producto — una categoría de "Herramientas" no lo necesita.
- **Editor de ficha técnica y de variantes** (`SpecSheetEditor.tsx`, `VariantsEditor.tsx`): grupos y
  campos libres para la ficha; variantes con SKU, talla, color, `fulfillmentMode`
  (`in_stock`/`on_request`/`preorder`) y tope de `MAX_VARIANTS = 40`.
- **Galería** (`ProductImage[]`, tope `MAX_GALLERY_IMAGES`) más, solo en bicis, una **imagen de
  geometría** separada (`geometryImage`) — deliberadamente fuera de la galería general, con sus
  propios endpoints de subir/reemplazar/borrar.
- **Selector de accesorios sugeridos** (`relatedAccessories: ObjectId[]` en `Bike`): validado contra
  el catálogo real de accesorios (`bike.service.ts`), no una lista libre.
- **Los dos CRUD de categorías**, independientes (`BikeCategory` / `AccessoryCategory`), cada uno con
  su propio árbol de máximo dos niveles (raíz + hijas, sin recursión más profunda —
  `category.service.ts` lo rechaza en el servicio, no en el esquema) y su propio namespace de slugs.
- **Archivar/restaurar** en vez de borrado directo (`isActive` + `archivedAt`), con `DELETE`
  disponible aparte para el borrado real; `catalog-product-deletion.test.ts` cubre ambos caminos.
- **La página** (`apps/web/src/app/admin/(panel)/catalogo/`): listas de bicicletas y accesorios como
  **rejilla de tarjetas con foto** (imagen 4:3, nombre, marca · categoría, badge, precio, pie con
  Editar/Archivar) — las únicas dos listas del catálogo con foto; marcas, badges, fichas técnicas y
  categorías siguen siendo tabla, que es lo correcto para listas densas sin imagen. El editor de
  producto se presenta como flujo de **5 pasos** (`EditorStepper.tsx`) en vez de un formulario largo.
- **Sistema de botones ampliado**: de 4 a **5 variantes × 4 tonos × 6 estados** — se suma `bare`
  (controles repetidos en una fila, sin el borde de `ghost`) y los tonos `danger`/`danger-strong`
  (dos intensidades del mismo rojo: suave y reversible para Archivar, sólido e irreversible para
  Eliminar) y `inverse` (controles sobre superficie oscura). Componentes nuevos: `ButtonGroup`,
  `ButtonLink` (un `<a>` con estilo de botón, nunca `<Link><Button/></Link>` anidando `<button>` en
  `<a>`), `CloseButton`, `Tabs`/`TabList`. Cuarta capa de profundidad `inset` (#EAEAE6) agregada al
  sistema para paneles anidados dentro de una tarjeta.
- **`Combobox`** (`components/ui/Combobox.tsx`): selector de categoría con búsqueda, reemplaza el
  `<Select>` que duplicaba la raíz como opción y como etiqueta de `<optgroup>`.

**Verificado:**
```
pnpm --filter @bw-bikes/shared build   → limpio
pnpm -r exec tsc --noEmit              → limpio
pnpm --filter @bw-bikes/api lint && pnpm --filter @bw-bikes/web lint   → limpio
pnpm --filter @bw-bikes/api test       → 39 archivos, 413/413
pnpm --filter @bw-bikes/web test       → 45 archivos, 272/272
pnpm -r build (con API_URL)            → limpio
pnpm audit --prod                      → sin vulnerabilidades conocidas (override de nanoid a ^3.3.18,
                                          ver decisiones abajo)
```
**✅ Verificación manual pendiente de M9 — cerrada en la auditoría pre-producción, Sesión 3
(2026-08-24), varias sesiones después de quedar "en curso" aquí.** El criterio que M9 dejó pospuesto
(confirmar/rechazar de verdad contra Stripe test) se resolvió sembrando **22 órdenes reales** vía
`apps/api/src/scripts/seed-batch-orders.ts` — no un script sintético contra la API admin, sino el
mismo camino cliente→checkout→Stripe→webhook que usa un comprador real, más las transiciones de
admin (confirmar/rechazar proveedor, captura, envío, entrega) llamando a `orderService` en proceso
por la pared del TOTP que un script no puede cruzar (ver el propio header del script). Corrida real
contra `stripe listen`, verificada releyendo cada orden de Mongo al terminar, no autoreportada:

| # | Objetivo | Resultado real | Notas |
|---|---|---|---|
| 1–2 | `pending_payment` | ✅ `pending_payment` | Cliente desechable propio por orden — ver por qué abajo |
| 3–4 | `awaiting_supplier_confirmation` | ✅ | |
| 5 | `authorization_expired` | ✅ | Vía el sweep real de `orderMaintenanceService.cancelExpiredAuthorizations` |
| 6–7 | `cancelled` | ✅ | Rechazo de proveedor real (`rejectSupplierStock`) |
| 8–10 | `paid` | ✅ | Captura automática e instantánea (2) + confirmación de proveedor (1) |
| 11–13 | `processing` | ✅ | |
| 14–16 | `shipped` | ✅ | |
| 17–18 | `delivered` | ✅ | |
| 19–20 | `refunded` | ✅ | Reembolso real vía `stripe.refunds.create`, webhook `charge.refunded` real |
| 21 | `dispute_won` | ✅ `paid` + `disputeStatus: won` | `pm_card_createDispute` real + evidencia `winning_evidence`, resuelto por Stripe en ~6s |
| 22 | `dispute_lost` | ✅ `paid` + `disputeStatus: lost` | `pm_card_createDispute` real + `disputes.close`, resuelto en ~1s |

Dos defectos del propio script de siembra, encontrados y corregidos **antes** de esta corrida (no
detectados en M9/M10 porque el script no existía todavía): `cancelStalePendingOrders`
(`order.service.ts`) cancela cualquier `pending_payment` anterior del mismo cliente en cada
checkout — con un solo cliente compartido para las 20+ compras, la orden #1 nunca habría
sobrevivido a la #2. Cada `pending_payment` ahora usa una cuenta de un solo uso. Y el retrodatado de
`createdAt` (para que Inicio/Analítica tengan datos de dos semanas) se excluyó deliberadamente de
las `pending_payment`: el job real de reconciliación de pagos las resuelve solo, en su propio reloj
(~20-30 min), igual que a un checkout abandonado real — retrodatarlas habría sembrado un estado que
el sistema nunca puede producir por sí mismo.

**Notificaciones — resultado real, no supuesto:** Telegram (`order.authorized`/`order.paid`/
`order.dispute_closed`) configurado y sin errores en el log de la corrida. Los correos
transaccionales al cliente (`sendOrderPaidEmail`, `sendShipmentNotification`,
`sendOrderDeliveredEmail`, `sendRefundConfirmedEmail`) **fallaron los 22/22** con un 403 de Resend:
la cuenta usada en este entorno de prueba solo puede mandar correo a su propia dirección verificada
(`bwbikes2026@outlook.com`), no a `TEST_CUSTOMER_EMAIL`. No es una regresión — el manejo de errores
(`.catch()` best-effort en cada callsite) funcionó exactamente como está diseñado y ninguna orden se
detuvo por esto — pero significa que la entrega real de estos 5 correos sigue sin verificarse en
este entorno. Para cerrarla de verdad: verificar un dominio en Resend, o apuntar `TEST_CUSTOMER_EMAIL`
a `bwbikes2026@outlook.com` en una corrida futura. Los correos de alerta al admin
(`sendAdminAlertEmail`, "nueva venta"/contracargo perdido) tampoco se pudieron verificar por
separado — `ADMIN_ALERT_EMAIL` no está configurado en este entorno, gap preexistente sin relación
con Stripe.

Verificación visual de `/admin/ordenes` en el panel: bloqueada para mí por el 2FA obligatorio de la
cuenta admin (TOTP real, que solo el autenticador de Manuel puede producir) — confirmado hasta la
pantalla de "Ingresa el código de 6 dígitos", sin errores de consola, con los cambios de esta sesión
(badge de contracargo en el detalle de orden) ya compilados. El recorrido visual del panel con las
22 órdenes y las dos disputas queda como el único paso manual real pendiente, para Manuel.

**Decisión de reembolsos, cerrada en la auditoría Sesión 3 (2026-08-24):** `refundPayment` existía
en `PaymentProvider`/`stripeProvider` pero ningún controller lo llamaba — el único camino real hacia
`orderService.markRefunded` siempre fue el webhook `charge.refunded`. Decisión con Manuel: **no**
construir un flujo de reembolso admin-iniciado; el reembolso se hace desde el Dashboard de Stripe y
llega vía webhook, como ya funcionaba. Razón, no solo pereza: exigir las credenciales de Stripe para
mover dinero de vuelta es un control más fuerte que una sesión de admin del panel. `refundPayment` se
eliminó del provider y de la interfaz como código muerto — verificado con las órdenes #19–20
(`refunded`) de la tabla de arriba, el flujo sigue intacto sin ese método.

**Decisiones tomadas durante la implementación (no estaban explícitas en el plan):**
- **`brakeType` salió del sistema por completo** — nunca filtró nada en la práctica (ausente del
  validador de lista, de `buildFilter` y de cualquier índice), era un enum obligatorio decorativo.
  Sin migración de datos: el valor queda huérfano en documentos existentes y se recaptura como fila
  de ficha técnica libre.
- **Tope de badges bajado de 3 a 1**, decisión visual tomada viendo la rejilla de tarjetas en
  navegador: tres badges dorados diluían el único acento de la vista.
- **Flake de la suite de API, diagnosticado y corregido en esta sesión de cierre**: no era timeout
  (`testTimeout` ya estaba en 20s) — cuatro corridas completas fallaron cada una en un archivo
  distinto, con tres síntomas distintos (401 espurio, aserción, `socket hang up`). La causa real es
  que cada uno de los 39 archivos levanta su propio `MongoMemoryReplSet` más un servidor HTTP; en 10
  núcleos eso agota recursos bajo paralelismo completo. Arreglo:
  `poolOptions.forks.maxForks: 4` en `apps/api/vitest.config.ts` — 413/413 verde, reproducible en
  corridas sucesivas.
- **Override de `nanoid` a `^3.3.18`** (`pnpm.overrides` en `package.json`), por una vulnerabilidad
  alta transitiva vía `next → postcss → nanoid@3.3.17` (GHSA-2v37-7h3g-55p8). Pineado a la línea 3.x
  a propósito: un rango abierto `>=3.3.18` resuelve a nanoid 6, que es ESM-only, mientras postcss 8
  lo requiere como CJS `^3`.

**Fuera de este milestone:** inventario, solicitudes, settings y analítica visuales (M11); visor de
auditoría restringido a `superadmin` (M11); campanita de notificaciones (descartada, ver M11 —
sustituida por tarjetas de alerta); rediseño del Sidebar a dos columnas (cambio transversal, se
decide aparte); arreglar el `search` roto de `/admin/applications` (no tocado por M10, deuda
existente); reconciliar la fila de inventario cuando se renombra un SKU (la clave es
`{itemType,itemId,sku}`, un rename deja la fila huérfana — conocido, sin resolver).

---

## M11 — Inventario, solicitudes, settings, analítica, auditoría

Último milestone de la fase 2: cierra el dashboard de administración. Llena las cinco rutas que M8
dejó reservadas (`/admin`, `/admin/inventario`, `/admin/solicitudes`, `/admin/configuracion`,
`/admin/analitica`) más una sexta que no existía en ningún lado (`/admin/auditoria`, primera ruta
`restrictTo("superadmin")` del proyecto — el rol se separó en M2 justo para esto).

**Backend nuevo — dos superficies que no existían:**
- **Lectura de auditoría** (`audit-log.service.ts` solo tenía escritura): `listAuditLogs(query)`,
  validador (`action` contra la unión real de `AuditAction`, no texto libre), controlador, ruta
  `GET /admin/audit-logs` montada bajo `restrictTo("superadmin")`. Índices nuevos en `AuditLog`
  (`{createdAt:-1}`, `{module:1,createdAt:-1}`) porque los existentes solo servían consultas por
  `targetId`.
- **Umbral de stock bajo movido a `Settings.inventory.lowStockThresholdUnits`** (default 5,
  reemplaza la constante privada hardcodeada de `stats/inventory.stats.ts`), con override opcional
  por SKU en `InventoryItem.lowStockThreshold`.

**El modelo de inventario, corregido a mitad de diseño por Manuel:** el plan original incluía un
cuarto número derivado ("comprometido"). La regla real del negocio es que el inventario descuenta
**al momento del pago**, no al crear la orden — `commit()` ya hacía exactamente eso desde M4. Lo
pagado y sin despachar es un estado de la orden (`paid`/`processing`), no del inventario; sumarlo ahí
habría contado la misma unidad dos veces. La pantalla terminó con tres números reales:
`onHand` ("En bodega"), `reserved` ("Apartado", solo por un checkout en curso sin pagar) y
`available` (el único que consume la tienda). Las variantes `on_request` no tienen fila de
inventario ni reserva — se muestran como "Bajo pedido", nunca como "Agotado".

**Entregado:**
- **`GET /admin/inventory` enriquecido**: DTO con `product`/`variant` resueltos (nombre, marca,
  imagen, talla, color, `fulfillmentMode`), filtro `stock=low|out` (umbral por SKU con fallback al
  global), filtro por categoría raíz (expande a sus hijas, mismo patrón que `product.service.ts`),
  `available` como campo ordenable. `GET /admin/inventory/summary` nuevo, conteos por categoría raíz
  sin traer todas las filas.
- **Stock inicial al crear un producto**: `variants[].initialStock` en el payload de creación de
  bici/accesorio, solo para variantes `in_stock`. `createBike`/`createAccessory` ahora escriben dos
  colecciones (producto + una `InventoryItem` por variante) dentro de `withOptionalTransaction` —
  las dos aterrizan juntas o ninguna. En edición el campo es de solo lectura a propósito: un campo
  editable ahí pisaría en silencio cualquier ajuste hecho desde `/admin/inventario` mientras el
  formulario estaba abierto, sin auditoría. `VariantsEditor.tsx` gana el modo `mode: "create"|"edit"`
  para esto; el "Ajustar" en modo edición **no se construyó** (ver "Fuera de este milestone").
- **`/admin/inventario`** — la única de las seis pantallas que pasó por el flujo `shape` de
  `impeccable` antes de construirse (las otras cuatro llegaron descritas como tabla+columnas, ver
  nota de deuda de diseño abajo). Tres zonas de peso decreciente: **Reposición** (los SKUs en/bajo
  umbral, peor primero — no un contador, la lista), **Por categoría** (dos pestañas Bicicletas/
  Accesorios, bandas por categoría raíz sin envoltorio de tarjeta, colapsadas si sanas y abiertas si
  tienen problemas) y **Captura** (`Registrar entrada` dorado, único acento de la vista — selector de
  variante, nunca SKU libre a mano). Fila con `Disponible` como cifra dominante y `En bodega ·
  Apartado` subordinado en `caption`, visible solo cuando `reserved > 0`. Ajuste por delta (por
  defecto) o absoluto, motivo obligatorio en la UI aunque el backend lo deje opcional.
- **`/admin/solicitudes`**: tabs por estatus (Pendientes con badge de conteo / Aprobadas /
  Rechazadas) + filtro de tipo, `SlideOver` de detalle, rechazo con motivo 5–300 caracteres.
- **`/admin/configuracion`**: seis `SettingsSectionCard` independientes, cada una su propio
  formulario con envío/error propios — hace visible en la UI la garantía de que guardar una sección
  no toca las otras cinco.
- **`/admin` (Inicio)**: fila de 4 `AlertCard` (pedidos entrantes, stock agotado, problemas con
  órdenes, solicitudes pendientes) en vez de campanita de notificaciones — decisión tomada con Manuel
  viendo que centralizar cuatro alertas distintas en un solo dropdown las vuelve indistinguibles.
  Debajo, `StatsRangePicker` + 4 `StatCard` + gráfico de órdenes por día + top-5 más vendidos.
  **Revertida el 2026-08-20**: la campanita del `TopBar` ahora sí abre un panel
  (`NotificationsPopover`), pero agrupado por categoría con su propio color — reutiliza la misma
  clasificación de `OperationsStrip` (`buildAlertDescriptors`) en vez de una lista plana mezclada,
  que era justo lo que se había rechazado. `OperationsStrip` (que reemplazó los 4 `AlertCard` en el
  rediseño de Inicio de agosto 2026) sigue siendo la vista completa; la campanita solo agrega acceso
  rápido desde cualquier pantalla, sin Solicitudes (no es una venta).
- **`/admin/analitica`**: una sola llamada a `GET /admin/stats/overview` (resuelve la ventana una vez,
  la comparte entre módulos), cuatro barras rankeadas (top 10), tabla de órdenes por estatus,
  `StatCard`s de inventario/solicitudes.
- **`/admin/auditoria`** (nueva, `superadmin` únicamente): filtros de módulo/acción/rango de fechas,
  tabla, `SlideOver` con `before`/`after` formateados. Solo lectura, sin acciones.
- **Gráficos hechos a mano en SVG, sin librería** (`components/charts/`: `chart-theme.ts`,
  `ChartCard.tsx`, `OrdersByDayChart.tsx`, `RankedBarChart.tsx`) — decisión tomada durante el
  milestone, ver "Cambios de alcance" abajo. Una sola serie por gráfico siempre: `validate_palette.js`
  del skill `dataviz` confirma que este sistema no tiene paleta categórica (grafito+dorado falla como
  categórica, el trío `estado-*` falla por contraste) y no se le puede inventar una sin romper la
  regla del acento único. La barra `#1` de cada ranking lleva el único dorado con su valor etiquetado;
  el resto va en grafito sin etiqueta, con `<title>` nativo al hover.
- **Gating por rol, capa nueva completa**: `NavItem.roles?`, `Sidebar`/`CommandPalette` filtran por
  `user.role`, `requireSuperadminSession()` en el servidor (la barrera real es
  `restrictTo("superadmin")` en la API; esto solo evita el 403 feo).
- Cinco módulos nuevos en `apps/web/src/lib/api/` (`admin-inventory`, `admin-applications`,
  `admin-settings`, `admin-stats`, `admin-audit-logs`), cada uno con whitelist explícita de query
  params espejando el schema Joi correspondiente.

**Verificado:**
```
pnpm --filter @bw-bikes/shared build   → limpio
pnpm -r exec tsc --noEmit              → limpio
pnpm --filter @bw-bikes/api lint && pnpm --filter @bw-bikes/web lint   → limpio
pnpm --filter @bw-bikes/web test       → 58 archivos, 330/330
API_URL=http://localhost:4000 pnpm -r build   → limpio, 26 rutas (ver bug de build abajo)
pnpm audit --prod                      → sin vulnerabilidades conocidas
```
**API — sin corrida 100% limpia al momento de escribir esto:** tres corridas completas de
`pnpm --filter @bw-bikes/api test` (44 archivos) dieron cada una **un solo archivo distinto** roto
(`catalog-product-deletion.test.ts`, `settings.test.ts`, `order-fulfillment.test.ts` en corridas
separadas) — mismo patrón de contención por recursos ya diagnosticado y corregido al cerrar M10
(`poolOptions.forks.maxForks: 4`), reapareciendo porque el conteo de archivos creció de 39 a 44.
Ninguno de los tests que fallaron pertenece a este milestone, y el propio `git status` durante esta
sesión mostró archivos de mailer/Stripe modificados que no son míos — consistente con otra sesión
trabajando en paralelo sobre el mismo checkout. Se deja como flake conocido, sin re-tunear
`maxForks` todavía; si vuelve a aparecer de forma consistente en el mismo archivo, deja de ser flake.

**Bug de build encontrado y corregido durante este milestone:** `pnpm -r build` fallaba con
`TypeError: createContext is not a function` al recolectar datos de `/admin`. Diagnosticado por
bisección con `next build --debug-build-paths` (no por intuición): no era Turbopack, no era la
versión de Recharts (falló igual con v3 y v2), no era ninguna de las otras cinco pantallas — era
`AlertCard.tsx`, que importaba `ArrowRight` de `@phosphor-icons/react` (variante cliente) en vez de
`@phosphor-icons/react/ssr`. Al ser importado directo por `page.tsx` (Server Component), Next evalúa
`AlertCard` como Server Component también, y el `createContext()` interno del paquete cliente rompe
bajo la condición `react-server`. Corregido cambiando el import.

**Cambios de alcance decididos durante la implementación:**
- **Recharts, removido por completo** en favor de SVG hecho a mano. El plan original decía Recharts;
  la investigación del bug de arriba mostró que el paquete no está marcado `"use client"` y sigue
  siendo un riesgo latente para cualquier uso futuro cerca de un Server Component, incluso ya
  corregido el bug puntual de `AlertCard`. Sin dependencia de charts, cero riesgo de esa clase.
- **`VariantsEditor` en modo edición no gana "Ajustar"**: el plan lo dejaba como un solo componente
  `StockAdjustDialog` reusado entre inventario y catálogo. Se construyó el `StockAdjustDialog` y se
  usa en `/admin/inventario`; enlazarlo también desde la edición de producto se dejó fuera para no
  desestabilizar `ProductEditor.tsx`, que sigue evolucionando. El stock se ajusta desde
  `/admin/inventario`, que es la pantalla dueña de esa operación.
- **`StatCard.tsx` no se tocó.** Existe desde antes de este milestone (construido en una sesión
  concurrente) con un acento `border-l-4` — un side-stripe, prohibición absoluta del skill
  `impeccable`. Queda documentado como deuda; no se corrigió unilateralmente porque es infraestructura
  compartida fuera de la propiedad de M11.
  **Resuelto en el rediseño de Inicio (2026-08):** con M11 ya cerrado, `StatCard` deja de ser
  infraestructura ajena. El stripe se reemplaza por un punto de 8px junto al eyebrow (ver
  `DESIGN.md` §5, Cards); `StatCardSkeleton` se actualiza en el mismo cambio para que loading →
  loaded no salte de layout.

**Deuda de diseño heredada:** solo `/admin/inventario` pasó por el flujo `shape` de `impeccable`
completo. Las otras cinco pantallas se construyeron sobre patrones ya validados por M9/M10
(tabla + filtros + `SlideOver`, formularios independientes) sin una sesión de diseño dedicada —
riesgo más agudo en Inicio y Analítica, donde el reflejo de categoría ("panel admin → KPIs →
gráfico") es más fuerte.

**Fuera de este milestone:** `search` roto de `/admin/applications` (deuda ya conocida, no tocada);
~~`revenueByDay` en stats~~; historial de movimientos de stock; exportación a CSV; ~~comparación contra
periodo anterior~~; reconciliar la fila de inventario huérfana al renombrar un SKU; estado de filtros
en la URL; rediseño del Sidebar a dos columnas; un campo `allowBackorder` propio (se reusa
`fulfillmentMode: "on_request"`); un tercer contador `allocated` en `InventoryItem` (no existe —
ver corrección del modelo de datos arriba); cambiar `fulfillmentMode` desde inventario (se edita en
`VariantsEditor`). Ninguna operación de git — este trabajo queda sin commitear, a la espera de
revisión y aprobación explícita de Manuel.

**Resuelto en el rediseño de Inicio (2026-08):** `revenueByDay` (`OrdersStats.ordersByDay[].revenueCents`,
`orders.stats.ts`) y la comparación contra el periodo anterior (`OrdersStats.previous`, misma ventana
que el rango solicitado) — ambos tachados arriba. Ver `apps/api/src/services/stats/orders.stats.ts`
y `packages/shared/src/types/stats.ts`.

---

## M12 — Catálogo público 🚧 en progreso

Arranca la fase 3. `apps/web` solo tenía `/admin` hasta ahora — `app/page.tsx` redirigía a
`/admin` con un comentario literal de que el storefront llegaría en M12–M14. Por decisión explícita
de Manuel, la home se construye **sección por sección** (navbar → hero → tipo de bicis → banner de
marca → bestseller → comprar bicis/accesorios → favoritos de los clientes → descubre tu bici →
sucursal → footer), cada una su propia entrega revisable, sin archivos de miles de líneas.

Diseño: `handoff/Black_and_White_Bikes_Mockups.pdf` (pantalla 01 = Home) y
`handoff/DESIGN_SYSTEM.md` §5.1–5.2 (reglas del rinoceronte por pantalla) ya existían al arrancar
— el brainstorming de M12 los usó como fuente visual en vez de re-diseñar desde cero.

### Entrega 1/10 — Shell del storefront + Navbar

**Entregado:**
- `apps/web/src/app/(storefront)/layout.tsx` + `page.tsx`: abre `/` como route group público
  (`SkipLink` + `Navbar` + `<main>`). `app/page.tsx` (el redirect a `/admin`) se borró — las dos
  rutas habrían colisionado en `/`. `/admin` no cambia: sigue su propio `metadata` y su propio
  guard, sin tocar.
- `apps/web/src/components/storefront/`: `Navbar` (Server Component, compone el resto),
  `Wordmark`, `StorefrontNavLinks` (`"use client"`, estado activo vía `usePathname`),
  `NavbarActions` (Buscar/Cuenta/Carrito), `MobileMenu` (`"use client"`, drawer con focus trap —
  mismo patrón que `Sidebar` del admin, sin `MobileNavContext` porque nada más en este shell
  necesita el estado del drawer).
- `apps/web/src/lib/storefront-nav.ts`: los cuatro destinos del mockup (Bicicletas, Eléctricas,
  Accesorios, Compromiso) y `isStorefrontNavItemActive` (prefix match, mismo criterio que
  `Sidebar`'s `isItemActive` del admin).
- `SkipLink.tsx` ganó un `targetId` opcional (default `"panel-content"`, el storefront pasa
  `"contenido"`) — reuso, no duplicado.
- `app/layout.tsx`: la `metadata` raíz pasa de describir el panel admin a describir el sitio
  público (el admin ya tenía la suya propia desde M8, así que no pierde nada).

**Bug real encontrado y corregido en la verificación visual:** en 390px (iPhone estándar), Buscar +
Cuenta + Carrito + hamburguesa (cuatro cuadros de 44px) no cabían junto al wordmark — Carrito y el
menú se salían de la pantalla. `NavbarActions` oculta Buscar/Cuenta bajo `md` con `max-md:hidden`
(Carrito y el menú siempre visibles — el patrón estándar de e-commerce). Un primer intento con
`hidden md:inline-flex` falló en silencio: chocaba con el `inline-flex` que `Button` ya trae
incondicionalmente en `CONTROL_CLASSES` — dos utilidades sin prefijo peleando por `display` en el
mismo elemento, exactamente el caso que `lib/cn.ts` documenta ("generated-CSS order, not string
order"). `max-md:` es una variante con media query, así que gana siempre sin ambigüedad.

**Verificado:**
```
pnpm --filter @bw-bikes/shared build   → limpio
pnpm typecheck   (shared + api + web)  → limpio
pnpm lint                              → limpio (1 warning preexistente, no relacionado)
pnpm --filter @bw-bikes/web test       → 4 archivos nuevos, 15/15 pasan
pnpm build                             → limpio, `/` sale como ruta estática
```
Verificación visual con Playwright contra un build de producción limpio (`next build` + `next
start`, no `next dev` — el CLI de captura de Edge headless resultó no confiable contra Turbopack en
dev, capturaba antes del pintado completo): desktop con navbar completa, móvil cerrado (Carrito +
hamburguesa sin overflow, Buscar/Cuenta ocultos), móvil con el drawer abierto mostrando los cuatro
enlaces.

**Decisiones tomadas durante la implementación (no estaban explícitas en el plan):**
- **"Eléctricas" apunta a `/bicicletas?categoria=electrica`, no a una ruta propia.** El árbol real
  de categorías (`GET /catalog/bike-categories/tree`) hoy solo tiene datos de prueba ("Ruta"/
  "Endurence", sin "Eléctrica" todavía) — el slug es el que se espera que use la categoría real
  cuando Manuel la capture, no uno verificado en vivo. Revisar `storefront-nav.ts` si termina
  siendo otro.
- **Cuenta y Carrito quedan `disabled`, no omitidos.** Son de M13; renderizarlos ya con su
  proporción final evita que M13 tenga que re-maquetar la barra — solo cambia cada `Button` por un
  control real.
- Iconos de Phosphor: `@phosphor-icons/react/ssr` en los Server Components de este shell
  (`NavbarActions`), `@phosphor-icons/react` (entrada normal) en los Client Components
  (`MobileMenu`) — mismo patrón que `QuickLinks.tsx`/`StatCard.tsx` del admin.

**Fuera de esta entrega:** las nueve secciones de la home (placeholder en `page.tsx` por ahora);
`publicApiFetch` (nace en la entrega 3, la primera que consume datos); el footer (entrega 10).

> **Revisión (ronda 2, 2026-08-24):** al revisar la entrega 1, Manuel pidió un rediseño con
> `orbea.com/es-mx` de referencia — logo centrado, enlaces a la izquierda, subrayado dorado creciendo
> desde el centro, navbar transparente sobre el hero que se vuelve sólido al hacer scroll. Registro de
> diseño: `brand`, no el `product` que declara `PRODUCT.md` — ese archivo describe el panel admin; la
> superficie en foco aquí es pública, donde el diseño *es* el producto.
>
> **El subrayado ya existía.** `DESIGN.md` §5 lo especifica literal ("subrayado que crece desde el
> centro") y `Button.tsx`/`ButtonLink.tsx` ya lo implementan en la variante `text`. El bug real era que
> `StorefrontNavLinks.tsx` renderizaba un `<Link>` con clases a mano en vez de `ButtonLink
> variant="text"` — arreglarlo no necesitó CSS nuevo. Se agregó una prop `active` a
> `ButtonStyleOptions` (aditiva, default `false`, el admin no cambia) para fijar el subrayado en el
> enlace de la sección actual — la variante `text` solo tenía estado hover, no "activo persistente".
>
> **Enlaces: Bicicletas · Accesorios · Ofertas** (antes cuatro). Eléctricas sale (cabe como filtro de
> categoría dentro de Bicicletas); Compromiso se mueve al footer (entrega 10). "Ofertas" es un enlace
> nuevo sin backend detrás todavía: `compareAtPrice` sí está en el DTO público, pero
> `publicProductListQuerySchema` no acepta ningún filtro "en oferta" — trabajo de API pendiente para
> quien construya esa página.
>
> **Layout:** `grid-cols-3` (no `flex justify-between`) — con lados de ancho muy distinto (tres
> enlaces contra tres íconos), un flex centra el logo *entre los bloques*, no en el viewport. El
> logo real queda pendiente; `Wordmark.tsx` sigue con las letras "B/W" como punto de intercambio.
> `MobileMenu` pasa a entrar desde la izquierda (antes derecha), porque su botón ahora vive en la
> columna izquierda junto al nav de escritorio.
>
> **Transparente sobre el hero, sólido al scrollear** — mecanismo nuevo, no existía ningún patrón de
> scroll en `apps/web`: `apps/web/src/hooks/use-navbar-overlay.ts` (`useNavbarOverlay`), moldeado
> sobre `use-media-query.ts`. Contrato: cualquier sección se marca a sí misma con
> `data-navbar-overlay`; el hook usa `IntersectionObserver` con `rootMargin: "-64px 0px 0px 0px"`
> (la altura del navbar) para decidir si esa sección todavía cruza la banda bajo la barra. Estado
> inicial derivado de `usePathname()` contra `NAVBAR_OVERLAY_ROUTES` (hoy solo `/`), para que el HTML
> de servidor ya salga correcto y no parpadee. El navbar pasa de `sticky` a `fixed`, y renderiza su
> propio espaciador de 64px — omitido en rutas overlay, donde el hero debe empezar en `y=0` bajo la
> barra transparente.
>
> **Bug preexistente encontrado y corregido: el anillo de foco dorado nunca se veía sobre fondo
> oscuro, en ningún lugar del sitio.** No es de esta entrega — vive en `globals.css` desde antes, pero
> se volvió visible al verificar el punto 7 del checklist (anillo de foco en ambos estados del
> navbar). Causa: la regla global `:focus-visible { outline: ... negro }` en `globals.css` no estaba
> dentro de ningún `@layer`, y por spec de CSS cascade layers un estilo sin capa gana **siempre**
> sobre cualquier utilidad de Tailwind (capeada en `theme/base/components/utilities`),
> independientemente de cuánta especificidad tenga esa utilidad — `focus-visible:outline-dorado`
> (`Button.tsx`, tono `inverse`) perdía contra el negro fijo en todo control sobre fondo oscuro,
> incluido el botón "Cerrar sesión" del `Sidebar` admin. Arreglo de una línea: envolver la regla en
> `@layer base`. Verificado con Playwright leyendo `getComputedStyle(...).outlineColor` antes/después
> del fix: `rgb(10,10,10)` (negro, roto) → `rgba(242,183,6,...)` (dorado, correcto) sobre el navbar
> transparente; el estado sólido se confirmó intacto en negro.
>
> **Verificado (esta ronda):**
> ```
> pnpm --filter @bw-bikes/shared build   → limpio
> pnpm typecheck   (web)                 → limpio
> pnpm --filter @bw-bikes/web lint       → limpio (1 warning preexistente, no relacionado)
> pnpm --filter @bw-bikes/web test       → 433/434 (el 1 roto es de CategoryFormModal.test.tsx,
>                                           preexistente, sesión ajena, no tocado)
> pnpm --filter @bw-bikes/web build      → limpio
> ```
> Visual con Playwright contra `next build` + `next start` (no `next dev`, ver nota de la entrega 1):
> transparente arriba del hero, hover con subrayado dorado en ambos estados, sólido tras scrollear
> más allá del hero (900px con hero `min-h-svh`), móvil 390px sin overflow con hamburguesa/logo/
> carrito, drawer entrando desde la izquierda, anillo de foco dorado sobre transparente y negro sobre
> sólido, `/admin` intacto.
>
> Dos lecciones de proceso, para la próxima entrega: (1) `pkill -f "next start"` no mata el proceso
> real — Next lo renombra a `next-server (v16.3.0)` vía `process.title`, invisible a ese patrón; hay
> que matar por PID. Un servidor de producción que sobrevive así sirve HTML **cacheado en memoria**
> de antes del rebuild, indistinguible de un bug real hasta que se compara el timestamp del proceso
> contra el del build. (2) El placeholder de `page.tsx` necesitó `min-h-screen` (no `min-h-[60vh]`)
> para que hubiera suficiente alto de scroll y el mecanismo transparente→sólido fuera demostrable de
> verdad, no solo clampeado al tope de la página.
>
> **Ajuste (ronda 3, 2026-08-24):** pulido visual pedido por Manuel tras ver la ronda 2 — enlaces más
> a la izquierda, texto más grande, íconos más grandes con hover dorado.
> - **Enlaces a la izquierda:** el contenedor tenía `mx-auto max-w-6xl`, un gutter centrado de ~150px
>   en pantallas anchas antes de que empezara el primer enlace. Se quitó el cap de ancho — el navbar
>   ahora es edge-to-edge (`px-lg lg:px-2xl`), como `orbea.com`.
> - **Texto de los enlaces más grande:** el label se envuelve en un `<span className="text-body-l">`
>   propio en vez de subir el tamaño vía `className` del `ButtonLink` — la variante `text` ya fija
>   `text-ui` en el `<a>`, y dos utilidades de tamaño sin prefijo en el mismo elemento son la misma
>   trampa de orden de generación que `max-md:hidden` (ver arriba). Un tamaño en un hijo, en cambio,
>   solo sobrescribe el valor heredado — sin carrera.
> - **Íconos más grandes:** `icon-lg` fija el glifo en 20px vía una clase en un `<span>` interno de
>   `ButtonContent` que el `className` del caller no puede alcanzar. Se resolvió pasando
>   `style={{width:24,height:24}}` directo al ícono de Phosphor — un `style` inline gana sobre
>   cualquier regla de hoja de estilos externa apuntando al mismo elemento, sin depender del orden de
>   generación de Tailwind.
> - **Hover dorado en Buscar/Cuenta/Carrito, en ambos estados del navbar:** `bare`+`neutral` hoy
>   hoverea a negro (correcto para las acciones de fila del admin, no para este nav). Cambiarlo en
>   `Button.tsx` habría afectado cada botón `bare` del panel. Además, los tres íconos siguen
>   `disabled` (M13 los activa), y `disabled:text-*` gana por defecto sobre un `hover:*` plano del
>   mismo nivel — perdería contra el estado disabled, no solo contra el hover propio de `bare`. Se
>   resolvió con `hover:!text-dorado` (con `!`) — el único mecanismo que gana determinísticamente
>   sobre ambos sin tocar `Button.tsx`. El color es puramente cosmético: `disabled` sigue bloqueando
>   el click y sacando el control del tab order.
>
> Verificado igual que las rondas anteriores (`typecheck`/`lint`/`test`/`build` limpios, visual con
> Playwright contra `next build`+`next start`): 18/18 tests de storefront, hover dorado confirmado en
> los tres íconos y en los tres enlaces, en ambos estados del navbar, sin overflow en 390px.

### Entrega 2/10 — Hero del inicio (carrusel) + gestión desde el panel

Reemplaza el placeholder `[ hero — entrega 2 ]` de la entrega 1 por el hero real, editable
íntegramente desde el panel de administrador. Referencia visual dada por Manuel: `assos.com/int`
(foto full-bleed, copy abajo a la izquierda, botones outline, controles de carrusel abajo a la
izquierda). Requisito de negocio: 1–5 fotos propias, CTA a comprar, y hasta dos botones por slide
cuando la foto muestra una bici concreta dentro de una categoría (uno a la bici, otro a la
categoría).

**Entregado:**
- **Backend:** `HeroSlide`, colección propia (no una sección de `Settings` — es contenido con
  imágenes y lectura pública, `Settings` es config numérica admin-only). `apps/api/src/models/
  hero-slide.model.ts`, `services/hero-slide.service.ts`, `validators/content.validator.ts`,
  `controllers/hero-slide.controller.ts`. Dos routers nuevos: `admin-content.route.ts`
  (`/api/v1/admin/content/hero-slides`, CRUD + reorder + upload/removeImage, `protect` +
  `restrictTo`) y `content.route.ts` (`/api/v1/content/hero-slides`, público,
  `publicReadRateLimiter`). Imagen sube por la cadena completa de M3 (multer → magic bytes → strip
  EXIF → Cloudinary), reutilizada sin código nuevo de storage.
- **Referencias resueltas, no slugs congelados:** cada CTA guarda el `ObjectId` del destino
  (bici/categoría de bicis/accesorio/categoría de accesorios) o una URL interna libre; el `href` se
  resuelve en cada lectura (`resolveHrefs`), así que renombrar una bici no rompe el hero. Un destino
  archivado o borrado hace que ese CTA se omita en el payload público (marcado `isBroken` en el
  admin); si al slide no le queda ningún CTA, el slide entero se omite. `assertTargetsExist` rechaza
  además una referencia inválida al momento de guardar.
- **Imagen opcional a nivel de esquema**, mismo patrón que `Category.image`/`Brand.logo`: el slide
  se crea primero (texto) y la foto se sube justo después en una segunda llamada — un solo click
  para el admin, dos requests debajo. `listPublic` excluye cualquier slide sin imagen,
  independientemente de `isActive`.
- **Panel:** `/admin/contenido/inicio` (`HeroSlidesView` + `HeroSlideFormModal` + `HeroCtaFields`),
  nueva sección "Contenido" en `lib/nav.ts`. Lista reordenable por arrastre (`useDragReorder`, el
  mismo hook pensado para la galería táctil). El destino de cada CTA se elige con un `Combobox`
  contra el catálogo real (bicis/accesorios/categorías, cargados server-side en `page.tsx`), no con
  una URL escrita a mano — decisión explícita de Manuel.
- **Storefront:** nace `apps/web/src/lib/api/public.ts` (`publicApiFetch`) — la entrega 1 lo daba
  por nacido en la entrega 3, pero esta es la primera que consume datos. No reusa `serverApiFetch`:
  ese redirige a `/admin/login` en un 401 y siempre pide `no-store`, ninguno de los dos tiene
  sentido en una página anónima; este usa `next: { revalidate: 300 }`. `components/storefront/
  hero/`: `HomeHero` (Server Component, con reintento a un bloque de respaldo si la API falla o no
  hay slides — la home nunca se rompe por un fallo de contenido), `HeroCarousel` (cliente, mantiene
  `data-navbar-overlay` y `min-h-svh` de la entrega 1), `HeroSlideMedia`, `HeroSlideContent`,
  `HeroControls`. Los CTA son `ButtonLink variant="ghost" tone="inverse"` — ya el outline blanco con
  hover dorado de la referencia, sin variante nueva de `Button`.
- **Carrusel:** autoplay de 6s, pausado en hover/foco/pestaña oculta, apagado por completo bajo
  `prefers-reduced-motion` (vía `useMediaQuery`, el mismo hook de `MobileMenu`). Navegación por
  teclado (← →), rayitas de progreso clicables + contador «n | total» + flechas, todo `<button>`
  real con `aria-label`. Un solo slide oculta los controles en vez de mostrarlos vacíos.

**Bug real encontrado por el propio test suite:** `HeroSlideFormModal` mostraba "Quitar" en el
primer botón (obligatorio) también, no solo en el segundo — `ctas.length > 1` como condición se
evaluaba igual para ambos índices. `HeroSlideFormModal.test.tsx` lo atrapó antes de llegar a manos
de Manuel; el fix fue `index > 0` en vez de `ctas.length > 1`.

**Verificado:**
```
pnpm --filter @bw-bikes/shared build   → limpio
pnpm typecheck   (shared + api)        → limpio
pnpm --filter @bw-bikes/api lint       → limpio
pnpm --filter @bw-bikes/api test       → 47 archivos, 525/525 pasan (incluye 11 nuevos de
                                          hero-slides.test.ts: CRUD, tope de 5, CTA sin destino
                                          válido, URL externa rechazada, magic-bytes en la imagen,
                                          reorder con lista parcial rechazada, resolución de href y
                                          caída de CTA/slide cuando el destino se archiva)
pnpm typecheck   (web)                 → limpio (verificado antes de que una sesión concurrente
                                          dejara en curso una edición no relacionada de
                                          Navbar/MobileMenu — ver nota abajo)
pnpm --filter @bw-bikes/web lint       → limpio (1 warning preexistente, no relacionado)
pnpm --filter @bw-bikes/web test       → 446/447 pasan (incluye 10 nuevos: 6 de
                                          HeroCarousel.test.tsx, 4 de HeroSlideFormModal.test.tsx;
                                          el 1 roto es CategoryFormModal.test.tsx, preexistente,
                                          sesión ajena, no tocado — mismo caso que la entrega 1)
```

**Nota de cierre:** al terminar, otra sesión concurrente tenía en curso (sin commitear) una edición
de `Navbar.tsx`/`MobileMenu.tsx`/`(storefront)/layout.tsx` para agregar el árbol de categorías de
bicis al drawer móvil — ese trabajo quedó a medias (`MobileMenu` sin la prop que `Navbar` ya le
pasaba) y rompía el `tsc` del repo completo en el momento de cerrar esta entrega. No es código de
esta entrega ni se tocó: los archivos de esta entrega (`hero/`, `admin-content.route.ts`,
`hero-slide.*`, `lib/api/public.ts` y `admin-content.ts`) typecheckearon limpio de forma aislada
antes de que esa edición ajena aterrizara. Ver `concurrent-sessions-shared-checkout.md` en memoria.

**Fuera de esta entrega:** `/bicicletas`, `/accesorios`, `/ofertas` (los CTA del hero apuntan ahí y
darán 404 hasta que esas entregas lleguen — esperado); las otras siete secciones de la home;
programar slides por fecha; video de fondo; A/B testing.

---

### Entrega 4/10 — Banner de marca (marquee de logos)

Agrega la cuarta sección del home: un marquee infinito con los logos de las marcas activas del
catálogo (`Brand.logo`, ya existente desde M3). Primera sección oscura de la home — Hero y
"Explorar Bicicletas" (entrega 3) corren sobre `bg-base`; acá se rompe deliberadamente ese ritmo de
card stack claro (fondo `bg-overlay` `#0A0A0A`), decisión de diseño confirmada con la skill
`impeccable` sobre `PRODUCT.md`/`DESIGN.md` del proyecto.

**Entregado:**
- `getPublicBrands()` en `apps/web/src/lib/api/public-catalog.ts` — mismo seam que
  `getPublicBikeCategoryTree`, contra `GET /catalog/brands` (ya existía desde M3, `listPublicBrands`
  en `brand.controller.ts`). Pasa `limit=100` explícito: el endpoint pagina por default a 20
  resultados (`DEFAULT_LIMIT`/`MAX_LIMIT` en `apps/api/src/utils/list-query.ts`), y sin el límite
  explícito el marquee habría truncado el catálogo de marcas en silencio pasadas las primeras 20.
- `components/storefront/brands/`: `HomeBrands` (Server Component, mismo contrato de degradación que
  `HomeCategories` — una marca sin `logo` subido no aparece, y si ninguna tiene logo la sección
  entera no se renderiza) y `BrandMarquee` (`"use client"`, track de traslación CSS pura vía
  `--animate-brand-marquee` en `globals.css`, sin librería nueva). Tres copias del set de marcas
  (`role="list"` visible + dos copias `aria-hidden="true"`) para un loop continuo sin salto y sin
  hueco visible en pantallas anchas con pocas marcas.
- **Tratamiento visual, iterado tras ver assets reales subidos por el admin** (Cannondale, Cube,
  Orbea, Specialized, Trek): el primer intento (tarjeta blanca + `grayscale`) no funcionaba porque el
  logo de Orbea llegó como JPG opaco con su propio fondo — la tarjeta blanca generaba un doble
  recuadro. Se reemplazó por 3 mockups (`impeccable`, comparados en un artifact con el asset real) y
  Manuel eligió combinar dos: fila editorial con hairlines verticales entre logos (`border-l
  border-blanco/10`, sin dimming, color real) + un subrayado dorado que crece desde el centro en
  hover, el mismo gesto que ya usa `CategoryCard` — la sección se siente parte del sistema en vez de
  un tratamiento nuevo.
- **Tamaño uniforme:** cada logo va en una caja de tamaño fijo (`h-10 w-28`/`sm:h-12 sm:w-32`) con
  `object-contain` — sin esto, cada logo se veía a escala distinta según su propio aspect ratio (el
  wordmark ancho de Cube vs. el cuadrado de Orbea).
- **Inversión automática solo para logos oscuros sobre transparencia:** con 5 marcas reales cargadas,
  Trek (wordmark negro puro sobre PNG con alfa) se volvía invisible sobre el fondo negro — un bug
  real, no un hueco del loop. `lib/catalog/logo-luminance.ts` muestrea cada logo en un canvas oculto
  (24×24, memoizado por URL) y decide invertir **solo** si el asset tiene transparencia real *y* su
  trazo opaco es oscuro; un logo opaco de color (el rojo de Cannondale) nunca se toca — invertirlo
  cambiaría su color de marca en vez de resolver contraste. `hooks/use-dark-logo.ts` expone el
  resultado; empieza en `false` mientras el análisis corre, así que nunca hay un parpadeo de
  "invertido de más". Decisión de Manuel tras comparar tres alternativas (tinte translúcido siempre,
  dejarlo como responsabilidad del admin, o invertir automáticamente solo lo oscuro).
- Marquee se pausa en hover (`animation-play-state: paused`) y se congela por completo bajo
  `prefers-reduced-motion` (una sola copia montada, sin la clase de animación).
- `apps/web/src/app/(storefront)/page.tsx`: `<HomeBrands />` insertado entre `<HomeCategories />` y
  el placeholder de las secciones restantes.

**Verificado:**
```
pnpm --filter web typecheck   → limpio
pnpm --filter web lint        → limpio (1 warning preexistente en OrdersByDayChart.test.tsx, no
                                 relacionado)
pnpm --filter web test        → 455/456 pasan (incluye 2 nuevos de BrandMarquee.test.tsx); el 1 roto
                                 es CategoryFormModal.test.tsx, preexistente en `main` sin ningún
                                 cambio de esta entrega (confirmado con `git stash` + re-run) — mismo
                                 caso ya documentado en la entrega 2.
```
Verificación visual con los 5 logos reales confirmada por Manuel en navegador (`localhost:3000`)
tras las dos rondas de ajuste de arriba.

**Sin test unitario:** `logo-luminance.ts` depende de `HTMLCanvasElement`/`Image` reales del
navegador (decodificar el asset, leer píxeles) — el repo no tiene infraestructura de mock de canvas
en jsdom, y montarla solo para esta utilidad no se justificó; queda cubierto por la verificación
visual de arriba, mismo criterio que ya aplica `HomeCategories`/`HomeBrands` (sin test directo,
cubiertos por sus hijos + verificación visual).

**Fuera de esta entrega:** ajustar duración/velocidad del marquee contra un catálogo de marcas más
grande; las cinco secciones restantes de la home.

---

### Entrega 5/10 — Novedades (renombra "bestseller" del plan original)

La quinta sección del home se llamaba "bestseller" en el plan original de M12. Manuel la redefinió
como **"Novedades"**: un carrusel de hasta 10 productos — bicicletas y accesorios mezclados — con el
mismo diseño (rail, tarjeta, gestos) que "Explorar Bicicletas" (entrega 3).

**Decisión de diseño — campo nuevo, no el badge "Novedad" existente:** el catálogo ya tenía un
mecanismo de badges de merchandising (`badge.model.ts`), con "Novedad" como ejemplo literal en sus
comentarios desde M3. Pero `MAX_PRODUCT_BADGES = 1` obliga a gastar el único badge del producto para
usarlo como selector, y acopla qué aparece en el home a una etiqueta visual que el shopper ve en la
tarjeta admin. Manuel eligió un campo booleano independiente, puramente de curaduría.

**Entregado:**
- **Campo `isNewArrival` en `Bike` y `Accessory`** (`apps/api/src/models/bike.model.ts`,
  `accessory.model.ts`), admin-only — no viaja en el DTO público, solo se usa como filtro de query
  (`?isNewArrival=true`). Nombrado `isNewArrival`, no `isNew`: Mongoose reserva `Document.isNew`
  ("este documento no se ha guardado todavía"), así que un campo de schema con ese nombre choca en
  tiempo de compilación (`TS2353`) — se descubrió al correr `pnpm --filter api typecheck` tras el
  primer intento.
- Validators (`product.validator.ts`, `list-query.validator.ts`): `isNewArrival` aceptado en
  create/update de ambos catálogos, y filtrable en `publicProductListQuerySchema` **y**
  `adminProductListQuerySchema` (a diferencia de `isActive`, este filtro es público — el rail del
  home lo lee sin sesión).
- `product.service.ts#buildFilter`: clave explícita `isNewArrival`, mismo patrón que `isActive` —
  nunca spread del query.
- `toPublicBike`/`toPublicAccessory` ganan `createdAt` (antes solo vivía en el DTO admin): el rail
  mezcla dos colecciones ordenadas independientemente por el backend, y necesita una fecha propia
  para reordenar el merge del lado del cliente. `isNewArrival` en sí queda fuera del DTO público —
  se filtra por él, nunca se pinta.
- **Admin CRUD** (`ProductEditor.tsx`): toggle "Marcar como novedad" (`Toggle`, el mismo componente
  que ya usan `BrandFormModal`/`SizeFormModal`/`SpecSheetEditor`) en una `EditorSection` propia junto
  a "Badges". `ProductCard.tsx` (grid del admin) muestra un badge "Novedad" cuando el flag está
  activo, y `CatalogFilters.tsx` gana un `<Select>` tri-estado ("Todos"/"Marcados"/"Sin marcar"),
  mismo patrón que el filtro de Estatus.
- **`getPublicNewProducts()`** en `public-catalog.ts`: dos `publicApiFetch` en paralelo
  (`/catalog/bikes?isNewArrival=true&sort=-createdAt&limit=10` y el equivalente de accesorios), cada
  uno ya limitado y ordenado por el backend; el resultado se mezcla y se re-ordena por `createdAt`
  del lado del cliente (necesario porque son dos listas independientes) y se corta a 10.
- **`components/storefront/products/`**: `HomeNewProducts` (Server Component, mismo contrato de
  degradación que `HomeCategories`/`HomeBrands` — sin imagen no aparece, sin productos la sección
  entera se omite), `ProductCard` (calca `CategoryCard`: mismo `aspect-[4/5]`, mismo subrayado dorado
  que crece desde el centro; agrega marca y precio con `formatCurrencyCents`, ya existente en
  `lib/format.ts`) y `ProductCarousel`.
- **`product-href.ts`**: un único punto que sabe la URL de un producto —
  `/bicicletas/producto/[slug]` o `/accesorios/producto/[slug]` (segmento `producto` fijo para no
  chocar con `/bicicletas/[categorySlug]`, que ya usa `CategoryCard`). La ficha de producto no existe
  todavía, así que hoy da 404 — mismo estado que los CTA del hero y los links de categoría; cuando la
  PDP se construya, solo este archivo cambia.
- **Refactor: mecánica del rail extraída a `components/storefront/shared/`** (`ScrollRail`,
  `ScrollRailArrows`, `ScrollRailProgress`) — antes vivía solo en `categories/CategoryCarousel.tsx`.
  `CategoryCarousel` queda como envoltorio delgado sobre `ScrollRail`; `ProductCarousel` es su
  equivalente para productos. Las labels de aria (`"Categorías anteriores"` vs. `"Novedades
  anteriores"`) pasan por props — antes estaban hardcodeadas para categorías únicamente.
  `CategoryCarousel.test.tsx` se corrió sin tocar sus aserciones para confirmar que el refactor no
  cambió comportamiento.
- `apps/web/src/app/(storefront)/page.tsx`: `<HomeNewProducts />` insertado entre `<HomeBrands />` y
  el placeholder de las secciones restantes.

**Verificado:**
```
pnpm --filter @bw-bikes/shared build   → limpio
pnpm --filter api typecheck            → limpio
pnpm --filter api lint                 → limpio
pnpm --filter web typecheck            → limpio
pnpm --filter web lint                 → limpio (1 warning preexistente en OrdersByDayChart.test.tsx,
                                          no relacionado)
pnpm --filter web test -- CategoryCarousel → 4/4, confirma que el refactor del rail no cambió
                                          comportamiento
pnpm --filter api test                 → 527/528 (incluye 3 nuevos de `isNewArrival` en
                                          catalog-bikes.test.ts); el 1 roto varía de corrida a corrida
                                          (una vez hero-slides.test.ts, otra un test de resumen de
                                          inventario) — flaky preexistente de la suite completa, no
                                          relacionado a esta entrega; corrido aislado, cada archivo
                                          pasa en verde.
pnpm --filter web test                 → 455/456 (mismo roto preexistente que en la entrega 4,
                                          CategoryFormModal.test.tsx, confirmado sin cambios de esta
                                          entrega)
```

**Fuera de esta entrega:** la ficha de producto (`/bicicletas/producto/[slug]`), a la que apuntan las
tarjetas y que hoy da 404; las cuatro secciones restantes de la home.

### Ajuste posterior — Separar accesorios de "Novedades" + nueva sección "Accesorios más vendidos"

Las entregas 6-10 de M12 ("comprar bicis/accesorios", "bici del mes", "favoritas de los ciclistas",
"descubre tu bici" → `HomeComparatorBanner`) se construyeron pero no quedaron documentadas aquí
entrega por entrega — ver el propio comentario de cabecera de `apps/web/src/app/(storefront)/page.tsx`
para su historial. Este ajuste sí queda registrado porque cambia el contrato de datos de "Novedades".

Manuel decidió dejar de mezclar bicis y accesorios en "Novedades": la sección pasa a mostrar solo
bicis, y se agrega una sección propia, "Accesorios más vendidos", después de `HomeComparatorBanner`.

- **`fetchCuratedProductRail`** (`apps/web/src/lib/api/public-catalog.ts`) gana un parámetro
  `scope: "both" | "bike" | "accessory"` (default `"both"`) — cuando el scope excluye un catálogo, ese
  catálogo ni se pide.
- **`getPublicNewProducts()`** pasa a `scope: "bike"` — deja de traer accesorios.
- **`getPublicBestSellingAccessories()`** (nueva): `scope: "accessory"`, mismo flag `isNewArrival`.
  No existe ningún dato de ventas reales expuesto al público (solo analítica admin-only sobre
  `Order.lines`); en vez de agregar un campo `isBestSeller` nuevo, se reusa `isNewArrival` de
  `Accessory` — mismo razonamiento que el propio renombre "bestseller" → "Novedades" de la entrega
  5/10: el encabezado del home es una decisión de merchandising, desacoplada del nombre del campo.
- **`HomeBestSellingAccessories`** (`components/storefront/products/`): mismo contrato de
  degradación que sus hermanas (`HomeNewProducts`/`HomeFavoriteProducts`) — sin imagen no aparece,
  sin productos la sección entera se omite. Reusa `ProductCarousel` sin modificarlo.
- `page.tsx`: `<HomeBestSellingAccessories />` insertado después de `<HomeComparatorBanner />`.

**Verificado:**
```
pnpm --filter @bw-bikes/shared build   → limpio
pnpm --filter api typecheck            → limpio
pnpm --filter web typecheck            → limpio
pnpm --filter api lint                 → limpio
pnpm --filter web lint                 → 1 error preexistente en CouponFormModal.tsx
                                          (react-hooks/set-state-in-effect), de trabajo de cupones en
                                          curso en otra sesión concurrente sobre este mismo checkout —
                                          no relacionado a este cambio
pnpm --filter web build                → bloqueado por un archivo también en curso,
                                          admin/(panel)/clientes/page.tsx importa un ClientesView.tsx
                                          que todavía no existe — mismo trabajo concurrente, no
                                          relacionado a este cambio
```
Verificación visual contra el dev server ya corriendo en este checkout (`localhost:3000`/`:4000`,
sin tocarlo): `/` sirve 200 y sigue mostrando "Novedades"/"Favoritas de los ciclistas"; confirmado
contra la API directamente que hoy no hay ningún accesorio con `isNewArrival=true`
(`GET /catalog/accessories?isNewArrival=true` → `[]`), así que "Accesorios más vendidos" se omite
correctamente (el mismo contrato de "sin productos, sin sección" que ya tienen sus hermanas) — no se
pudo ver la sección con contenido real sin marcar un accesorio como novedad en la base compartida con
otras sesiones concurrentes, así que queda pendiente ese vistazo puntual cuando haya un accesorio
marcado.

---

## M18 — Cupones: backend núcleo

**Arranca la fase 5 (marketing y CRM).** Cierra parcialmente la decisión abierta #3: los cupones
dejan de estar diferidos; MSI y timbrado CFDI siguen fuera.

**Entregado:**
- **`Coupon` + `CouponRedemption`** (`apps/api/src/models/coupon.model.ts`,
  `coupon-redemption.model.ts`): campaña de descuento con código compartido en mayúsculas
  (`^[A-Z0-9-]+$`, único), `percent_off` en puntos base **o** `amount_off` en centavos —
  exclusivos entre sí, invariante sostenida a la vez por el validador Joi y por un
  `pre("validate")` del esquema, para que también la respeten los escritores que nunca pasan por
  HTTP. Reglas: vigencia (`startsAt`/`expiresAt`), compra mínima (`minSubtotalCents`), tope de
  descuento (`maxDiscountCents`, solo para porcentajes) y alcance (`scope`: todo, bicis,
  accesorios o categorías concretas).
- **Dos límites de canje, que son lo que hace seguro un código compartido**:
  `maxRedemptionsTotal` acota el costo de la campaña, `maxRedemptionsPerCustomer` impide que una
  sola persona la agote. Ambos se resuelven contra el libro mayor `CouponRedemption`, no contra un
  contador — un contador no sabe responder "¿este cliente ya lo usó?".
- **Idempotencia del canje** mediante el índice único `{couponId, orderId}` del libro mayor. Es lo
  que convierte un `replayCheckout` o un reintento de red de una carrera que el servicio tendría
  que ganar en un error de clave duplicada que simplemente se traga.
- **`calculateTotals` gana un cuarto parámetro `discountCents`** (`services/order-pricing.ts`), que
  llega ya resuelto: la función sabe restar un descuento, no si el cliente tenía derecho a él —
  exactamente como ya sabía plegar el envío sin decidir la tarifa. **La resta ocurre antes de
  derivar el IVA**, y ese orden es estructural: como el impuesto se *extrae* del total en vez de
  sumarse, descontar después reportaría IVA sobre pesos que el cliente nunca pagó. El descuento se
  topa al subtotal, así que un cupón generoso deja la mercancía en cero pero nunca empieza a
  devolver el envío.
- **`coupon.service.ts`**: CRUD admin auditado, `evaluate` (ocho validaciones en orden, cada
  rechazo con su mensaje accionable en español), `evaluateSafely` (el mismo veredicto como dato en
  vez de excepción — la forma que ya usa `resolveCartLines`), `redeem` (incremento atómico
  condicionado + libro mayor) y `releaseForOrder`.
- **Carrito**: `Cart.couponCode` guarda **solo el código, nunca el monto** — mismo principio que ya
  impide cachear precios de línea. `POST /cart/coupon` y `DELETE /cart/coupon`. Un cupón que dejó
  de ser válido no rompe el carrito: se descarta y el carrito se renderiza a precio lleno.
- **Checkout**: `createFromCart` re-evalúa el cupón (la vista previa del carrito no es autoridad),
  lo congela en `Order.coupon` + `Order.discountCents`, y canjea **después** de que la orden existe
  — el libro mayor se llavea por `orderId`. `replayCheckout` quedó intacto: ya reusaba
  `order.totalCents` congelado.
- **Liberación en un solo punto de estrangulamiento**: `applyTransition` devuelve el canje al pool
  cuando la orden llega a `cancelled` o `authorization_expired`, así que ningún call site tiene que
  acordarse. `refunded` está deliberadamente ausente: esa venta ocurrió, y devolver el cupón ahí
  dejaría al cliente cosechar descuento infinito comprando y devolviendo.
- **Seguridad**: `couponRateLimiter` (20/15min) sobre `POST /cart/coupon` — un código es un secreto
  corto y adivinable detrás de un endpoint que responde "válido/no válido", o sea un oráculo de
  fuerza bruta si no se acota. Sin listado público de cupones. El router admin va sin limiter,
  siguiendo la regla del repo (auth + rol + TOTP en cada request). Cinco `AuditAction` nuevas en la
  unión y en el espejo runtime `AUDIT_ACTIONS`.
- **Piso del gateway**: `MIN_CHARGEABLE_CENTS` (1.000). Stripe rechaza un cargo MXN bajo $10, así
  que un descuento que aterrice debajo se rechaza aquí, en español, mientras quitar el cupón sigue
  siendo un arreglo obvio — en vez de fallar en la pasarela con un mensaje sobre el que nadie puede
  actuar.

**Verificado:**
```bash
pnpm --filter @bw-bikes/shared build     # tipos compartidos compilan
pnpm --filter @bw-bikes/api exec tsc --noEmit -p tsconfig.json
pnpm --filter @bw-bikes/api test         # 53 archivos, 597 tests
```
Cobertura nueva (49 tests en 5 archivos): `coupon-pricing.test.ts` (aritmética pura, incluida la
regresión que este feature podía haber traído más fácil: que el IVA salga del total ya descontado),
`coupon.test.ts` (CRUD, 409 por código duplicado, 409 al borrar una campaña ya canjeada, 401/403),
`coupon-redemption.test.ts` (los ocho rechazos, alcance por categoría real, y que cinco checkouts
simultáneos peleando por el último canje dejen exactamente uno),
`cart-coupon.test.ts` (aplicar/quitar, y que el carrito siga renderizando cuando el cupón expira
debajo del cliente), `checkout-coupon.test.ts` (monto que recibe Stripe, congelado en la orden,
reintento con `Idempotency-Key` que no gasta un segundo canje, y liberación al cancelar).

**Decisiones tomadas durante la implementación (no estaban explícitas en el plan):**
- **Un solo punto de liberación en vez de llamadas esparcidas.** El plan preveía llamar
  `releaseForOrder` desde `failOrder`, `cancelStalePendingOrders` y las rutas de cancelación. Al
  implementar quedó claro que las tres desembocan en `applyTransition`; el gancho vive ahí y los
  call sites no saben del cupón.
- **`evaluateSafely` con veredicto, no `evaluateQuietly` con `null`.** La primera versión evaluaba
  el código contra todas las líneas resolubles al aplicarlo, pero solo contra las *comprables* al
  renderizar — un cliente podía aplicar un cupón que después no mostraba descuento. Un test lo
  cazó. Ahora ambos caminos salen de una sola evaluación: `applyCoupon` guarda, renderiza y
  revierte si el render lo rechazó, así que la respuesta que recibe el cliente *es* literalmente el
  carrito que va a ver.
- **El mínimo de compra se mide contra el subtotal completo, no contra el tramo con alcance.** "En
  compras mayores a $5,000" es lo que el cliente leyó, y el total de su carrito es el número que
  puede ver.
- **`floor` y no `round` al calcular un porcentaje**: cuando el descuento cae entre dos centavos, el
  medio centavo es de la tienda, y redondear hacia arriba dejaría a un cupón de porcentaje excederse
  de su propio tope por uno.
- **La categoría no se congela en `OrderLineSnapshot`.** Se resuelve con dos queries en el momento,
  y solo para cupones con `scope.kind === "categories"`. Congelarla haría que una campaña dirigida a
  "Montaña" se saltara en silencio las bicis que la tienda movió ahí la semana pasada.

**Fuera de este milestone:** la UI del cupón en el carrito y el checkout (M13 — el storefront
público de compra todavía no existe, así que el cliente final no puede teclear un código); el panel
de administración de cupones (M19); envío de cupones por correo (M21); envío gratis como tipo de
cupón (descartado: el envío ya es gratis arriba de un umbral, así que sería no-op en la mayoría de
los carritos); cupones nominativos por cliente; MSI y timbrado CFDI (decisión abierta #3 sigue
parcialmente abierta).

---

## M19 — Cupones: panel admin

**Entregado:**
- `/admin/cupones` (`apps/web/src/app/admin/(panel)/cupones/`): `page.tsx` RSC delgado →
  `CouponsView` cliente con la máquina de estados canónica del panel (`requestKey`/`lastRequestKey`
  para que un refetch no parpadee el skeleton), `DataTable` con fila móvil, `Pagination`,
  `EmptyState` y `ErrorBoundary`. `CouponFormModal` va por `dynamic(..., {ssr:false})`.
- `apps/web/src/lib/api/admin-coupons.ts`: mismo molde que `adminBrandsApi` — interfaz de params
  explícita, constructor de query por whitelist que refleja el schema Joi, y un objeto exportado al
  final.
- **El badge de estado responde "¿esto sirve ahorita?", no `isActive`.** Un cupón marcado activo
  puede estar expirado, programado o agotado; mostrar solo la bandera dejaría al admin preguntándose
  por qué los clientes reportan que un código "vigente" se rechaza.
- **El formulario habla en unidades humanas.** La API guarda centavos y puntos base de punta a
  punta; nadie debería teclear `250000` para decir $2,500. La conversión ocurre al salir, y el campo
  de valor cambia con el tipo — se envía exactamente el que corresponde, porque el `xor` de la API
  rechaza mandar ambos.
- Selector de categorías real: carga el árbol correcto según `itemType` y limpia los ids al cambiar
  de catálogo, porque pertenecen al árbol que estaba en pantalla hace un momento.
- Item "Cupones" en `nav.ts` → sidebar + command palette + breadcrumbs.

**Verificado:** `pnpm --filter @bw-bikes/web test` — 10 tests nuevos en `CouponsView.test.tsx`,
incluidos los cuatro estados del badge y que el diálogo de borrado avise de desactivar en su lugar.

---

## M20 — Clientes: backend CRM

**Entregado:**
- `customer.service.ts`: listado paginado y detalle, **agregando `Order` en tiempo de lectura**.
  Nada se denormaliza sobre `User`: un `orderCount` guardado sería un segundo lugar que puede
  contradecir a las órdenes, y las dos se desincronizarían el primer reembolso.
- **`$lookup` manejado desde `User`, no desde `Order`** — así el cliente registrado que nunca compró
  sigue apareciendo. Agrupar órdenes borraría justo a esa gente, que es una pregunta real del
  negocio. El sub-pipeline filtra dentro del lookup para que Mongo use `{userId, createdAt}` en vez
  de traerse todas las órdenes a memoria.
- **`$facet` para página y conteo en una sola pasada** sobre el mismo pipeline, en vez de correr el
  lookup dos veces.
- **"Compró" y "gastó" son preguntas distintas.** Un reembolso sí cuenta como compra (esa persona
  compró) pero no como dinero cobrado. Colapsarlas escondería clientes reales o inflaría su valor de
  vida. `REVENUE_STATUSES` se **importa** de `orders.stats.ts`, nunca se reescribe.
- `services/stats/customers.stats.ts`: `getTopBuyers` rankea **por dinero cobrado, no por número de
  compras** — rankear por conteo pondría diez cascos de $400 arriba de una bici de $200,000.
  `getSegments` resuelve compradores, recurrentes y ticket promedio en un doble `$group`.
  `totalCustomers` va deliberadamente sin ventana: "cuántos clientes tengo" no deja de ser cierto
  porque el admin eligió "últimos 30 días".
- `GET /admin/customers`, `GET /admin/customers/:id`, `GET /admin/stats/customers`. **Solo lectura**:
  editar un cliente no es una operación de CRM que este negocio pidió, y un admin capaz de reescribir
  el correo de alguien es una ruta de robo de cuenta que ninguna pantalla necesita.
- Primer índice compuesto de `User`: `{role: 1, createdAt: -1}`. Hasta ahora toda lectura era punto
  por email o por hash de token; una pantalla de CRM pregunta otra forma.

**Verificado:** 15 tests en `apps/api/tests/customers.test.ts` — que un reembolso cuente como compra
pero no como dinero, que `pending_payment` no cuente para nada, el filtro de recurrentes, que las
cuentas de staff nunca se listen, y que el ranking ordene por dinero y no por conteo.

---

## M22 — Clientes: panel admin

**Entregado:**
- `/admin/clientes`: tarjetas `StatCard` **clicables que filtran la tabla** (patrón de
  `OrdersSummaryCards`) — "Compradores recurrentes" es el segmento que el negocio pidió por nombre,
  así que llegar ahí es un clic, no un dropdown que nadie encontraría.
- `ChartCard` + `RankedBarChart` con los mejores compradores; se oculta entero si todavía nadie
  compró, en vez de renderizar un gráfico vacío.
- `DataTable` con nombre, correo, compras, total gastado y última compra. `SlideOver` de detalle que
  **carga al abrir**, no desde la fila: el listado solo trae agregados, y las órdenes y cupones
  canjeados serían bytes desperdiciados en las filas que nadie abre.
- Item "Clientes" en `nav.ts`.

**Verificado:** 8 tests en `ClientesView.test.tsx`, incluido que el tile de recurrentes efectivamente
manda `repeatBuyersOnly=true`.

Selección múltiple con barra de acciones y `SendCouponModal` (M21): enviar un cupón existente a los
clientes seleccionados, o generar uno al vuelo para un cliente individual. La selección se limpia al
cambiar de filtro — conservarla dejaría al admin actuando sobre filas que ya no puede ver.

---

## M21 — Envío de cupones por correo

**Cierra la fase 5.**

**Entregado:**
- `Mailer.sendCouponEmail` + su implementación en Resend y en el stub, sobre el mismo
  `renderTransactionalEmail` que el resto: el código va destacado, con la etiqueta de la oferta
  ("10% de descuento" / "$500.00 MXN de descuento") y su vigencia.
- `coupon-campaign.service.ts` con los dos flujos:
  - `sendExisting` — un cupón, muchos clientes. **Loop serial con `catch` por destinatario**, misma
    forma que `bulkUpdateStatus`: un correo malo no puede costarle el suyo a los otros treinta y
    nueve, y quien llama necesita saber exactamente cuáles no llegaron. Devuelve
    `{results, summary: {sent, failed, skipped}}`. Tope de 200 destinatarios.
  - `generateAndSend` — acuña un código de un solo uso para un cliente y se lo manda. El alfabeto
    excluye `I`, `O`, `0` y `1` porque alguien lo va a leer de una pantalla y teclearlo.
    **Que sea personal se expresa como `maxRedemptionsTotal: 1`**, no como un campo de dueño: el
    modelo de código compartido no tiene noción de propietario, así que "solo para Ana" significa
    "solo se canjea una vez". Si Ana lo reenvía, gana el primero — el mismo trato que hace cualquier
    código impreso de un solo uso.
- **Enviar no es canjear.** Una campaña mandada a cien personas que nunca compran no le costó nada a
  la tienda y no debe reportar cien canjes. El canje sigue ocurriendo solo en el checkout.
- Se niega a enviar una campaña desactivada o expirada, con mensaje accionable — ofrecerlas sería un
  callejón que el admin solo descubre después de apretar el botón.
- `POST /admin/coupons/:id/send` y `POST /admin/customers/:id/coupons`. Acción `coupon.emailed` en la
  unión y en el espejo runtime.
- UI: `SendCouponModal` en `/admin/clientes`, con selección múltiple y barra de acciones. El resumen
  parcial se reporta como `warning`, no como éxito ni como error — un lote donde treinta y ocho
  llegaron y dos no es un resultado que el admin necesita leer, no una excepción.

**Verificado:** 17 tests en `apps/api/tests/coupon-campaign.test.ts` + 4 nuevos en
`ClientesView.test.tsx`.

**Decisión de seguridad (y el bug que un test encontró):**
Este es el **primer correo del sistema redactado por una persona**, y `renderTransactionalEmail`
documenta que sus párrafos son HTML escrito por este código. El mensaje del admin se escapa
explícitamente en el servicio, sin delegar en `sanitizeInput` — ese middleware está dos capas más
lejos y no corre cuando el servicio se llama desde un script o un test (hay un test que cubre
justamente ese camino).

El primer intento escapaba también el `&`, y un test destapó que el resultado salía **doblemente
escapado**: `sanitizeInput` ya había convertido `<script>` en `&lt;script&gt;`, y volver a escapar
el ampersand producía `&amp;lt;script&amp;gt;` — seguro, pero el cliente habría leído códigos de
entidad en su correo. La versión final **no escapa `&`**, lo que hace la pasada idempotente: el
texto que el middleware ya escapó sobrevive intacto, y el texto crudo que llegue por cualquier otro
camino igual pierde sus corchetes angulares. Escapar `<` es lo que carga la garantía de seguridad;
sin él no se puede reconstruir ninguna etiqueta.

**Fuera de este milestone:** la API de lotes de Resend (el envío sigue siendo un loop serial en el
request); programar envíos a futuro; plantillas de correo editables desde el panel.

---
