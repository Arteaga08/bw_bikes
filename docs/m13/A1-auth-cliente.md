# A1 — Autenticación de cliente

Lee primero [`00-CONTEXTO.md`](00-CONTEXTO.md). Esta es la primera entrega de M13: todo lo demás
(A2–A6, B) exige sesión de cliente, así que nada de eso tiene sentido sin esto.

## Objetivo

Que un visitante pueda crear cuenta, verificar su correo, iniciar sesión, recuperar su contraseña
si la olvida, y que el resto del storefront pueda pedirle sesión sin sacarlo del admin.

## Por qué es bloqueante antes que nada

Hoy `apiFetch` (`apps/web/src/lib/api/client.ts`) y `serverApiFetch`
(`apps/web/src/lib/api/server.ts`) redirigen a `LOGIN_PATH` (`/admin/login`) ante **cualquier** 401
fuera de `/auth/*`. Si una página del storefront hace una llamada autenticada y el visitante es
anónimo, hoy lo mandaría al login del panel de administración. Hay que resolver esto antes de que
cualquier componente del storefront llame algo protegido.

El backend de auth ya existe completo y no se toca en esta entrega:
`apps/api/src/routes/auth.route.ts` — `POST /register`, `POST /verify-email`,
`POST /resend-verification`, `POST /login`, `POST /refresh`, `POST /logout`, `POST /logout-all`,
`POST /forgot-password`, `POST /reset-password`, `GET /me`. El 2FA (`/2fa/*`) es exclusivo de
`admin`/`superadmin` — un `customer` nunca lo ve.

Dos comportamientos del backend condicionan el diseño:

- `registerUser` responde **201 sin abrir sesión** (no hay cookies). Sin la página de verificación,
  crear cuenta no lleva a ningún lado, porque:
- `loginWithPassword` responde **403** si `emailVerified === false`.

## Backend

Cambio mínimo, un archivo: `apps/api/src/services/auth.service.ts`.

- Línea ~58: la URL del correo de verificación pasa de `${clientUrl}/verify-email?token=...` a
  `${clientUrl}/verificar-correo?token=...`.
- Línea ~146: la URL del correo de restablecimiento pasa de `${clientUrl}/reset-password?token=...`
  a `${clientUrl}/restablecer-contrasena?token=...`.

Motivo: mantener la convención de URLs en español del storefront (`/carrito`, `/mi-cuenta`, etc.);
sin este cambio quedarían dos rutas en inglés sueltas entre todas las demás.

Actualizar el test que afirma la URL actual (buscar `verify-email` y `reset-password` en
`apps/api/tests/*.test.ts`, probablemente en algo como `auth-verification.test.ts` o
`auth-password-reset.test.ts` — confirmar el nombre exacto al implementar) para que espere las
nuevas rutas.

No se toca nada más del backend: ni modelos, ni otros servicios, ni rate limiters.

## Frontend

### 1. Parametrizar el redirect de 401

`apps/web/src/lib/api/client.ts` — `apiFetch` gana un tercer parámetro opcional:

```ts
apiFetch<TData = unknown>(
  path: string,
  init?: RequestInit,
  options?: { unauthorizedRedirectPath?: string | null },
): Promise<ParsedResponse<TData>>
```

Default `LOGIN_PATH` (el comportamiento de hoy: ningún call site del admin cambia). Con
`unauthorizedRedirectPath: null`, tras un refresh fallido la función **no navega**: devuelve la
respuesta 401 tal cual para que `parseApiResponse` lance `ApiError(401)` normalmente. La lógica de
`refreshSession()` no cambia — sigue intentando un refresh antes de rendirse.

Mismo cambio, mismo nombre de opción, en `apps/web/src/lib/api/server.ts` (`serverApiFetch`).

Actualizar `client.test.ts` y `server.test.ts`: un caso nuevo por archivo que pasa
`unauthorizedRedirectPath: null` y confirma que se lanza `ApiError` en vez de navegar, dejando el
caso default (sin la opción) tal como está.

### 2. Config nueva

En `apps/web/src/lib/config.ts`, junto a las constantes existentes (`LOGIN_PATH` se queda intacto,
es el del admin):

```ts
export const CUSTOMER_LOGIN_PATH = "/ingresar";
export const CUSTOMER_REGISTER_PATH = "/crear-cuenta";
export const ACCOUNT_PATH = "/mi-cuenta";
```

### 3. Redirect seguro

`apps/web/src/lib/auth/customer-redirect.ts` (nuevo):

```ts
export function loginHref(returnTo?: string): string
export function safeRedirectTarget(param: string | string[] | undefined): string | null
```

`safeRedirectTarget` solo acepta valores que empiecen con `/` y no con `//` (evita un open redirect
a un host externo vía `?redirect=`). Test en `customer-redirect.test.ts` (proyecto "node" de
Vitest, sin DOM): casos válido, `//evil.com`, `http://evil.com`, vacío, `undefined`.

### 4. Guard de sesión de cliente

`apps/web/src/lib/auth/session.ts`, al final, junto a `requireAdminSession`/`requireSuperadminSession`:

```ts
export async function requireCustomerSession(returnTo?: string): Promise<AuthUser>
```

Mismas tres comprobaciones que `requireAdminSession` (cookie presente → `serverApiFetch("/auth/me",
undefined, { unauthorizedRedirectPath: null })` en `try/catch` → 200 confirma la sesión), pero
**sin** verificación de rol: cualquier usuario autenticado, incluido un admin navegando la tienda,
tiene su propio carrito. El `try/catch` envuelve únicamente la llamada a `serverApiFetch` — nunca un
`redirect()`, que en Next.js funciona lanzando una excepción de control de flujo (misma nota que ya
tiene el archivo para los otros dos guards). Sin cookie o sin sesión válida →
`redirect(loginHref(returnTo))`.

No tiene consumidor todavía en esta entrega — lo usarán A2 (`mi-cuenta/layout.tsx`) y B. Se
construye aquí con su test porque es infraestructura de auth, no de una pantalla concreta.

### 5. Páginas nuevas

Todas bajo `apps/web/src/app/(storefront)/`, cada una con `export const metadata = { robots: { index: false, follow: false } }` (no son contenido indexable).

| Ruta | Archivos | Comportamiento |
|---|---|---|
| `/ingresar` | `page.tsx` + `CustomerLoginForm.tsx` (`"use client"`) | Solo email + contraseña — **no** copiar los pasos TOTP de `admin/login/LoginForm.tsx`, el 2FA no aplica a `customer`. `POST /auth/login`. Un 403 por correo no verificado muestra el mensaje del backend + botón "Reenviar correo" (`POST /auth/resend-verification`). Éxito → `router.replace(safeRedirectTarget(searchParams.redirect) ?? "/")`. Enlace "¿Olvidaste tu contraseña?" → `/recuperar-contrasena`, y "Crear cuenta" → `/crear-cuenta` conservando `?redirect=` |
| `/crear-cuenta` | `page.tsx` + `CustomerRegisterForm.tsx` | Nombre, apellido, correo, contraseña. `POST /auth/register` → pantalla "Revisa tu correo para verificar tu cuenta." Enlace a `/ingresar` conservando `?redirect=` |
| `/verificar-correo` | `page.tsx` + `VerifyEmailClient.tsx` | Lee `?token=` de la URL, `POST /auth/verify-email` al montar, tres estados (cargando / verificado / error con "reenviar"), CTA a `/ingresar` |
| `/recuperar-contrasena` | `page.tsx` + `ForgotPasswordForm.tsx` | Solo correo. `POST /auth/forgot-password`. La respuesta es la misma exista o no la cuenta (así responde ya el backend) — mostrar siempre "Si el correo existe, te enviamos un enlace." |
| `/restablecer-contrasena` | `page.tsx` + `ResetPasswordForm.tsx` | Lee `?token=`, pide contraseña nueva (+ confirmación), `POST /auth/reset-password`, éxito → `/ingresar` con un aviso |

### 6. Navbar

`apps/web/src/components/storefront/NavbarActions.tsx`: el botón **Cuenta** deja de estar
`disabled`. Pasa a `ButtonLink` hacia `ACCOUNT_PATH` (que en A2 redirige a `/ingresar` si no hay
sesión). El botón **Buscar** se queda `disabled` (no es de esta entrega). El botón **Carrito** se
queda `disabled` (es de B).

El doc-comment del archivo explica hoy, con detalle, por qué el hover usa `hover:!text-dorado` con
`!important` — la razón es la interacción con `disabled:text-*` de la variante `bare`/`neutral`. Al
quitarle `disabled` a Cuenta, esa razón deja de aplicar a ese botón concreto: **revisar si el `!`
sigue haciendo falta ahí y corregir el comentario** para que siga describiendo la realidad (sigue
aplicando a Buscar y Carrito, que continúan `disabled`).

Actualizar `Navbar.test.tsx` (o `NavbarActions.test.tsx`, confirmar dónde vive el assert): el caso
que hoy afirma "Buscar/Cuenta/Carrito disabled" pasa a afirmar que solo Buscar y Carrito lo están, y
que Cuenta es un enlace activo hacia `/mi-cuenta`.

## Tests

Backend: actualizar el test existente de las URLs de correo (buscar por `verify-email` /
`reset-password` en `apps/api/tests/`).

Web, nuevos: `customer-redirect.test.ts`, `CustomerLoginForm.test.tsx` (envío, error 403 con botón
reenviar, redirect tras éxito), `CustomerRegisterForm.test.tsx`, `VerifyEmailClient.test.tsx` (los
tres estados), `ForgotPasswordForm.test.tsx`, `ResetPasswordForm.test.tsx`, `session.test.ts` (caso
`requireCustomerSession`, junto a los que ya cubren los otros dos guards).

Web, a actualizar: `client.test.ts`, `server.test.ts`, `Navbar.test.tsx`.

## Verificación

```
pnpm --filter @bw-bikes/api test
pnpm --filter @bw-bikes/web test
pnpm typecheck && pnpm lint
```

Manual (requiere la API corriendo y la IP en la whitelist de Atlas): crear cuenta → revisar el correo
(o el log de `stub.mailer` si Resend no está configurado en local) → abrir el enlace de verificación
→ iniciar sesión → confirmar `GET /auth/me` 200. Probar también "olvidé mi contraseña" de punta a
punta. Cargar la home **como visitante anónimo** y confirmar que nada redirige a `/admin/login`.

## Hecho cuando

- Un visitante puede crear cuenta, verificarla por correo, iniciar sesión y cerrar sesión sin tocar
  nada del panel de administración.
- Un visitante anónimo nunca es enviado a `/admin/login`.
- "Olvidé mi contraseña" funciona de punta a punta.
- El botón Cuenta del navbar es un enlace real.
- Todos los tests de arriba pasan y `pnpm typecheck && pnpm lint` están verdes.
