# Checklist de lanzamiento a producción — Black and White Bikes

Última actualización: 2026-09-04. Fuentes: inspección directa de `apps/api`/`apps/web`,
`docs/AUDIT_PLAYBOOK.md`, `docs/MILESTONES.md`, memoria del proyecto, y el audit de 3 agentes
(backend/seguridad, frontend, infra/deploy) corrido esta misma fecha
(`~/.claude/plans/no-aun-nos-falta-cheerful-kahan.md`). Marca cada casilla al resolverla; no borres
las secciones "ya listo" ni "fuera de alcance" — son la memoria de qué **no** hay que re-litigar.

> El código de negocio y seguridad (middlewares, auth, Stripe, tests) está en nivel maduro. Lo que
> falta para lanzar es sobre todo **contenido legal/de marca, operación de deploy y
> observabilidad** — no lógica de negocio nueva.

---

## 🔴 Bloqueantes (no se puede lanzar sin esto)

- [ ] **Textos legales reales** en `/terminos` y `/privacidad` — hoy son placeholder marcado
      explícitamente en el código (`apps/web/src/app/(storefront)/terminos/page.tsx:8-9`,
      `.../privacidad/page.tsx:8-9`) y ambas páginas están `robots: { index: false }` a propósito.
      Ver plantillas listas para llenar en [`docs/legal/`](./legal/).
- [ ] **Política de Envíos** y **Política de Devoluciones/Reembolsos** — no existen como rutas
      todavía (solo `/terminos` y `/privacidad` existen hoy). Ver
      [`docs/legal/politica-envios.md`](./legal/politica-envios.md) y
      [`docs/legal/politica-devoluciones-reembolsos.md`](./legal/politica-devoluciones-reembolsos.md).
- [ ] **Páginas de error de Next.js** — no existen `error.tsx`, `global-error.tsx` ni
      `not-found.tsx` bajo `apps/web/src/app`. Un 404/500 real en producción hoy muestra la
      pantalla genérica de Next, sin marca ni reporte del error.
- [ ] **Dominio de Resend verificado en producción** + `MAIL_FROM` real — el sandbox
      `onboarding@resend.dev` no aplica en producción; sin esto, verificación de correo y reset de
      contraseña fallan en cadena (mientras tanto, pruebas solo funcionan con
      `bwbikes2026@outlook.com`).
- [ ] **Stripe en modo live** — `STRIPE_SECRET_KEY` debe ser `sk_live_...` (nunca la de test) y
      `STRIPE_WEBHOOK_SECRET` debe venir del endpoint registrado contra el dominio real, no del que
      imprime `stripe listen` en local.
- [ ] **Manifiesto de deploy** — no hay `Dockerfile`, `vercel.json`, `render.yaml`,
      `railway.json` ni `Procfile` en todo el repo. Nada le dice hoy a un host cómo correr
      `apps/api` + `apps/web` desde este monorepo.
- [ ] **Runbook de deploy** — `README.md` raíz es una sola línea. Falta un documento con: orden de
      deploy (api antes que web), variables de entorno por servicio, configuración de DNS/certificados,
      verificación del dominio de Resend, y registro del webhook de Stripe en el dashboard live.
- [ ] **Backups de MongoDB Atlas** (continuo/PITR) confirmados como habilitados en el cluster de
      producción — riesgo de pérdida de datos si no.
- [ ] **Nombre de base de datos en `MONGODB_URI`** de producción — si el URI real no trae un
      nombre de base antes del `?`, Mongoose cae al default `test`. El código no valida esto en
      runtime; hay que confirmarlo a mano antes del cutover.
- [ ] **`mongoose.syncIndexes()` como paso explícito de deploy** — `autoIndex` está deshabilitado a
      propósito en producción (`apps/api/src/config/db.ts:20`). Si este paso no queda en el runbook
      real (ver punto anterior), un deploy fresco arranca sin los 75+ índices.
- [ ] **`ADMIN_ALERT_EMAIL`** configurado.
- [ ] **IP/rango de salida del host de producción de la API** agregada a Atlas Network Access
      (memoria: ya bloqueó antes la verificación de Stripe de M9 cuando no estaba whitelisteada).

---

## 🟡 Importantes (fuerte recomendación antes de lanzar; no impiden técnicamente el arranque)

- [ ] **Sentry** (backend y frontend) — cero `@sentry/*` instalado, cero DSN configurado. Ya
      estaba planeado para M15; sin esto, un 500 real en producción solo se ve revisando logs de
      pino a mano.
- [ ] **`process.on("unhandledRejection"/"uncaughtException")`** en `apps/api/src/server.ts` —
      hoy solo hay handlers de `SIGINT`/`SIGTERM`. Mitigado por el uso consistente de
      `asyncHandler`, pero un rechazo fuera de ese wrapper (p. ej. dentro de un `setInterval` de
      background) no se loguea ni apaga el proceso limpiamente.
- [ ] **Reintento/backoff en la conexión inicial a Mongo** (`apps/api/src/config/db.ts`) — un
      fallo transitorio de Atlas al arrancar crashea el proceso en vez de reintentar.
- [ ] **Paso de CD** — `.github/workflows/ci.yml` corre lint/typecheck/test/audit, pero no hay
      build de imagen ni trigger de deploy; hoy se asumiría deploy manual o auto-deploy del host
      (sin verificar cuál).
- [ ] **Rate limiting con `MemoryStore`** — no apto para múltiples instancias. Migrar a Redis
      **solo** si la API va a escalar horizontalmente (aceptado como limitación mientras corra en
      una sola instancia, ver sección "ya listo").
- [ ] **Terminar y confirmar el mecanismo `x-bw-client-ip`/`x-bw-proxy-token`** — ya está en
      construcción sin commitear (`apps/api/src/utils/client-ip.ts`, secreto compartido
      `PROXY_SHARED_SECRET`), pero falta confirmar contra el proxy/CDN real delante de `apps/web`
      que no reescriba esos headers antes de llegar a la API.
- [ ] **Envío de correo sin cola/retry** — si Resend falla, `resend.mailer.ts` responde 502 y
      bloquea registro/reset en el momento, sin reintento ni cola.
- [ ] **Analítica/monitoreo de negocio en frontend** (GA/PostHog o similar) — hoy solo hay alertas
      de Telegram/admin-email para eventos de venta, nada de comportamiento de visitantes.
- [ ] **TODOs de contenido de marca** — 6 `TODO(marca)` pendientes en `HomeBranchCtas.tsx`,
      `brand-social.ts`, `storefront-catalog.ts`, `storefront-mega-menu.ts`: fotos stock reales en
      Cloudinary, redes sociales, teléfono, URL de Google Maps. No son bugs, es contenido real que
      falta cargar.
- [ ] **Confirmar decisión de negocio**: reembolsos deliberadamente no expuestos vía API propia
      (solo se disparan desde el dashboard de Stripe) — revisar que siga siendo lo que se quiere
      antes de lanzar, y que el proceso de devolución física (ver
      [`docs/legal/politica-devoluciones-reembolsos.md`](./legal/politica-devoluciones-reembolsos.md))
      quede coherente con esto.
- [ ] `pnpm audit --prod` limpio en el commit final antes del deploy.
- [ ] Radar Lite de Stripe activo (gratis, incluido en la comisión estándar) — confirmar en el
      dashboard de Stripe.

---

## 🟢 SEO / contenido — nada de esto está hecho (confirmado con Manuel, 2026-09-04)

Una nota de una sesión anterior daba por hecho, "confirmado por Manuel", que ya existían
favicon/iconos, `robots.txt`, `sitemap.xml`, Search Console, imagen OG, manifest PWA. Manuel
confirmó que **no**, nada de eso está confirmado/hecho — esa nota previa era incorrecta.
`apps/web/public` solo contiene la carpeta `brand/` con logos, no existe `app/sitemap.ts`,
`app/robots.ts` ni `app/manifest.ts`, y `layout.tsx` no declara `icons` ni `openGraph`.

- [ ] `app/sitemap.ts` (Next.js genera `sitemap.xml` desde ahí)
- [ ] `app/robots.ts` (genera `robots.txt`)
- [ ] Favicon / iconos (`app/icon.*`, `app/apple-icon.*`)
- [ ] Imagen OG por defecto + metadata `openGraph` en `layout.tsx`
- [ ] Verificación de Google Search Console
- [ ] `app/manifest.ts` (PWA)

---

## 🔧 Infraestructura y despliegue

- [ ] Cerrar Render vs. Railway para `apps/api` (la spec de diseño dice "Render/Railway", sin
      cerrar entre las dos).
- [ ] `apps/web` desplegado en Vercel con `API_URL` apuntando al dominio real de la API.
- [ ] DNS de `blackandwhitebikes.com` + subdominio `api.` apuntando a los hosts correctos.
- [ ] Todas las variables de `apps/api/.env.production.example` y
      `apps/web/.env.production.example` cargadas en el secret manager del host — nunca en un
      archivo dentro de la imagen.
- [ ] `CLIENT_URL` real de la API (se usa en correos transaccionales y en la whitelist de CORS).
- [ ] Origen real de producción agregado a `config/allowed-origins.ts` si no se resuelve
      automáticamente desde una env var.
- [ ] Confirmar que el cluster de Mongo Atlas elegido corre como replica set (lo es por
      definición, pero confirmar el tier) — requisito de M4 para las transacciones de inventario.
- [ ] `NODE_ENV=production` seteado explícitamente en el host (nunca asumido).
- [ ] Credenciales de Cloudinary de producción, distintas a las de desarrollo.
- [ ] Bot de Telegram y chat REALES del equipo, distintos a los de dev/test.
- [ ] Correr `pnpm --filter @bw-bikes/api seed:admin` contra la base de datos de producción para
      crear el primer admin.

---

## ✅ Seguridad — ya endurecido (no repetir como pendiente sin evidencia nueva)

- [x] CSP/HSTS explícitos (`config/security-headers.ts`): `default-src 'none'` +
      `frame-ancestors 'none'`, HSTS a 1 año con `includeSubDomains` + `preload`.
- [x] Verificación de contraseñas filtradas (HIBP k-anonymity), diseño fail-open.
- [x] 2FA obligatorio para admin/superadmin en **cada** request, no solo al login.
- [x] CORS, sanitización recursiva NoSQL/XSS, validación Joi con `stripUnknown`, verificación de
      Origin/Referer por parseo exacto (no `startsWith`).
- [x] Webhooks de Stripe: firma verificada contra el body crudo + dedupe por índice único
      insertado antes de procesar — dos capas de idempotencia.
- [x] Checkout: Stripe Elements en modo diferido, precio reconciliado en servidor, 3DS vía
      `redirect: "if_required"`.
- [x] Suite de tests cubriendo pagos, webhooks, auth y 2FA con Mongo real en memoria.
- [x] Rate limiting con `MemoryStore` — aceptado explícitamente mientras la API corra en una sola
      instancia (ver 🟡 arriba para el disparador de migrarlo).
- [x] CFDI se captura pero no se timbra — decisión de negocio ya tomada (M7), no es deuda técnica.

---

## 🧪 QA final

- [ ] Pruebas contra servicios externos reales, pospuestas a propósito — correrlas todas juntas
      ahora que la fase 1 (M1–M7) está funcionalmente cerrada.
- [ ] Recorrido visual humano completo del storefront.
- [ ] Compra end-to-end en modo live con tarjeta real y monto mínimo, antes de anunciar el
      lanzamiento.

---

## 📡 Monitoreo post-lanzamiento

- [ ] Sentry (backend + frontend).
- [ ] Destino persistente de los logs de pino (hoy van a stdout y se pierden al reiniciar).
- [ ] Monitor de uptime externo (UptimeRobot/Better Uptime u otro) contra `/api/v1/health` — el
      endpoint ya existe y está listo, solo falta contratar/configurar el monitor.
- [ ] Definir quién monitorea las alertas de Telegram/correo de "nueva venta" / "stock bajo".

---

## ⏸️ Fuera de alcance para este lanzamiento (decisiones ya tomadas, no bloquean)

- CFDI timbrado — pospuesto (decisión M7).
- Cupones, MSI y facturación fiscal completa — fuera de alcance de fase 1.
- Cupones personales en Mi Cuenta — feature aparte, movida a otra conversación con prompt
  dedicado.
- Bots de Instagram/WhatsApp (M16/M17) — fase 4, requieren trámite Meta iniciado.
- Framework de migraciones general — solo hay scripts puntuales (`migrate:brands`), suficiente
  por ahora.
- CSP con `script-src`/nonce más estricto — diferido a propósito, no hay scripts de terceros
  todavía.
- Radar for Fraud Teams (reglas antifraude personalizadas) — fuera de alcance mientras el volumen
  de ventas sea bajo, tiene costo por transacción evaluada.
- URLs firmadas de adjuntos sin expiración temporal — limitación conocida de la cuenta de
  Cloudinary actual, no es una regresión.
