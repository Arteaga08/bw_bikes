# A6 — Historial y detalle de pedidos

Lee primero [`00-CONTEXTO.md`](00-CONTEXTO.md). Requiere A2 (shell). Independiente de A3, A4, A5.

## Objetivo

Que el cliente vea su historial de pedidos desde `/mi-cuenta/pedidos`, y que cada correo
transaccional ("Ver mi pedido") abra un detalle real en `/pedidos/[orderNumber]`.

## Por qué hace falta un endpoint nuevo

`GET /orders` y `GET /orders/:id` ya existen y no se tocan (`order.service.ts:1360` `getForUser`,
`:1372` `listForUser` — ambos filtran por `userId`, así que ya son seguros de reusar). El problema es
la clave: los correos transaccionales (`sendOrderPaidEmail`, `sendOrderProcessingEmail`,
`sendOrderDeliveredEmail`, `sendRefundConfirmedEmail`, `sendPaymentFailedEmail`, en
`apps/api/src/services/mailer/`) ya enlazan a `${clientUrl}/pedidos/${orderNumber}` — por
**número**, no por id — y esa ruta hoy no existe ni en la API ni en `apps/web`.

## Backend

Un endpoint nuevo en `apps/api/src/routes/order.route.ts`, junto a `GET /:id`:

```
GET /api/v1/orders/number/:orderNumber
```

**Orden de las rutas importa**: debe declararse en el router antes que `GET /:id` si Express pudiera
confundir `number` con un `:id` — verificar al implementar; si `:id` valida `ObjectId` primero y
falla limpio con 404 en vez de capturar la ruta, el orden no importa, pero confirmarlo con un test.

Handler en `order.controller.ts` + función nueva en `order.service.ts`,
`getForUserByNumber(userId, orderNumber)`, mismo patrón que `getForUser` línea 1360 pero
`Order.findOne({ orderNumber: orderNumber.toUpperCase(), userId })` (el modelo ya guarda
`orderNumber` en mayúsculas). Un número que no existe o pertenece a otro cliente responde **404**,
no 403 — no hay que confirmarle a nadie que un número de orden ajeno existe.

Validador: `orderNumberParamSchema` en `order.validator.ts`, un string que siga el patrón
`BW-\d{4}-[A-Z0-9]{6}` (ver la función que genera `orderNumber` en `order.service.ts` para el
alfabeto exacto) — un formato inválido responde 400 sin tocar la base de datos.

## Frontend

- `apps/web/src/app/(storefront)/mi-cuenta/pedidos/page.tsx` — `GET /orders` con paginación (el
  endpoint ya la soporta). Encabezado con el contador ("Historial de pedidos · 3 pedidos", como la
  referencia visual). Cada fila: número de orden, fecha, estado (traducir `OrderStatus` a una
  etiqueta en español con `Badge`), total, enlace "Ver detalle" → `/pedidos/[orderNumber]`. Vacío →
  "Aún no has realizado ningún pedido." + CTA al catálogo.
- `apps/web/src/app/(storefront)/pedidos/[orderNumber]/page.tsx` (Server Component,
  `requireCustomerSession()` + `serverApiFetch("/orders/number/" + orderNumber)`, 404 → `notFound()`
  de Next). Es la ruta fuera de `/mi-cuenta` porque es la que ya usan los correos — no moverla ahí
  evita tocar las plantillas de `apps/api/src/services/mailer/`.
  - Estado actual con `Badge`, y una línea de tiempo simple a partir de `statusHistory` (fecha +
    estado, en español).
  - Líneas del pedido con su snapshot (`OrderLineSnapshot`): imagen, nombre, marca, talla/color,
    cantidad, precio.
  - Totales: subtotal, descuento si hubo, IVA, envío, total.
  - Dirección de envío.
  - Si `shipment` existe: número de guía + enlace de rastreo (`shipment.trackingUrl`, ya lo calcula
    el backend con `buildTrackingUrl`).
  - Si `payment.captureMethod !== "automatic"` y el estado es `awaiting_supplier_confirmation`, un
    aviso explicando que el cargo se confirma cuando el proveedor confirme el stock (mismo lenguaje
    que ya usa el resto del sistema para este caso).
- Nada de esto ofrece cancelar, reordenar ni descargar factura — fuera de alcance.

## Tests

Backend: `apps/api/tests/order-by-number.test.ts` — encuentra por número propio, 404 en número
inexistente, **404 (no 403) en número de otro usuario**, 400 en formato inválido, insensible a
mayúsculas/minúsculas en la URL.

Web: un test de `page.tsx` de detalle no es práctico (Server Component con fetch); cubrir en su
lugar los componentes de presentación que reciban el pedido ya resuelto (`OrderTimeline.test.tsx`,
`OrderSummaryTable.test.tsx` o los nombres que tomen al descomponer la página en piezas pequeñas,
siguiendo la convención de componentes de responsabilidad única).

## Verificación

```
pnpm --filter @bw-bikes/api test
pnpm --filter @bw-bikes/web test
pnpm typecheck && pnpm lint
```

Manual: como no hay checkout todavía (fase 2 de M13), no habrá pedidos reales que listar — verificar
con una orden creada directamente en Mongo (o con el helper de factories que ya usan los tests de
`order-checkout.test.ts`) que el historial y el detalle la muestran correctamente, y que abrir la
URL exacta que un correo mandaría (`/pedidos/BW-2026-XXXXXX`) funciona.

## Hecho cuando

- El cliente ve su historial en `/mi-cuenta/pedidos`, vacío o con datos.
- `/pedidos/[orderNumber]` muestra el detalle completo y es la misma URL que ya usan los correos.
- Un número de orden ajeno responde 404 sin filtrarse información.
- Todos los tests de arriba pasan y `pnpm typecheck && pnpm lint` están verdes.
