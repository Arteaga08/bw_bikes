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
| M12 — Catálogo público | 3 | ⏳ Pendiente | — | |
| M13 — Carrito, checkout y cuenta | 3 | ⏳ Pendiente | — | |
| M14 — Embajadores, patrocinios y SEO | 3 | ⏳ Pendiente | — | |
| M15 — Correos y alertas logísticas | 4 | ⏳ Pendiente | — | |
| M16 — Bot Instagram/Facebook DM | 4 | ⏳ Pendiente | — | Requiere trámite Meta iniciado en fase 3 |
| M17 — Bot WhatsApp | 4 | ⏳ Pendiente | — | Requiere número dedicado + verificación Meta |

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
  sella `disputedAt` y se audita. Si se pierde, el reembolso resultante sí mueve el estatus.
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

**⚠️ Verificación manual contra Stripe test — pospuesta a M10, a propósito:** el criterio de cierre
exige confirmar/rechazar de verdad contra Stripe en modo test (`stripe listen`), no solo el código.
Existe un script de siembra por API (`verify-m9-stripe.ts`, escrito durante esta sesión, en el
scratchpad — **no sobrevive entre sesiones**, hay que reescribirlo si se retoma esa vía) que crea
categoría + bici `on_request` directo contra la API admin, sin pasar por ningún CRUD real. Decisión
de Manuel: mejor esperar a que M10 exista y sembrar el producto de prueba desde el CRUD real del
panel — así la verificación de M9 corre sobre datos creados por el propio sistema, no por un script
sintético, y de paso ejercita M10 de punta a punta. **M10 debe cerrar con esta verificación
pendiente de M9 resuelta**, no solo con su propio criterio de cierre.

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
cancelación de órdenes ya pagadas (el backend no los expone al admin); búsqueda libre, filtro por
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
**⚠️ Verificación manual pendiente de M9, en curso al cerrar M10:** confirmar/rechazar contra Stripe
test desde el panel, sembrando el producto `on_request` desde el CRUD real en vez de un script
sintético — el criterio que M9 dejó pospuesto explícitamente (`MILESTONES.md`, sección M9). Manuel la
está corriendo; este renglón se actualiza con el resultado al terminar.

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

**Deuda de diseño heredada:** solo `/admin/inventario` pasó por el flujo `shape` de `impeccable`
completo. Las otras cinco pantallas se construyeron sobre patrones ya validados por M9/M10
(tabla + filtros + `SlideOver`, formularios independientes) sin una sesión de diseño dedicada —
riesgo más agudo en Inicio y Analítica, donde el reflejo de categoría ("panel admin → KPIs →
gráfico") es más fuerte.

**Fuera de este milestone:** `search` roto de `/admin/applications` (deuda ya conocida, no tocada);
`revenueByDay` en stats; historial de movimientos de stock; exportación a CSV; comparación contra
periodo anterior; reconciliar la fila de inventario huérfana al renombrar un SKU; estado de filtros
en la URL; rediseño del Sidebar a dos columnas; un campo `allowBackorder` propio (se reusa
`fulfillmentMode: "on_request"`); un tercer contador `allocated` en `InventoryItem` (no existe —
ver corrección del modelo de datos arriba); cambiar `fulfillmentMode` desde inventario (se edita en
`VariantsEditor`). Ninguna operación de git — este trabajo queda sin commitear, a la espera de
revisión y aprobación explícita de Manuel.
