# Black and White Bikes — Tablero de milestones

Fuente de verdad de qué está realmente hecho y mergeado a `main`. La spec completa vive en
`docs/superpowers/specs/2026-08-03-black-and-white-bikes-design.md`; el detalle de entrega y
verificación de cada milestone vive en `~/.claude/plans/nuevo-proyecto-black-and-prancy-dewdrop.md`.

| Milestone | Fase | Estado | Rama | Notas |
|---|---|---|---|---|
| M1 — Scaffolding seguro del monorepo | 1 | ✅ Hecho (pendiente de merge) | `feat/m01-scaffolding` | Ver detalle abajo |
| M2 — Auth y usuarios | 1 | ⏳ Pendiente | — | |
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
