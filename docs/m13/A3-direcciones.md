# A3 — Libreta de direcciones y datos fiscales

Lee primero [`00-CONTEXTO.md`](00-CONTEXTO.md). Requiere A2 (shell de `/mi-cuenta`, `AccountCard`).
Independiente de A4, A5, A6.

## Objetivo

Que el cliente guarde varias direcciones de envío con una predeterminada, y por separado sus datos
fiscales (CFDI), reutilizables al llenar el carrito.

## Backend

### Direcciones

Nuevo `apps/api/src/models/schemas/saved-address.schema.ts`. **No reutiliza directamente
`shippingAddressSchema`** porque ese lleva `_id: false` (ahí una dirección es una propiedad del
carrito, no algo direccionable) — aquí sí hace falta `_id` para poder editar/borrar una entrada de la
lista. Reutiliza en cambio las **constantes** que `shipping-address.schema.ts` ya exporta
(`MAX_RECIPIENT_NAME_LENGTH`, `MAX_ADDRESS_LINE_LENGTH`, `PHONE_LENGTH`, `POSTAL_CODE_LENGTH`,
`MAX_REFERENCES_LENGTH`) y el enum `MEXICAN_STATES` de `packages/shared/src/types/shipping.ts`, para
que ambos esquemas no puedan desalinearse en límites. Mismos campos que `ShippingAddress` más:

```ts
label: string;       // ≤ 30, p.ej. "Casa", "Oficina"
isDefault: boolean;  // default false
```

`MAX_SAVED_ADDRESSES = 5` en el mismo archivo.

En `user.model.ts`: `addresses: [savedAddressSchema]`, con un hook `pre("validate")` (o lógica en el
servicio, decidir según cuál quede más simple de testear) que garantiza **como máximo una**
`isDefault: true` — al marcar una nueva predeterminada, desmarca las demás en la misma operación.

Endpoints (`account.route.ts` / `account.controller.ts` / `account.service.ts` /
`account.validator.ts`, sumando a lo que dejó A2):

- `GET /account/addresses`
- `POST /account/addresses` — si es la primera dirección, se marca `isDefault: true`
  automáticamente aunque el cliente no lo pida (una libreta con una sola dirección y ninguna
  predeterminada no tiene sentido). Rechaza con 409 si ya hay 5.
- `PATCH /account/addresses/:addressId`
- `DELETE /account/addresses/:addressId` — si la eliminada era la predeterminada y quedan otras,
  **promueve la primera restante** a predeterminada. Si no queda ninguna, no pasa nada más.
- `POST /account/addresses/:addressId/default` — marca esa y desmarca las demás.

`GET /account` (A2) crece con `addresses: SavedAddress[]`.

### Datos fiscales (CFDI)

Reutiliza tal cual `billingInfoSchema` de `apps/api/src/models/schemas/billing-info.schema.ts` (el
mismo que ya usa `Cart.billingInfo`) — un solo juego de datos por cliente, no una lista. En
`user.model.ts`: `billingInfo?: BillingInfo`.

- `PUT /account/billing-info` — reemplaza el documento completo (mismo patrón que
  `PUT /cart/billing-info`, que ya valida `rfc`, `legalName`, `cfdiUse`, `taxRegime`, `postalCode`).
- `DELETE /account/billing-info` — lo borra (los datos fiscales son opcionales, un pedido es válido
  sin ellos).

`GET /account` crece con `billingInfo?: BillingInfo`.

### Nota para B y para la fase 2 (checkout)

La libreta **rellena** la dirección/CFDI del carrito (copia los valores a
`PUT /cart/shipping-address` / `PUT /cart/billing-info` cuando el cliente elige una entrada de su
libreta), **nunca la referencia por id**. El pedido necesita un snapshot congelado en el momento del
checkout que no cambie si el cliente edita su libreta después — eso ya lo garantiza el diseño
existente del carrito (`Cart.shippingAddress` es una copia, no un `ref`). Esta entrega no toca el
carrito ni el checkout; solo deja la libreta lista para que B la consuma como "rellenar desde".

## Frontend

- `apps/web/src/app/(storefront)/mi-cuenta/direcciones/page.tsx`. Encabezado con "Añadir dirección"
  arriba a la derecha (ver la referencia visual en `00-CONTEXTO.md`). Grid de tarjetas de dirección:
  `label`, nombre del destinatario, calle y colonia, ciudad/estado/CP, teléfono, badge
  "Predeterminada" en la que corresponda, y tres acciones: "Editar", "Eliminar",
  "Marcar como predeterminada" (oculta en la que ya lo es). Lista vacía → placeholder punteado con
  un `+` centrado, igual que la captura de referencia.
- `apps/web/src/components/account/AddressForm.tsx` dentro de un `Modal`, reutilizado para crear y
  editar: los mismos campos que `ShippingAddress` (incluido `state` con `Select` sobre
  `MEXICAN_STATES` y `postalCode` de 5 dígitos) más `label`. Confirmación con `AlertCard`/`Modal` de
  confirmación antes de eliminar.
- Segunda sección en la misma página, **"Datos de facturación"**: una sola `AccountCard` con el CFDI
  (RFC, razón social, uso, régimen, CP fiscal) editable o vacía con CTA "Agregar datos fiscales".
  `BillingInfoForm.tsx` en un `Modal`, con `Select` para `CFDI_USES` y `TAX_REGIMES` (ambos ya
  exportados por `packages/shared/src/types/billing.ts`, mostrando su descripción en español, no el
  código SAT crudo — usar el mismo mapeo de etiquetas que ya use el admin si existe uno, o crear uno
  compartido si no).

## Tests

Backend: `apps/api/tests/account-addresses.test.ts` — CRUD completo, tope de 5 (409 en el sexto
intento), la primera dirección se marca predeterminada sola, marcar una nueva predeterminada
desmarca la anterior, eliminar la predeterminada promueve a la siguiente, eliminar la única
dirección deja la libreta vacía sin error. `apps/api/tests/account-billing-info.test.ts` — poner,
actualizar, borrar, y que rechace un RFC/uso/régimen inválido igual que el validador del carrito.

Web: `AddressForm.test.tsx` (validación de campos, envío), `AddressCard.test.tsx` (o el nombre que
tome el componente de tarjeta), `BillingInfoForm.test.tsx`.

## Verificación

```
pnpm --filter @bw-bikes/api test
pnpm --filter @bw-bikes/web test
pnpm typecheck && pnpm lint
```

Manual: guardar tres direcciones, cambiar la predeterminada, eliminar la predeterminada y confirmar
que otra la reemplaza, intentar una sexta dirección y ver el 409. Guardar y borrar datos fiscales.

## Hecho cuando

- El cliente gestiona su libreta de direcciones (crear, editar, eliminar, marcar predeterminada) con
  el tope de 5 respetado.
- El cliente gestiona sus datos fiscales por separado, en su propia tarjeta.
- Todos los tests de arriba pasan y `pnpm typecheck && pnpm lint` están verdes.
