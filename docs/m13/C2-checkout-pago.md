# C2 — Checkout, paso de pago

Lee primero [`00-CONTEXTO.md`](00-CONTEXTO.md) y [`C1-checkout-datos.md`](C1-checkout-datos.md).
Requiere C1 completo: el carrito debe llegar aquí con `shippingAddress` ya puesto y, si aplica,
`billingInfo`. Sin C1 esta entrega no tiene qué mandar a `POST /orders`.

## Objetivo

Que un cliente con dirección ya capturada pague con tarjeta vía Stripe Elements — o autorice el
cargo si alguna línea no es `in_stock` — y aterrice en una pantalla que refleja el estado real de su
orden, no una suposición optimista de que el pago ya se completó.

## Lo que ya existe y no se toca

Todo el motor de pagos: `apps/api/src/services/payments/stripe.provider.ts`,
`apps/api/src/services/payment-webhook.service.ts`, `POST /api/v1/webhooks/stripe`, los jobs de
reconciliación y el manejo de disputas. Esta entrega no crea PaymentIntents por su cuenta, no calcula
montos y no mueve el estado de la orden — todo eso ya existe y ya está probado desde M4–M20.

Contrato exacto de lo que se consume:

```
POST /api/v1/orders
  Headers: Idempotency-Key (opcional, string ≤120)
  Body:    ninguno
  201 → { order: PublicOrder, clientSecret: string }

GET /api/v1/orders/number/:orderNumber
  200 → { order: PublicOrder }
```

`createFromCart` (`apps/api/src/services/order.service.ts:291-420`), en orden: 503 si Stripe no está
configurado → si la `Idempotency-Key` ya produjo una orden, la devuelve (`replayCheckout`) → 400 si
falta `shippingAddress` en el carrito → recalcula totales desde el catálogo (nunca confía en lo que
el carrito mostró hace un minuto) → re-evalúa el cupón, y aquí sí lanza si dejó de aplicar →
`resolveCaptureMethod` → **cancela cualquier `pending_payment` anterior del mismo cliente** → crea la
orden → reserva stock 15 minutos → crea el PaymentIntent → responde.

`captureMethod` (`apps/api/src/services/order-pricing.ts:213`): `"automatic"` solo si **todas** las
líneas son `in_stock`; una sola `on_request`/`preorder` vuelve la orden entera `"manual"` (se
autoriza, no se cobra). `PublicCart.captureMethod` ya lo previsualiza — C1 ya lo usa para el aviso del
resumen.

**Ningún endpoint del cliente mueve la orden más allá de `pending_payment`.** Solo el webhook lo hace:
`payment_intent.amount_capturable_updated` → `authorized`; `payment_intent.succeeded` → `paid` +
vacía el carrito. Por eso la confirmación de esta entrega hace polling en vez de confiar en la
respuesta de `confirmPayment`.

Del lado del cliente, reutilizados sin cambio: `CheckoutGuard`, `CheckoutHeader`, `CheckoutSummary`
(C1), `CartProvider`/`useCart`, `apiFetch`, `requireCustomerSession`, `ORDER_STATUS_LABELS` y
`orderStatusBadgeVariant` (`apps/web/src/lib/orders/status.ts`), y el propio
`/pedidos/[orderNumber]/page.tsx` como referencia de tono para el aviso de captura manual.

## 1. Stripe llega al frontend por primera vez

`grep -rn stripe apps/web` hoy no devuelve nada — ni la dependencia ni una variable pública. Es la
primera vez que `apps/web` declara un `NEXT_PUBLIC_*`, así que queda explícito por qué: la
publishable key de Stripe **es** un valor de navegador por definición (Stripe.js la necesita en el
cliente para tokenizar la tarjeta sin que la tarjeta pase por nuestro servidor), a diferencia de
`API_URL`, que `lib/config.ts` mantiene deliberadamente fuera del navegador porque ahí sí sería una
fuga de topología interna.

| Archivo | Cambio |
|---|---|
| `apps/web/package.json` | `pnpm --filter @bw-bikes/web add @stripe/stripe-js @stripe/react-stripe-js` |
| `apps/web/.env.development.example`, `.env.production.example` | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=` con el mismo comentario de procedencia que ya tiene `apps/api/.env.development.example:36-37` (Stripe → Developers → API keys, TEST mode `pk_test_`) |
| `apps/web/src/lib/config.ts` | `stripePublishableKey()`, mismo patrón `throw` en frío que `apiInternalUrl()`/`cloudinaryCloudName()` |
| `apps/web/src/lib/stripe/client.ts` | `export const stripePromise = loadStripe(stripePublishableKey())` — una sola vez a nivel de módulo, nunca dentro de un componente (recrear la promesa en cada render remonta el iframe de Stripe) |

## 2. `/checkout/pago` y la creación de la orden

| Archivo | Responsabilidad |
|---|---|
| `apps/web/src/app/(checkout)/checkout/pago/page.tsx` | Server Component con el mismo `metadata` que `envio/page.tsx`. El guard de sesión ya lo cubre el `layout.tsx` de `(checkout)` |
| `apps/web/src/app/(checkout)/checkout/pago/PaymentStepView.tsx` | `"use client"`. Crea la orden, monta `<Elements>`, maneja el resultado |

Al montar `PaymentStepView`:

1. Si `cart.shippingAddress` es `undefined` → `router.replace("/checkout/envio")`. Es la misma
   condición que el backend rechazaría con 400, pero decírselo aquí evita el viaje de red.
2. `POST /orders` con header `Idempotency-Key`.

**La clave de idempotencia** se guarda en `sessionStorage` junto al `cart.updatedAt` con el que se
generó: `{ key: crypto.randomUUID(), cartUpdatedAt: cart.updatedAt }`. Si al volver a montar
`cart.updatedAt` sigue siendo el mismo, se reusa la clave guardada — un F5 o un remount recuperan la
**misma** orden y el mismo `clientSecret` en vez de que `cancelStalePendingOrders` tumbe la anterior
y cree una segunda. Si `cart.updatedAt` cambió (el cliente volvió a `/carrito` y tocó algo), se genera
una clave nueva — reusar la vieja sería que `replayCheckout` (`order.service.ts:438`) devolviera una
orden con totales que ya no corresponden a lo que el carrito muestra.

`sessionStorage`, no `localStorage`: la clave es de esta pestaña y esta visita al checkout, no algo
que deba sobrevivir para siempre.

## 3. Elements con la apariencia del proyecto

```tsx
<Elements
  stripe={stripePromise}
  options={{
    clientSecret,
    locale: "es",
    appearance: {
      theme: "flat",
      variables: {
        fontFamily: "Hanken Grotesk, sans-serif",
        colorPrimary: "#f2b705",
        colorText: "#0a0a0a",
        colorBackground: "#ffffff",
        colorDanger: "#7a3b32",
        borderRadius: "2px",
      },
      rules: { ".Input": { boxShadow: "none", border: "1px solid #e2e2de" } },
    },
  }}
>
  <PaymentElement />
</Elements>
```

`boxShadow: "none"` explícito porque el Element trae sombra por defecto en `theme: "flat"` y
`DESIGN_SYSTEM.md` §3.2 la prohíbe sin excepción. `payment_method_types: ["card"]` está fijo en el
backend (`stripe.provider.ts:210`), así que el Element solo va a ofrecer tarjeta — correcto y
esperado, no una limitación de esta entrega.

## 4. Confirmar el pago

```ts
const { error } = await stripe.confirmPayment({
  elements,
  confirmParams: { return_url: `${window.location.origin}/gracias/${order.orderNumber}` },
  redirect: "if_required",
});
```

`redirect: "if_required"`: sin 3DS, `confirmPayment` resuelve en la misma pestaña y se navega ahí
mismo con `router.push`; con 3DS, Stripe redirige al `return_url` tras el desafío. **Un solo destino
para los dos caminos** — la pantalla de confirmación no necesita saber por cuál llegó el cliente.

Etiqueta del botón, ya resuelta por `cart.captureMethod` que C1 dejó disponible:

- `"automatic"` → **"Pagar $X"**.
- `"manual"` → **"Autorizar $X"**, con el mismo aviso que ya usa `CheckoutSummary` (C1) repetido junto
  al botón: el cargo se autoriza ahora y se cobra cuando el proveedor confirme el stock.

Errores de Stripe (`error.type`): `"card_error"` y `"validation_error"` → `error.message` tal cual
(ya viene en español por `locale: "es"`); cualquier otro tipo (`"api_error"`, `"invalid_request_error"`)
→ mensaje genérico propio, nunca el texto crudo de Stripe. El formulario **no se desmonta** al fallar
— la orden y el `clientSecret` siguen siendo válidos, el cliente solo necesita otra tarjeta.

Errores de `POST /orders` en sí (antes de llegar a Stripe), ya en español desde el backend:

| HTTP | Mensaje típico | Qué hace el front |
|---|---|---|
| 400 | "Agrega una dirección de envío antes de continuar." | `redirect` a `/checkout/envio` |
| 409 | stock insuficiente / cupón caducado / "ya fue procesada" | Mensaje del backend + `ButtonLink` a `/carrito` |
| 429 | `checkoutRateLimiter` | Mensaje del backend, sin reintento automático |
| 502 | fallo del gateway al crear el intent | Mensaje genérico + "Reintentar" (repite el `POST /orders` con la misma clave) |
| 503 | Stripe no configurado | Bloque de mantenimiento, sin renderizar el formulario |

## 5. `/gracias/[orderNumber]` — confirmación

Vive en `(storefront)`, no en `(checkout)`: `DESIGN_SYSTEM.md:326` le devuelve la marca a esta
pantalla ("Pedido confirmado", eyebrow con `rhino-dorado.svg` 16px — es el "momento positivo del
flujo", el lugar correcto para la marca justo después de la ausencia total en checkout).

| Archivo | Responsabilidad |
|---|---|
| `apps/web/src/app/(storefront)/gracias/[orderNumber]/page.tsx` | Server: `requireCustomerSession`, `metadata` `robots: { index: false }` |
| `apps/web/src/app/(storefront)/gracias/[orderNumber]/OrderConfirmationView.tsx` | Client: polling y las cinco pantallas de estado |

Polling de `GET /orders/number/:orderNumber` cada 2s, hasta 30s (15 intentos):

| Estado leído | Pantalla |
|---|---|
| `order.payment.state === "pending"` | "Estamos confirmando tu pago…" + spinner, sin eyebrow todavía (nada que celebrar aún) |
| `order.status === "paid"` | Eyebrow "Pedido confirmado" + rinoceronte + número de orden + total + `ButtonLink` a `/pedidos/[orderNumber]` |
| `order.status === "awaiting_supplier_confirmation"` | "Pago autorizado" + mismo aviso que ya usa `/pedidos/[orderNumber]/page.tsx` sobre la confirmación del proveedor |
| `order.payment.state === "failed"` o `order.status === "cancelled"` | "No pudimos procesar tu pago" + `ButtonLink` a `/carrito` (el carrito no se vació — sigue ahí) |
| Se agotan los 15 intentos sin resolver | "Tu pago sigue procesándose, te avisamos por correo" + `ButtonLink` a `/mi-cuenta/pedidos`, sin más polling |

`CartProvider` gana `refresh()` — una función que repite el `GET /cart` y reemplaza el estado, mismo
patrón que la hidratación inicial. Necesaria porque el webhook llama `emptyAfterCheckout` de forma
asíncrona: sin `refresh()`, el badge del navbar seguiría mostrando las líneas ya compradas hasta la
próxima navegación completa.

## Tests

`apps/web/src/lib/api/checkout.test.ts`: `createOrder()` manda `Idempotency-Key` cuando se le pasa
una clave y la omite cuando no; mapea cada HTTP de la tabla de arriba a un mensaje.

`PaymentStepView.test.tsx`, con `@stripe/react-stripe-js` mockeado (`vi.mock`, mismo patrón que
`CartProvider.test.tsx`): sin `shippingAddress` → navega a `/checkout/envio` sin llamar `POST /orders`;
dos montajes seguidos con el mismo `cart.updatedAt` → una sola clave de idempotencia, un solo
`POST /orders`; `cart.updatedAt` distinto entre montajes → clave nueva; `captureMethod: "manual"` →
botón dice "Autorizar"; `confirmPayment` con `error.type: "card_error"` → mensaje inline, formulario
sigue montado; 409 de `POST /orders` → `ButtonLink` a `/carrito`.

`OrderConfirmationView.test.tsx` con `vi.useFakeTimers()` (sin `sleep` reales): `pending` → pantalla
de espera; segunda respuesta con `status: "paid"` → pantalla de éxito, deja de hacer polling;
`awaiting_supplier_confirmation` → pantalla de autorización; agotar 15 intentos en `pending` →
pantalla de timeout.

Manual, con `stripe listen --api-key "$STRIPE_SECRET_KEY" --forward-to
localhost:4000/api/v1/webhooks/stripe`: `4242 4242 4242 4242` (éxito automático),
`4000 0025 0000 3155` (fuerza 3DS, confirma el retorno por `return_url`),
`4000 0000 0000 9995` (declinada, confirma que el formulario no se pierde), y un producto
`on_request` para verificar el flujo de autorización manual completo hasta
`awaiting_supplier_confirmation`.

## Verificación

```
pnpm --filter @bw-bikes/api test
pnpm --filter @bw-bikes/web test
pnpm typecheck && pnpm lint
```

Comprobación específica: F5 sobre `/checkout/pago` a mitad de la captura de tarjeta y confirmar en el
panel admin que sigue existiendo **una sola** orden `pending_payment` para ese cliente, no dos.

Recorrido manual final: carrito con una bici `in_stock` → `/checkout/envio` → `/checkout/pago` →
`4242…` → `/gracias/[n]` en estado "Pedido confirmado" → `/mi-cuenta/pedidos` y el panel admin
muestran la orden `paid`. Repetir con una línea `on_request`: el botón dice "Autorizar", la
confirmación llega a "Pago autorizado" y el panel admin la muestra `awaiting_supplier_confirmation`.
Apagar `pnpm dev` y `stripe listen` al terminar.

## Hecho cuando

- Un cliente con dirección capturada paga con tarjeta y llega a una confirmación que refleja el
  estado real de la orden, no una suposición.
- Un carrito con líneas `on_request`/`preorder` autoriza en vez de cobrar, y el botón lo dice antes
  de pagar ("Autorizar" vs. "Pagar").
- Una tarjeta declinada muestra el motivo real y deja reintentar sin perder la orden ni crear una
  segunda.
- Un F5 en el paso de pago recupera la misma orden.
- 3DS completa el flujo y termina en la misma pantalla que un pago sin 3DS.
- Todos los tests de arriba pasan y `pnpm typecheck && pnpm lint` están verdes.

## Fuera de alcance

Checkout de invitado. Métodos de pago distintos de tarjeta (OXXO, SPEI, meses sin intereses) — el
PaymentIntent fija `payment_method_types: ["card"]`, ampliarlo es un cambio de backend propio, no de
esta entrega. Reembolsos y disputas desde el front — se gestionan en el Dashboard de Stripe y en el
panel admin, ya construidos. Notificaciones push/SMS del estado del pedido — el correo transaccional
ya existe (`sendOrderPaidEmail` y siblings) y no se toca aquí.
