# C1 — Checkout, paso de datos

Lee primero [`00-CONTEXTO.md`](00-CONTEXTO.md). Abre la **fase 2 de M13**. Requiere A1 (sesión de
cliente), A2–A3 (perfil, libreta de direcciones y CFDI, que aquí se reutilizan y se extienden) y B
(el carrito completo, que es la entrada de esta pantalla). Su continuación es
[`C2-checkout-pago.md`](C2-checkout-pago.md), que no se puede empezar sin esta.

## Objetivo

Que un cliente con carrito comprable capture o confirme a dónde va su pedido y, si la necesita, su
factura, en una pantalla de conversión sin distracciones, y llegue al paso de pago con el carrito ya
listo para que `POST /orders` lo consuma sin pedirle nada más.

## Lo que ya existe y no se toca

**El checkout del backend está terminado y `POST /orders` no recibe body.**
`createOrderSchema = Joi.object({})` (`apps/api/src/validators/order.validator.ts:32`): la dirección,
el CFDI y el cupón se capturan **antes**, sobre el carrito, y `createFromCart` los lee de ahí y los
copia como snapshot a la orden. Esta entrega es, por eso, la que llena el carrito con esos datos —
no construye nada de precios, reservas ni pagos.

Endpoints que consume, todos bajo `protect` y ya probados desde M4–M20:

```
PUT    /api/v1/cart/shipping-address   body = ShippingAddress   → { cart: PublicCart }
PUT    /api/v1/cart/billing-info       body = BillingInfo       → { cart: PublicCart }
POST   /api/v1/cart/coupon             body = { code }          → { cart: PublicCart }
GET    /api/v1/account                                          → { account: AccountDTO }
POST   /api/v1/account/addresses       body = SaveAddressInput  → { addresses: SavedAddress[] }
POST   /api/v1/account/addresses/:addressId/default             → { addresses: SavedAddress[] }
```

Del lado del cliente ya están hechos y se reutilizan sin modificar: `CartProvider`/`useCart`
(`apps/web/src/components/cart/CartProvider.tsx`), `CouponForm.tsx`, `CartUnauthenticated.tsx`,
`useAsyncAction`, `apiFetch`/`serverApiFetch`, `requireCustomerSession`, y todo
`apps/web/src/lib/api/account.ts`.

`packages/shared` ya exporta lo que hace falta: `ShippingAddress`, `MEXICAN_STATES`, `BillingInfo`,
`CFDI_USES`/`CFDI_USE_LABELS`, `TAX_REGIMES`/`TAX_REGIME_LABELS`, `SavedAddress`, `SaveAddressInput`,
`AccountDTO`, `PublicCart`.

## 0. Layout elegido: acordeón de dos columnas

Tres variantes se mostraron en mockup (2026-09-01, localhost); Manuel eligió la **A — acordeón de
dos columnas**, la que más continúa el lenguaje visual ya establecido por `/carrito`: pasos apilados
a la izquierda (cada uno se colapsa a una línea de resumen con "Editar" al completarse, mismo patrón
que `AccountCard`), resumen de compra `sticky` a la derecha. Se descartan la columna centrada con
resumen plegable (variante B) y el split oscuro/claro (variante C) — quedan documentadas en el
mockup por si se reconsidera, pero no se construyen.

Estructura de la columna izquierda en `/checkout/envio`:

1. **Envío** — abierto por defecto.
2. **Facturación** — colapsado tras el checkbox "Necesito factura".
3. **Pago** — placeholder deshabilitado ("Se habilita al continuar"), nunca interactivo aquí; es
   contenido de C2.

Al completar el paso de Envío (`PUT /cart/shipping-address` exitoso), la tarjeta se colapsa a una
línea con la dirección resumida + "Editar", igual que el patrón ya usado en `AccountCard` para
"Editar" con `Button variant="text"`. Este colapso es puramente de UI del lado del cliente — no hay
concepto de "paso" en el backend, que solo ve el carrito completo o incompleto.

## 1. Un grupo de rutas propio: `(checkout)`

`handoff/DESIGN_SYSTEM.md:325` y `:350` son explícitos: el checkout es **la única pantalla del sitio
con cero apariciones del rinoceronte, footer oculto y navegación reducida** — "pantalla de conversión
de alto riesgo, la prioridad absoluta es que complete el pago sin fricción visual". Eso no se resuelve
escondiendo el footer con un `usePathname` dentro de `(storefront)`: se resuelve con un grupo de rutas
hermano, que además evita montar el `CartDrawer` en una pantalla donde abrir un drawer de carrito
encima del formulario sería un error.

| Archivo | Responsabilidad |
|---|---|
| `apps/web/src/app/(checkout)/layout.tsx` | `requireCustomerSession("/checkout/envio")`; monta `ToastProvider` + `CartProvider` **sin `CartDrawer`**; `SkipLink` + `<main id="contenido" tabIndex={-1}>`. Sin `Navbar` y sin `Footer` |
| `apps/web/src/components/checkout/CheckoutHeader.tsx` | La barra reducida, 64px como el `Navbar`: wordmark en texto (`font-display text-h3`, **sin rinoceronte**), "Pago seguro" con `Lock` de Phosphor, y "Volver al carrito" como `Button variant="text"`. Sin links de catálogo, sin botón de carrito, sin cuenta |
| `apps/web/src/app/(checkout)/checkout/page.tsx` | Solo `redirect("/checkout/envio")` — `/checkout` a secas es una URL que la gente escribe |
| `apps/web/src/app/(checkout)/checkout/envio/page.tsx` | Server Component. `serverApiFetch<{ account: AccountDTO }>("/account")` para prellenar sin un round-trip de cliente, y `metadata` con `robots: { index: false, follow: false }` (igual que `/carrito`) |
| `apps/web/src/app/(checkout)/checkout/envio/ShippingStepView.tsx` | `"use client"`. Recibe el `AccountDTO` por props y orquesta guarda → dirección → factura → resumen |

El guard de sesión vive **solo** en el layout, no repetido por página: `(checkout)` entero exige
sesión, igual que `mi-cuenta/layout.tsx` ya hace con su subárbol.

## 2. Guarda de carrito

`apps/web/src/components/checkout/CheckoutGuard.tsx`, mismo molde que `CartPageClient.tsx` de B —
un switch sobre `useCart().status`, no una cascada de `if` sueltos:

| Estado | Pantalla |
|---|---|
| `idle` / `loading` | `CheckoutSkeleton` |
| `anonymous` | `CartUnauthenticated` reutilizado. No debería ocurrir (el guard de servidor ya redirigió), pero una sesión que caduca con la pantalla abierta sí lo alcanza |
| `error` | Bloque `bg-estado-error-soft` + "Reintentar" |
| `cart.lines.length === 0` | `EmptyState` "Tu carrito está vacío" + CTA al catálogo |
| `cart.hasBlockingLines` | Bloque `bg-estado-error-soft` con `WarningCircle` + `ButtonLink` "Volver al carrito"; el formulario se renderiza deshabilitado detrás, no desaparece |

**Ninguno de estos casos redirige solo.** Sacar a alguien de la pantalla de pago sin que lo haya
pedido es peor que explicarle por qué no puede continuar; y el backend ya es el guardia real
(`createFromCart` vuelve a validar todo).

## 3. Dirección de envío

`AddressForm.tsx` (A3) hoy mezcla cuatro cosas: los campos, la validación, el `Modal` y las llamadas
a la API de cuenta. El checkout necesita las dos primeras sin las dos últimas. Se extrae:

| Archivo | Cambio |
|---|---|
| `apps/web/src/components/account/AddressFields.tsx` | **Nuevo.** Campos controlados (`form`, `errors`, `onChange`) y `validateAddress(form): FormErrors` exportado. Sin `Modal`, sin `fetch`, sin estado de envío: solo presenta y valida |
| `apps/web/src/components/account/AddressForm.tsx` | Pasa a componer `AddressFields` dentro de su `Modal`. **Sin cambio de comportamiento ni de props** — sus tests de A3 siguen pasando tal cual |

Comportamiento en el checkout (`ShippingStepSection.tsx`):

- **Libreta vacía** → el formulario directo, prellenado con `firstName lastName` en `recipientName` y
  `phone` del perfil (`account.profile`). Es la primera compra: se pide todo aquí, una sola vez.
- **Libreta con direcciones** → tarjeta con la predeterminada ya seleccionada, más "Cambiar"
  (lista de radio con las guardadas, solo si hay más de una) y **"Agregar dirección"**, que abre
  `AddressFields` para capturar una distinta.
- **El `label` no se pide.** "Nombre de la dirección" es vocabulario de gestión de cuenta y añade un
  campo a una pantalla de conversión. Se deriva de `street` recortado a `MAX_LABEL_LENGTH` (30,
  `apps/api/src/models/schemas/saved-address.schema.ts:12`), que es lo que el cliente reconocerá
  después en `/mi-cuenta/direcciones`.
- **Al continuar**, en este orden exacto:
  1. Si la dirección es nueva → `POST /account/addresses`.
  2. Si la elegida no es la predeterminada → `POST /account/addresses/:addressId/default`. Así la
     siguiente compra autollena con la dirección que realmente usó. `createAddress`
     (`account.service.ts:142`) solo marca `isDefault` cuando la libreta estaba vacía, por eso hace
     falta el segundo paso.
  3. `PUT /cart/shipping-address` con los campos de `ShippingAddress` — **sin `id`, `label` ni
     `isDefault`**, que el validador del carrito no acepta (`stripUnknown` los borraría, pero
     mandarlos sería mentir sobre el contrato).
- **Libreta llena**: `createAddress` responde 409 con "No puedes guardar más de 5 direcciones."
  cuando ya hay `MAX_SAVED_ADDRESSES`. Ese 409 **no bloquea la compra**: se hace igual el
  `PUT /cart/shipping-address` y se muestra una línea discreta —
  "Tu libreta está llena, así que esta dirección se usa solo para este pedido." Nadie debería perder
  una compra por una libreta de direcciones.

## 4. Facturación CFDI

Colapsada tras un `Checkbox` "Necesito factura", desmarcado por defecto: la mayoría de las compras no
la piden y no tiene por qué costar espacio en la pantalla. Al marcarlo se despliega
`BillingFields.tsx` — extraído de `BillingInfoForm.tsx` con exactamente el mismo criterio y el mismo
alcance que `AddressFields` — prellenado con `account.billingInfo` si el cliente ya lo tiene guardado
de A3.

Al continuar: `PUT /cart/billing-info`. Al desmarcarlo: `DELETE /cart/billing-info` (§5, aprobado 2026-09-01).

`CFDI_USE_LABELS` y `TAX_REGIME_LABELS` (`packages/shared/src/types/billing.ts`) alimentan los dos
`Select`; los valores en inglés no se muestran nunca.

## 5. Único cambio de backend: `DELETE /cart/billing-info` (aprobado 2026-09-01)

`emptyAfterCheckout` (`apps/api/src/services/cart.service.ts:387`) hace `$set: { lines: [] }` y nada
más: `cart.billingInfo` **sobrevive a la compra y no hay forma de quitarlo** — `cart.route.ts` tiene
`PUT /billing-info` pero no `DELETE`, aunque `DELETE /account/billing-info` sí existe desde A3.

Sin ese endpoint, un cliente que pidió factura una vez recibiría datos CFDI copiados en todas sus
órdenes futuras, y el checkbox "Necesito factura" desmarcado sería mentira. No es una feature nueva:
es cerrar un agujero que esta pantalla es la primera en poder tocar.

| Archivo | Cambio |
|---|---|
| `apps/api/src/services/cart.service.ts` | `removeBillingInfo(userId)`: `cart.billingInfo = undefined`, `save`, devuelve `toPublicCart`. Espeja `removeCoupon`. Añadir al objeto `cartService` del final |
| `apps/api/src/controllers/cart.controller.ts` | `removeCartBillingInfo`, mensaje "Datos de facturación eliminados." |
| `apps/api/src/routes/cart.route.ts` | `router.delete("/billing-info", removeCartBillingInfo)` junto al `PUT`. Sin rate limiter, misma razón que `DELETE /coupon`: borrar algo propio no revela nada |

## 6. Resumen de compra

`apps/web/src/components/checkout/CheckoutSummary.tsx`. La misma escalera que `CartSummary`
(subtotal → descuento si `discountCents > 0` → IVA → envío, "Gratis" si 0 → total), más la lista de
líneas en modo lectura (imagen, nombre, variante, cantidad, importe; **sin stepper y sin eliminar**
— para eso está `/carrito`), y `CouponForm` reutilizado **tal cual**.

El aviso de `captureMethod !== "automatic"` se repite aquí con copy más explícito que en el carrito,
porque el cliente está a un paso de autorizar un cargo: no basta con la línea informativa que ya trae
`CartSummary.tsx:49-54`.

`cart-line-status.ts` de B se reutiliza sin tocar para la línea bloqueada — incluida su regla de
nunca interpolar cifras de stock (`00-CONTEXTO.md`, decisión 7).

## 7. La CTA del carrito deja de estar muerta

`apps/web/src/components/cart/CartSummary.tsx:63-65` — el
`<Button disabled title="Disponible próximamente">Pagar</Button>` pasa a
`<ButtonLink href="/checkout/envio" variant="primary" size="md" className="w-full">Ir a pagar</ButtonLink>`.
"Ir a pagar" no es una elección de copy nueva: es la etiqueta que `DESIGN_SYSTEM.md:225` ya fijó para
este control, y §4.6 explica que carrito y checkout no tienen componente propio a propósito.

Con `hasBlockingLines` sigue siendo un `Button` deshabilitado, pero con `title` que explica el motivo
real en vez de "Disponible próximamente".

Actualizar además los doc-comments que hoy afirman lo contrario: el de `CartSummary` ("El CTA de pago
queda `disabled`: el checkout es fase 2 de M13") y el de `CartDrawer.tsx` ("No CTA de pago aquí").
El drawer **sigue sin CTA de pago** — ahí la decisión no cambia: el repaso de montos antes de pagar
se hace en `/carrito`, no en un panel lateral.

## Tests

Backend: `apps/api/tests/cart-billing-info.test.ts` — `PUT` guarda; `DELETE` deja el carrito sin
`billingInfo`; `DELETE` sobre un carrito que nunca lo tuvo responde 200 (idempotente); anónimo → 401.

Web, a actualizar (hoy afirman el estado deshabilitado del CTA): el test de `CartSummary` y cualquier
aserción sobre `title="Disponible próximamente"` en `components/cart`.

Web, nuevos: `AddressFields.test.tsx` (`validateAddress` rechaza teléfono de 9 dígitos y CP de 4;
acepta `interiorNumber` y `references` vacíos); `ShippingStepView.test.tsx` (libreta vacía → sale el
formulario; libreta con predeterminada → sale la tarjeta; "Agregar dirección" → dispara
`POST /account/addresses`, luego `/default`, luego `PUT /cart/shipping-address`, **en ese orden**;
409 de libreta llena → igual se manda el `PUT` y aparece el aviso; el `label` enviado es `street`
recortado a 30); `CheckoutGuard.test.tsx` (carrito vacío, `hasBlockingLines`, `anonymous` y `error`
— con **assert explícito de que no hay navegación** en ninguno); `BillingSection.test.tsx`
(desmarcar dispara `DELETE`); `CheckoutSummary.test.tsx` (aviso de captura manual; descuento oculto
cuando es 0; **assert de que ningún número de stock aparece en el DOM**, misma regla que B).

## Verificación

```
pnpm --filter @bw-bikes/api test
pnpm --filter @bw-bikes/web test
pnpm typecheck && pnpm lint
```

Comprobación específica: `grep` de que ninguna cadena renderizada en `components/checkout` interpola
`available`/`onHand`, y de que `app/(checkout)` no importa `Footer` ni ningún asset de
`public/brand/` (la regla de cero rinocerontes de `DESIGN_SYSTEM.md:350` debe ser verificable, no
solo prometida).

Recorrido manual: cuenta nueva sin direcciones → agregar al carrito → "Ir a pagar" → capturar
dirección → confirmar en `/mi-cuenta/direcciones` que quedó guardada y predeterminada → volver a
`/checkout/envio` y comprobar que autollena → "Agregar dirección" con una segunda → confirmar que la
nueva pasó a ser la predeterminada → marcar y desmarcar factura → vaciar el carrito en otra pestaña y
recargar el checkout.

## Hecho cuando

- Un cliente llega a `/checkout/envio` desde el carrito y captura su dirección de envío.
- La dirección con la que paga queda guardada y predeterminada, y la siguiente compra la autollena.
- Puede pedir factura, y también puede dejar de pedirla.
- Un carrito vacío o con líneas bloqueadas no deja avanzar, explica por qué y no redirige solo.
- El checkout no muestra footer, ni navegación completa, ni un solo rinoceronte.
- Todos los tests de arriba pasan y `pnpm typecheck && pnpm lint` están verdes.

## Fuera de alcance

Stripe, `POST /orders` y la pantalla de confirmación son [`C2-checkout-pago.md`](C2-checkout-pago.md).
Checkout de invitado (decisión 1 de `00-CONTEXTO.md`). Editar cantidades desde el checkout — para eso
está `/carrito`. "Te faltan $X para envío gratis": los umbrales viven en `Settings` y `GET /settings`
es de administrador; exponerlos requeriría un endpoint público nuevo.
