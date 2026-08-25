# `@bw-bikes/e2e` — suite funcional del panel admin

Playwright contra el panel admin real (`apps/web/src/app/admin/(panel)/`), clic real en
cada botón/modal/formulario. Infraestructura reutilizable, no solo para un audit puntual.

## Primera vez

1. `cp .env.e2e.local.example .env.e2e.local` y completa los valores (ver los comentarios
   del archivo — mismas credenciales test-mode de Stripe/Cloudinary que ya usas en
   `apps/api/.env.development.local`).
2. `pnpm exec playwright install --with-deps chromium` (una vez por máquina).

## Correr la suite

```
pnpm --filter @bw-bikes/e2e test:e2e
```

Esto levanta, en orden, y los apaga al terminar:

1. Un Mongo efímero (`mongodb-memory-server`, puerto fijo `27117`, réplica de un nodo) —
   nunca toca tu base de dev real ni Atlas.
2. `apps/api` apuntando a ese Mongo.
3. `apps/web`, build de producción (no `next dev` — evita el doble-render de React 19
   Strict Mode).

`global-setup.ts` entonces siembra una cuenta admin dedicada (`superadmin`, para navegar
las 18 rutas incluida `/admin/auditoria`) y una segunda cuenta `admin` (para el spec de
RBAC de Auditoría), resuelve su 2FA con `otplib` generando el TOTP igual que
`apps/api/tests/helpers/admin-session.ts`, siembra fixtures base de catálogo, y corre
`apps/api/src/scripts/seed-e2e-orders.ts` (13 órdenes reales contra Stripe test-mode, una
por estatus).

El secreto TOTP de cada cuenta se guarda de vuelta en `.env.e2e.local` tras el primer
enrolamiento — corridas siguientes verifican en vez de re-enrolar. Si necesitas forzar un
re-enrolamiento, borra `E2E_ADMIN_TOTP_SECRET`/`E2E_ADMIN_NONSUPER_TOTP_SECRET` de
`.env.e2e.local` y `.auth/`.

## Modo debug

```
pnpm --filter @bw-bikes/e2e exec playwright test --headed --workers=1
pnpm --filter @bw-bikes/e2e exec playwright show-report
```

## Qué NO cubre todavía

- CI: fuera de alcance de la Sesión 4 del audit — necesita decidir cómo aprovisionar
  secretos de Stripe/Cloudinary test-mode en GitHub Actions, y separarse del workflow
  rápido actual (`.github/workflows/ci.yml`, in-memory, sin browsers).
- Entrega real de correos al cliente (ya documentado como reserva en la Sesión 3 — la
  cuenta Resend de prueba solo entrega a su propia dirección verificada).
