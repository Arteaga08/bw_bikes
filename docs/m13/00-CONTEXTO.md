# M13 — Contexto compartido

Documento corto a propósito: **se lee al inicio de cada sesión de M13**, junto con el documento de
la entrega que toque. Todo lo que no cambia entre entregas vive aquí y no se repite allá.

## Por qué existe M13

El backend de commerce está terminado y probado desde M4–M20: carrito (`/api/v1/cart`), checkout
(`POST /orders`), Stripe (intent + webhook + reconciliación + disputas), reservas atómicas de stock,
cupones, envío e impuestos. Lo que falta es **la capa web del cliente**: `apps/web` solo tiene
`/admin`. No hay login de cliente, ni área de cuenta, ni carrito; los botones "Comprar" y "Añadir al
carrito" del storefront están renderizados `disabled` con `title="Disponible próximamente"`, y
`LOGIN_PATH` apunta a `/admin/login`.

M13 construye esa capa. La cuenta va primero porque el carrito exige sesión: sin login no hay nada
que probar.

## Mapa de entregas

Cada una es una sesión de trabajo propia, que arranca leyendo este archivo más el suyo y termina con
el repo verde.

| # | Documento | Qué entrega |
|---|---|---|
| A1 | [`A1-auth-cliente.md`](A1-auth-cliente.md) | Login, registro, verificación de correo, recuperar y restablecer contraseña |
| A2 | [`A2-perfil.md`](A2-perfil.md) | Shell de `/mi-cuenta`, perfil y cambio de contraseña |
| A3 | [`A3-direcciones.md`](A3-direcciones.md) | Libreta de direcciones y datos fiscales CFDI |
| A4 | [`A4-mis-tallas.md`](A4-mis-tallas.md) | Estatura, estilo de rodar, tallas de equipamiento y preselección en la ficha |
| A5 | [`A5-guardados.md`](A5-guardados.md) | "Guardado para más tarde" y el botón de corazón |
| A6 | [`A6-pedidos.md`](A6-pedidos.md) | Historial de pedidos y detalle en `/pedidos/[número]` |
| B | [`B-carrito.md`](B-carrito.md) | Disponibilidad pública, estado de carrito, botón real, drawer y `/carrito` |

Orden obligatorio: **A1 primero** (todo lo demás necesita sesión de cliente). A2 antes que A3–A6
(aportan el shell de `/mi-cuenta`). A3–A6 son independientes entre sí. B va al final.

Checkout, `/checkout` y Stripe Elements en el front son **la fase 2 de M13**, posterior a todo esto.

## Decisiones cerradas

1. **Login obligatorio** para carrito y checkout. `Cart.userId` es `required` y `unique`, y tanto
   `cart.route.ts` como `order.route.ts` hacen `router.use(protect)`. No se construye carrito de
   invitado: el dominio del carrito en el backend no se toca.
2. **Alcance de la cuenta**: perfil (nombre, teléfono, cumpleaños, ciudad), cambiar contraseña,
   recuperar contraseña desde el login, libreta de direcciones, datos fiscales, historial de
   pedidos, "mis tallas" y "guardado para más tarde".
3. **Fuera de M13**: "Bicis registradas" y "Ruedas registradas" de la referencia visual (son
   registro de garantías, un módulo propio), búsqueda del navbar, cambio de correo electrónico, y
   filtrar el catálogo por "mi talla".
4. **Facturación**: la libreta guarda solo direcciones de envío. El CFDI va en su propia tarjeta,
   porque lo que el checkout necesita en México es RFC / régimen / uso, no una dirección fiscal.
5. **Direcciones**: varias (tope 5), una marcada como predeterminada.
6. **Mis tallas**: estatura + estilo de rodar (para deducir la talla de bici) **y** tallas de
   equipamiento guardadas a mano. La talla deducida **preselecciona** la talla en la ficha de
   producto, con aviso de que se puede cambiar.
7. **El storefront público nunca muestra cifras de stock.** Solo señales: variante agotada → botón
   deshabilitado "Agotado"; en el carrito el stepper no sube más allá de lo disponible, sin decir
   cuánto queda. **El panel de administrador conserva los números tal como están hoy** — la regla
   aplica a lo que ve el cliente, no al inventario interno.

## Referencia de diseño

Capturas del área de cuenta de Specialized (`/myaccount/profile`, `/addresses`, `/orders`,
`/my-fit`), aportadas por Manuel y versionadas en `docs/DESIGN_REFERENCES/m13-cuenta/`.

Se toma de ahí la **arquitectura de información**, nunca el estilo visual:

- Dos columnas. Sidebar izquierdo fijo sobre fondo gris: sobretítulo "Mi Cuenta", el nombre del
  cliente en grande, navegación de ícono + etiqueta, y "Cerrar sesión" separado al final.
- Contenido en tarjetas, cada una con su título y un enlace "Editar" (el perfil son dos tarjetas:
  "Tu información" y "Contraseña").
- Listas vacías con placeholder punteado y un `+` centrado.
- Encabezado de sección con su acción primaria arriba a la derecha ("Añadir dirección").
- Contador junto al título en el historial ("Historial de pedidos · 0 Pedidos").

El estilo sale de `handoff/DESIGN_SYSTEM.md`: plano por defecto, el dorado como único acento, dos
pesos tipográficos, tokens del proyecto. Nada de sombras ni de la paleta de la referencia.

## Modelo de datos: todo embebido en `User`

La cuenta **no estrena colecciones**. Direcciones (≤5), datos fiscales, tallas y guardados (≤50) son
listas cortas que solo su dueño lee y escribe, siempre a través de `req.user` — exactamente el caso
que el repo ya resuelve embebiendo (`Cart.lines`, `Order.lines`). Colecciones aparte comprarían
huérfanos y `populate` sin ganar nada.

En `apps/api/src/models/user.model.ts` se añaden, todos opcionales:

| Campo | Forma |
|---|---|
| `phone?` | 10 dígitos, mismo criterio que `PHONE_LENGTH` de `shipping-address.schema.ts` |
| `birthDate?` | `Date` (solo fecha) |
| `city?` | string ≤ 80 |
| `addresses[]` | `savedAddressSchema` (ver abajo), máx 5 |
| `billingInfo?` | `billingInfoSchema` **reusado** de `models/schemas/billing-info.schema.ts` |
| `fit?` | `{ heightCm?, rideStyle?, gearSizes: [{ category, value }] }` |
| `wishlist[]` | `[{ itemType, itemId, addedAt }]`, máx 50, sin duplicados por `(itemType, itemId)` |

**Ojo con las direcciones:** `shippingAddressSchema` lleva `_id: false`, porque ahí una dirección es
una propiedad del carrito, no un sub-recurso direccionable. La libreta sí necesita direccionar cada
entrada, así que A3 crea `models/schemas/saved-address.schema.ts` con **los mismos campos** más
`label` (≤30) e `isDefault`, y con `_id` activo. Los campos se declaran una sola vez reutilizando
las constantes que `shipping-address.schema.ts` ya exporta (`MAX_RECIPIENT_NAME_LENGTH`,
`MAX_ADDRESS_LINE_LENGTH`, `POSTAL_CODE_LENGTH`, `PHONE_LENGTH`) y el enum `MEXICAN_STATES` de
`packages/shared/src/types/shipping.ts`.

**Nada de esto entra en `AuthUser`.** Ese DTO viaja en `GET /auth/me` y se usa para autorizar; se
queda como está. Los datos de la cuenta se sirven por endpoints propios, con DTOs nuevos en
`packages/shared/src/types/account.ts`.

Enum de categorías de talla de equipamiento, en `packages/shared` (valores en inglés, etiquetas en
español en la UI): `helmet`, `handlebar_width`, `saddle_width`, `shorts`, `top`, `bottom`, `gloves`.

## Router nuevo: `/api/v1/account`

Capas completas y separadas: `apps/api/src/routes/account.route.ts`,
`controllers/account.controller.ts`, `services/account.service.ts`,
`validators/account.validator.ts`. `router.use(protect)` en todo el router y **ningún id de usuario
en ninguna ruta** — igual que `cart.route.ts`, el recurso resuelto es siempre el de `req.user`, así
no hay nada que enumerar.

```
GET      /account                              perfil + direcciones + fiscal + tallas, en una lectura
PATCH    /account/profile                      firstName, lastName, phone, birthDate, city
POST     /account/password                     currentPassword + newPassword

GET      /account/addresses
POST     /account/addresses
PATCH    /account/addresses/:addressId
DELETE   /account/addresses/:addressId
POST     /account/addresses/:addressId/default

PUT      /account/billing-info
DELETE   /account/billing-info

PUT      /account/fit

GET      /account/wishlist                     hidratada contra el catálogo
POST     /account/wishlist                     { itemType, itemId }
DELETE   /account/wishlist/:itemType/:itemId
```

Cada entrega añade solo sus endpoints: A2 el perfil y la contraseña, A3 direcciones y facturación,
A4 `fit`, A5 la wishlist. `GET /account` crece con ellas.

## Convenciones que aplican a todas las entregas

- Exportaciones **al final** del archivo, nunca inline.
- Lógica y backend en **inglés** (archivos, variables, funciones, schemas, comentarios); UI visible
  en **español**, con buena ortografía.
- Componentes pequeños, de responsabilidad única. Nada de archivos enormes.
- Joi con `stripUnknown` y mensajes de error en español, como el resto de los validadores.
- Tests: Vitest. En la API, `apps/api/tests/*.test.ts` con `buildApp()` y las factories de
  `tests/helpers/`. En web, colocation `Foo.test.tsx` junto al componente, queries por rol y nombre
  accesible.
- **No agregar features no pedidas.** Si algo parece un "siguiente paso natural", se propone y se
  espera aprobación.
- Nunca `git add` / `commit` / `push` sin permiso explícito de Manuel.

## Verificación (idéntica en todas las entregas)

```
pnpm --filter @bw-bikes/api test
pnpm --filter @bw-bikes/web test
pnpm typecheck && pnpm lint
```

El recorrido manual contra Mongo Atlas requiere que la IP pública actual esté en Network Access, o
la API local no conecta. Apagar cualquier `pnpm dev` en segundo plano al terminar.
