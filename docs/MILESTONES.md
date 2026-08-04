# Black and White Bikes — Tablero de milestones

Fuente de verdad de qué está realmente hecho y mergeado a `main`. La spec completa vive en
`docs/superpowers/specs/2026-08-03-black-and-white-bikes-design.md`; el detalle de entrega y
verificación de cada milestone vive en `~/.claude/plans/nuevo-proyecto-black-and-prancy-dewdrop.md`.

| Milestone | Fase | Estado | Rama | Notas |
|---|---|---|---|---|
| M1 — Scaffolding seguro del monorepo | 1 | ✅ Hecho | `feat/m01-scaffolding` (mergeado, tag `m01`) | Ver detalle abajo |
| M2 — Auth y usuarios | 1 | ✅ Hecho | `feat/m02-auth` (mergeado, tag `m02`) | Ver detalle abajo |
| M3 — Catálogo | 1 | ✅ Hecho | `feat/m03-catalogo` (mergeado) | Ver detalle abajo |
| M4 — Inventario y reservas | 1 | ✅ Hecho (pendiente de merge) | `feat/m04-inventario` | Ver detalle abajo |
| M5 — Carrito, órdenes y pagos | 1 | ⏳ Pendiente | — | Módulo crítico |
| M6 — Envíos, estatus y solicitudes | 1 | ⏳ Pendiente | — | Depende de decisión abierta #1 (costo de envío) |
| M7 — Settings, analítica y adapters | 1 | ⏳ Pendiente | — | |
| M8 — Shell del dashboard | 2 | ⏳ Pendiente | — | |
| M9 — Órdenes y cola de confirmación | 2 | ⏳ Pendiente | — | |
| M10 — Catálogo en admin | 2 | ⏳ Pendiente | — | |
| M11 — Inventario, solicitudes, settings, analítica, auditoría | 2 | ⏳ Pendiente | — | |
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
- `packages/shared`: `BrakeType`, `SpecGroup`/`SpecField`, `ProductImage`, `ProductVariant`, DTOs
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
  esquema; `Bike` y `Accessory` como **dos entidades separadas** (la bici tiene `brakeType`,
  `shortDescription` y `relatedAccessories`; el accesorio no).
- Campos de primera clase para filtros exactamente los que nombra la spec — categoría, marca,
  precio, tipo de freno, más talla y color a nivel variante. `specGroups[]` es solo de exhibición y
  nunca se filtra, que es la consecuencia que el cliente aceptó al pedir ficha libre.
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
