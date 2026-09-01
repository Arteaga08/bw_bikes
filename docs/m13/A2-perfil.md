# A2 — Shell de cuenta y perfil

Lee primero [`00-CONTEXTO.md`](00-CONTEXTO.md). Requiere A1 terminada (sesión de cliente y
`requireCustomerSession`).

## Objetivo

Que un cliente con sesión vea `/mi-cuenta` con el shell de navegación (sidebar) y pueda ver/editar
su nombre, teléfono, cumpleaños, ciudad, y cambiar su contraseña.

## Backend

Router `/api/v1/account` (ver `00-CONTEXTO.md`), primeros dos endpoints:

- `GET /account` — perfil actual. En esta entrega devuelve solo
  `{ firstName, lastName, email, phone?, birthDate?, city? }`; A3–A5 le añaden campos a la misma
  respuesta según se construyan (direcciones, fiscal, tallas, wishlist quedan `undefined`/`[]` hasta
  entonces — el DTO se define completo desde ahora en `packages/shared/src/types/account.ts` para
  que las siguientes entregas no reabran su forma, solo la rellenen).
- `PATCH /account/profile` — body `{ firstName?, lastName?, phone?, birthDate?, city? }`, Joi con
  `stripUnknown`, sin `email` (el cambio de correo está fuera de alcance de M13). `firstName`/
  `lastName` con los mismos límites que `user.model.ts` (`maxlength: 60`). `phone` de 10 dígitos.
  Devuelve el perfil actualizado.
- `POST /account/password` — body `{ currentPassword, newPassword }`. Verifica `currentPassword`
  contra el hash (mismo método `comparePassword` que usa `login`), exige `newPassword` con el mismo
  mínimo que el registro (`minlength: 8` en el modelo). Al éxito: guarda el nuevo hash, escribe
  `passwordChangedAt` (con eso `protect` ya invalida los access tokens emitidos antes de este
  momento — no hay que tocar `protect`), y revoca las demás sesiones reutilizando la lógica de
  `logoutAllHandler` (refresh tokens). Middleware: `protect` + `authActionRateLimiter` (es una
  verificación de credencial, igual que `/auth/login`).

Archivos: `apps/api/src/routes/account.route.ts`, `controllers/account.controller.ts`,
`services/account.service.ts`, `validators/account.validator.ts`. Montar el router en
`apps/api/src/app.ts` junto a los demás (`/api/v1/account`).

## Frontend

### Shell

- `apps/web/src/app/(storefront)/mi-cuenta/layout.tsx` (Server Component):
  `const user = await requireCustomerSession()`, `const account = await serverApiFetch("/account")`,
  renderiza `<AccountSidebar user={...} /> {children}` en un grid de dos columnas.
- `apps/web/src/components/account/AccountSidebar.tsx`: sobretítulo "Mi Cuenta", nombre del cliente
  en grande, lista de navegación con ícono Phosphor + etiqueta (Perfil, Libreta de Direcciones,
  Historial de pedidos, Mis tallas, Guardado para más tarde — los enlaces a A3–A6 ya se agregan
  aquí aunque esas páginas no existan hasta sus propias entregas; usar `next/link` normal, un 404
  temporal en desarrollo es aceptable y desaparece cuando se implementen), y "Cerrar sesión" al
  final, separado, usando `apps/web/src/lib/auth/logout.ts` (`logout()` ya existe y funciona igual
  para cualquier rol). En móvil, colapsa a un `Tabs` horizontal desplazable (patrón ya usado en el
  panel admin).
- `apps/web/src/components/account/AccountCard.tsx`: tarjeta genérica `{ title, action?, children }`
  — título + contenido + un enlace "Editar" opcional a la derecha del título. La reutilizan A2–A6.

### Página de perfil

`apps/web/src/app/(storefront)/mi-cuenta/page.tsx`: dos `AccountCard`.

- **"Tu información"**: nombre completo, correo (solo lectura, sin "Editar" en ese campo), teléfono,
  cumpleaños, ciudad. Acción "Editar" abre un `Modal` con `ProfileForm.tsx` (`Input` por campo,
  `birthDate` como input de fecha nativo). Al guardar, `PATCH /account/profile`, cierra el modal y
  refresca los datos mostrados.
- **"Contraseña"**: muestra asteriscos fijos (nunca la contraseña real). Acción "Editar" abre un
  `Modal` con `PasswordForm.tsx` (contraseña actual, nueva, confirmación). Al éxito, un toast
  ("Contraseña actualizada. Cerramos tus otras sesiones.") y cierra el modal — no hace falta
  recargar nada más en esta pantalla, la sesión actual sigue viva.

## Tests

Backend: `apps/api/tests/account-profile.test.ts` — `GET /account` requiere sesión;
`PATCH /account/profile` actualiza y valida límites; `POST /account/password` rechaza contraseña
actual incorrecta (401/400, confirmar el código que usa el resto del validador de auth), acepta la
correcta, y **confirma que un refresh token emitido antes queda revocado** (llamar `/auth/refresh`
con el token viejo tras el cambio y esperar que falle).

Web: `AccountSidebar.test.tsx` (resalta la sección activa, cierra sesión), `ProfileForm.test.tsx`,
`PasswordForm.test.tsx` (error de contraseña actual incorrecta, éxito).

## Verificación

```
pnpm --filter @bw-bikes/api test
pnpm --filter @bw-bikes/web test
pnpm typecheck && pnpm lint
```

Manual: entrar a `/mi-cuenta` sin sesión → redirige a `/ingresar`. Con sesión: editar nombre/
teléfono/cumpleaños/ciudad y verlos reflejados; cambiar la contraseña y confirmar (en otra pestaña o
con la cookie de refresh guardada) que la sesión anterior deja de servir.

## Hecho cuando

- `/mi-cuenta` muestra el shell con sidebar y protege la ruta sin sesión.
- El cliente edita su perfil y ve el cambio reflejado sin recargar la página completa.
- Cambiar la contraseña exige la actual, revoca las demás sesiones, y dispara un toast confirmando.
- Todos los tests de arriba pasan y `pnpm typecheck && pnpm lint` están verdes.
