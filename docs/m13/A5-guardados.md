# A5 — Guardado para más tarde

Lee primero [`00-CONTEXTO.md`](00-CONTEXTO.md). Requiere A2 (shell). Independiente de A3, A4, A6.

## Objetivo

Que el cliente marque productos con un corazón desde el catálogo o la ficha, y los vea reunidos en
`/mi-cuenta/guardados`.

## Backend

En `user.model.ts`, campo `wishlist[]`:

```ts
interface WishlistEntry {
  itemType: ItemType;   // "bike" | "accessory"
  itemId: ObjectId;
  addedAt: Date;
}
```

`MAX_WISHLIST_ITEMS = 50`. Índice compuesto único en el subdocumento por `(itemType, itemId)` —
guardar dos veces el mismo producto es un no-op, no un error ni una entrada duplicada.

Endpoints:

- `GET /account/wishlist` — **hidrata contra el catálogo en cada lectura**, con el mismo patrón que
  `renderCart` en `cart.service.ts`: la lista guarda solo referencias (`itemType`, `itemId`), nunca
  precio ni nombre, y cada lectura resuelve el producto vigente. Un producto archivado o con la
  variante inactiva se marca `isAvailable: false` en la respuesta en vez de desaparecer — el cliente
  decide si lo quita. Reutilizar `resolveCartLines`/lo que ya exista para resolver un `itemId` contra
  el catálogo activo, o la función equivalente que use el servicio de catálogo; no duplicar esa
  lógica de resolución.
- `POST /account/wishlist` — body `{ itemType, itemId }`. 409 si ya hay 50. Si el producto ya estaba
  guardado, responde 200 sin duplicar (idempotente).
- `DELETE /account/wishlist/:itemType/:itemId`.

`GET /account` (A2) crece con un conteo (`wishlistCount`) o la lista completa — decidir según el
tamaño; probablemente basta el conteo ahí y `GET /account/wishlist` aparte para el detalle
hidratado, evitando pagar la hidratación completa en cada `GET /account`.

## Frontend

- `apps/web/src/components/storefront/products/SaveButton.tsx` (`"use client"`), un ícono de corazón
  con `useAsyncAction`, mismo patrón que `AddToCartButton` de la entrega B: marcado/no marcado según
  si el producto está en la wishlist. Sin sesión → navega a `/ingresar?redirect=…` igual que el
  carrito (reutilizar `loginHref` de A1).
- `apps/web/src/components/storefront/WishlistProvider.tsx` (`"use client"`), montado en
  `(storefront)/layout.tsx` junto al `CartProvider` de B: mantiene el conjunto de ids guardados en
  memoria (hidratado una vez con `GET /account/wishlist`, o con un endpoint ligero
  `GET /account/wishlist/ids` si `GET /account/wishlist` resulta pesado — decidir según lo que
  midan las pruebas) para que `SaveButton` no dispare una petición por tarjeta al pintar un listado
  completo de 24 productos.
- `SaveButton` se agrega en dos lugares: `CatalogProductCard` (listados) y `ProductInfo`/
  `ProductOverview` (ficha) — confirmar el nombre exacto del componente de tarjeta al implementar.
- `apps/web/src/app/(storefront)/mi-cuenta/guardados/page.tsx` — rejilla reutilizando el componente
  de tarjeta de producto del catálogo (mismo que usan los listados), vacío con `EmptyState` + CTA
  "Ver catálogo".

## Tests

Backend: `apps/api/tests/account-wishlist.test.ts` — agregar, agregar duplicado (idempotente),
quitar, tope de 50, producto archivado aparece con `isAvailable: false` en vez de desaparecer.

Web: `SaveButton.test.tsx` (marca/desmarca, sin sesión navega a login), `WishlistProvider.test.tsx`
(hidratación, un `SaveButton` refleja el estado que puso otro sin pedirlo de nuevo).

## Verificación

```
pnpm --filter @bw-bikes/api test
pnpm --filter @bw-bikes/web test
pnpm typecheck && pnpm lint
```

Manual: guardar un producto desde el catálogo, verlo marcado también en su ficha, verlo en
`/mi-cuenta/guardados`, quitarlo desde ahí.

## Hecho cuando

- El cliente guarda y quita productos desde el catálogo y la ficha con un solo control.
- `/mi-cuenta/guardados` refleja la lista, incluidos productos que dejaron de estar disponibles.
- Todos los tests de arriba pasan y `pnpm typecheck && pnpm lint` están verdes.
