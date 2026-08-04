# Black and White Bikes — Tablero de milestones

Fuente de verdad de qué está realmente hecho y mergeado a `main`. La spec completa vive en
`docs/superpowers/specs/2026-08-03-black-and-white-bikes-design.md`; el detalle de entrega y
verificación de cada milestone vive en `~/.claude/plans/nuevo-proyecto-black-and-prancy-dewdrop.md`.

| Milestone | Fase | Estado | Rama | Notas |
|---|---|---|---|---|
| M1 — Scaffolding seguro del monorepo | 1 | ✅ Hecho | `feat/m01-scaffolding` (mergeado, tag `m01`) | Ver detalle abajo |
| M2 — Auth y usuarios | 1 | ✅ Hecho (pendiente de merge) | `feat/m02-auth` | Ver detalle abajo |
| M3 — Catálogo | 1 | ⏳ Pendiente | — | |
| M4 — Inventario y reservas | 1 | ⏳ Pendiente | — | |
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
