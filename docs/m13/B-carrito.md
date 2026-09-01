# B — Carrito

Lee primero [`00-CONTEXTO.md`](00-CONTEXTO.md). Requiere A1 (sesión de cliente). No depende de
A2–A6, aunque conviene hacerlas antes porque comparten patrones (`useAsyncAction`, `Modal`,
`AccountCard`) que aquí se reutilizan de nuevo.

## Objetivo

Que un cliente agregue productos al carrito con feedback real en el botón, sin poder pedir más
unidades de las que hay, sin que el storefront muestre ninguna cifra de stock, y que pueda editar su
carrito en un drawer y en `/carrito`.

## Lo que ya existe y no se toca

Backend completo: `apps/api/src/routes/cart.route.ts` (`/api/v1/cart`, todo bajo `protect`):
`GET /`, `DELETE /`, `POST /lines` (`{itemType,itemId,sku,qty}`, incrementa si la línea ya existe),
`PATCH /lines/:itemType/:sku` (`{qty}` absoluto), `DELETE /lines/:itemType/:sku`,
`PUT /shipping-address`, `PUT /billing-info`, `POST /coupon` (con rate limiter), `DELETE /coupon`.
Qty máx 100 (`MAX_RESERVATION_QTY`), máx 20 líneas. `PublicCart` (`packages/shared/src/types/cart.ts`)
trae por línea `available: number | null` (`null` = `on_request`/`preorder`, sin stock que contar),
`isPurchasable`, `unavailableReason`, y en el carrito completo
`subtotalCents/discountCents/taxCents/shippingCents/totalCents/coupon/captureMethod/hasBlockingLines`.

## 1. Disponibilidad pública por variante (sin cifras)

La PDP necesita saber si una variante está agotada, sin exponer cantidades y sin romper la caché de
300s del catálogo (`publicApiFetch` usa `next: { revalidate: 300 }`). Se descarta meter esto en el
DTO del producto: obligaría a volver dinámica la PDP, o a dejar el bit congelado hasta 5 minutos —
ambas cosas malas para algo tan volátil como el stock. Endpoint separado, reutilizable también por
`RelatedAccessories`.

```
GET /api/v1/catalog/availability?itemType=bike&itemIds=<id>[,<id>...]   (máx 20)
200 { availability: [ { itemId, variants: [ { sku, isAvailable } ] } ] }
```

Reglas: `on_request`/`preorder` → `true` (no poseen stock, misma semántica que el `null` de
`PublicCartLine.available`); `in_stock` → `onHand - reserved > 0`; sin fila de `InventoryItem` →
`false`; variantes `isActive: false` y productos archivados se omiten (nunca se filtra su
existencia); un id inexistente simplemente no aparece (nunca 404). **La respuesta no contiene
`onHand`, `reserved` ni ningún número.**

| Archivo | Cambio |
|---|---|
| `packages/shared/src/types/inventory.ts` | `PublicVariantAvailability { sku, isAvailable }`, `PublicProductAvailability { itemId, variants }`, exportados desde el índice del paquete |
| `apps/api/src/services/inventory.service.ts` | `getPublicAvailability(itemType, itemIds)`: dos queries (`{itemType}Model.find({ _id: { $in }, isActive: true, archivedAt: null }).select("variants")` + `InventoryItem.find({ itemType, itemId: { $in } }).select("itemId sku onHand reserved")`), unión en memoria por SKU. Exportar al final del archivo |
| `apps/api/src/controllers/inventory.controller.ts` | handler `getPublicAvailability` |
| `apps/api/src/validators/inventory.validator.ts` | `publicAvailabilityQuerySchema`: `itemType` enum requerido, `itemIds` CSV de `objectId` con tope 20 |
| `apps/api/src/routes/catalog.route.ts` | `router.get("/availability", validate(...), getPublicAvailability)`, hereda `publicReadRateLimiter`. Nota en el doc-comment del router: es el único read público que no debe cachearse |

Test `apps/api/tests/catalog-availability.test.ts`: stock > 0 → `true`; tras `adjustStock` a 0 →
`false`; `on_request` sin fila de inventario → `true`; variante inactiva ausente del arreglo;
producto archivado ausente; **assert explícito de que la respuesta no contiene
`onHand`/`reserved`/`available`**; 21 ids → 400; itemType inválido → 400; anónimo → 200.

Frontend de la señal:

- `apps/web/src/lib/api/catalog-availability.ts` → `fetchVariantAvailability(itemType, itemIds)`
  sobre `apiFetch`, devuelve `Map<sku, boolean>`.
- `apps/web/src/hooks/use-variant-availability.ts` → `{ status, isSoldOut(sku): boolean }`.
  **Fail-open**: mientras carga o si la red falla, `isSoldOut` es `false` — solo se bloquea cuando
  *sabemos* que está agotado; el guardia real sigue siendo `addLine` en el backend.

## 2. Sesión: verificación previa

Confirmar que A1 ya dejó `apiFetch`/`serverApiFetch` con la opción
`{ unauthorizedRedirectPath?: string | null }`. Si esta entrega se hace sin A1, ese cambio es
requisito previo — sin él, `GET /cart` al montar el `CartProvider` mandaría a todo visitante anónimo
a `/admin/login`.

## 3. Estado de carrito en el cliente

- `apps/web/src/lib/api/cart.ts`: `getCart, addCartLine, updateCartLine, removeCartLine, clearCart,
  applyCartCoupon, removeCartCoupon`, todas sobre `apiFetch` con `{ unauthorizedRedirectPath: null }`,
  devuelven `PublicCart` (`data.cart` — confirmar la forma exacta de la respuesta en
  `cart.controller.ts` al implementar).
- `apps/web/src/components/cart/CartProvider.tsx` (`"use client"`), context + `useReducer`. **Sin
  caché ni actualización optimista**: el backend devuelve el `PublicCart` completo en cada mutación,
  así que el reducer solo reemplaza. Estado:

  ```ts
  { cart: PublicCart | null,
    status: "idle" | "loading" | "ready" | "anonymous" | "error",
    pendingKeys: string[],   // `${itemType}:${sku}` en vuelo
    drawerOpen: boolean }
  ```

  `useCart()` expone `cart, status, lineCount, openDrawer, closeDrawer, addLine, setQty, removeLine,
  applyCoupon, removeCoupon, isPending(itemType, sku)`.

  - Hidratación en `useEffect` de montaje, **no en el servidor** (leer `cookies()` en el layout
    volvería dinámica la home entera y mataría el ISR de `publicApiFetch`). 401 → `status:
    "anonymous"`, `cart: null`, sin redirección ni toast.
  - Mutaciones: se marca la línea en `pendingKeys`, se llama al endpoint, la respuesta reemplaza el
    carrito entero.
  - 401 en una mutación → `status: "anonymous"` y **relanza** `ApiError` para que quien la llamó
    decida (el botón de agregar navega a login).
  - Otros errores → `toast({ variant: "error", title: error.message })` (el backend ya responde en
    español), estado sin tocar.
  - Ref `requestId` para descartar respuestas fuera de orden entre dos botones distintos —
    `useAsyncAction` ya evita el doble click de un mismo botón, pero no coordina dos botones.
- Montaje en `apps/web/src/app/(storefront)/layout.tsx`: `ToastProvider` (hoy solo está en el admin)
  envolviendo `CartProvider`, con `<CartDrawer />` renderizado una sola vez ahí (no por página).
- Contador del navbar: `lineCount = cart?.lines.reduce((n, l) => n + l.qty, 0) ?? 0`.

## 4. Botón real

- `apps/web/src/components/storefront/products/AddToCartButton.tsx` (`"use client"`), props
  `{ itemType, itemId, sku?, isSoldOut, productName }` + props de presentación para servir tanto a
  la PDP (primary, ancho completo) como a `RelatedAccessories` (ghost, sm). Usa `useAsyncAction`
  (`apps/web/src/hooks/use-async-action.ts`, ya escrito con este caso como ejemplo en su docstring) +
  `Button.loading/success/successLabel` (ya soportado). Estados: sin talla elegida → `disabled`
  "Selecciona una talla"; `isSoldOut` → `disabled` **"Agotado"**; normal → "Agregar al carrito" →
  cargando → "Agregado", y al éxito `openDrawer()` + toast.
- Flujo sin sesión: el provider lanza `ApiError(401)` → el botón navega a
  `/ingresar?redirect=<pdp>?sku=<sku>&agregar=1` (usar `loginHref`/`safeRedirectTarget` de A1). Al
  volver, el botón lee `useSearchParams()`, dispara el add **una sola vez** (guard con `useRef`) y
  hace `router.replace(pathname)` para que una recarga no repita el add.
- `ProductInfo.tsx`: recibe `itemType` como prop explícita desde la PDP (no inferirlo por
  `"relatedAccessories" in product`, es frágil), usa `useVariantAvailability(itemType, [product.id])`,
  y `sizeOptions[].available` pasa a ser `hayVarianteActiva && !isSoldOut(sku)` — una talla agotada
  se ve igual que una inexistente (tachada, deshabilitada, como ya renderiza `SizeSelector`). Inicializa
  la selección desde `?sku=` cuando viene de un retorno de login. Sustituye
  `<Button disabled title="Disponible próximamente">Comprar</Button>` por `<AddToCartButton />`.
- `SizeSelector.tsx`: **sin cambios de API**, solo actualizar su doc-comment (ahora `available:
  false` también significa agotado, no solo "no existe para este color").
- `RelatedAccessories.tsx`: una sola llamada de disponibilidad para todos los accesorios listados.
  Ítem con **exactamente una** variante activa → `AddToCartButton` real; con varias → `ButtonLink`
  "Ver opciones" hacia el producto (el backend exige un SKU concreto, y aquí no hay selector de
  talla/color). Quitar `disabled` y `title="Disponible próximamente"`.

## 5. Navbar

`NavbarActions.tsx`: el botón **Carrito** deja de estar `disabled`, `onClick={openDrawer}`,
`aria-label={"Carrito (" + lineCount + ")"}`, badge numérico `aria-hidden` cuando `lineCount > 0`.
(Si A1 ya activó "Cuenta", esta entrega solo toca Carrito.)

## 6. Drawer y página `/carrito`

Todo en `apps/web/src/components/cart/`:

| Archivo | Responsabilidad |
|---|---|
| `CartDrawer.tsx` | `SlideOver` "Tu carrito", lista compacta, subtotal, "Ver carrito" → `/carrito`, "Seguir comprando" (cierra). Sin CTA de pago — el checkout es fase 2 de M13 |
| `CartLineItem.tsx` | Imagen, nombre + marca, talla/color, precio unitario, `QuantityStepper`, eliminar, aviso de línea no comprable. Prop `compact` para el drawer |
| `QuantityStepper.tsx` | `ButtonGroup` `−` / valor / `+`. `+` deshabilitado en el tope con `title="No hay más unidades disponibles"` (**sin cifras**). `−` deshabilitado en 1 (para eliminar existe su propio botón; `PATCH` con qty 0 no está en el contrato) |
| `cart-limits.ts` | `MAX_LINE_QTY = 100` (espeja `MAX_RESERVATION_QTY`, con comentario apuntando al modelo del backend) y `maxQtyFor(line) = line.available === null ? MAX_LINE_QTY : Math.min(line.available, MAX_LINE_QTY)` |
| `cart-line-status.ts` | Traduce una línea a `{ tone, message }` **sin números**. Los mensajes del backend sin cifras se muestran tal cual ("Este producto está agotado."); el caso `0 < available < qty` — cuyo mensaje del backend es "Solo quedan N unidades disponibles." — se sustituye en el front por "Ajusta la cantidad para continuar." El backend **no se toca**: esa cadena sigue siendo correcta para el panel de administrador, que sí muestra cantidades (ver `00-CONTEXTO.md`, decisión 7) |
| `CartSummary.tsx` | Subtotal, descuento si `discountCents > 0`, IVA, envío ("Gratis" si 0), total; aviso cuando `captureMethod !== "automatic"`; `AlertCard` si `hasBlockingLines`; CTA de pago `disabled` con `title="Disponible próximamente"` (checkout es fase 2) |
| `CouponForm.tsx` | Input + "Aplicar"; con cupón aplicado muestra el código + "Quitar". Errores inline con el mensaje del backend, incluido el 429 de `couponRateLimiter` |
| `CartEmpty.tsx` | `EmptyState` + CTA al catálogo |
| `CartUnauthenticated.tsx` | `EmptyState` "Inicia sesión para ver tu carrito" + CTA a `/ingresar?redirect=/carrito` |
| `CartSkeleton.tsx` | `Skeleton` de 3 líneas + resumen |

Página: `apps/web/src/app/(storefront)/carrito/page.tsx` (Server, solo `metadata` con
`robots: { index: false }`) renderizando `CartPageClient.tsx`, switch sobre `status`: `loading` →
`CartSkeleton`; `anonymous` → `CartUnauthenticated`; `error` → `AlertCard` + reintentar; carrito
vacío → `CartEmpty`; si no, grid de dos columnas (líneas | `CartSummary` sticky + `CouponForm`).

## Tests

Backend: solo el nuevo `catalog-availability.test.ts` (ver arriba); el carrito en sí no cambia.

Web, a actualizar (hoy afirman el estado deshabilitado): `ProductInfo.test.tsx:43`,
`RelatedAccessories.test.tsx:49`, `Navbar.test.tsx` (o `NavbarActions.test.tsx`).

Web, nuevos: `cart.test.ts` (cada función pega al path correcto), `CartProvider.test.tsx`
(hidratación 200 → `ready`; 401 → `anonymous` **sin navegar**; mutación reemplaza el carrito; error
→ toast), `AddToCartButton.test.tsx` (click → cargando → "Agregado"; doble click rápido → **una
sola** llamada; 401 → navega a `/ingresar?redirect=…`), `use-variant-availability.test.tsx`
(fail-open ante error de red), `QuantityStepper.test.tsx` (`+` bloqueado en el tope, `−` en 1, y
**assert de que ningún número de stock aparece en el DOM**), `CartLineItem.test.tsx`,
`CouponForm.test.tsx`.

## Verificación

```
pnpm --filter @bw-bikes/api test
pnpm --filter @bw-bikes/web test
pnpm typecheck && pnpm lint
```

Comprobación específica: cargar la home **como anónimo** y confirmar que no hay redirección a
`/admin/login` (si A1 ya lo probó, repetirlo aquí confirma que B no lo rompió).

Recorrido manual final: anónimo → agregar → login → vuelve y agrega → ver el botón pasar a
"Agregado" → drawer → `/carrito` → subir cantidad hasta el tope → cupón válido/inválido → eliminar
→ vaciar. Cerrar con un `grep` de que ninguna cadena renderizada en `components/cart` ni en
`components/storefront/products` interpola `available`/`onHand`.

## Hecho cuando

- Un cliente agrega productos al carrito con feedback visual real, sin ver ninguna cifra de stock.
- Una variante agotada muestra "Agotado" y no se puede agregar.
- El stepper del carrito nunca deja pedir más de lo disponible, sin mostrar el número.
- Drawer y `/carrito` funcionan con cupón, edición de cantidades y eliminación.
- Todos los tests de arriba pasan y `pnpm typecheck && pnpm lint` están verdes.

## Fuera de alcance (fase 2 de M13)

Checkout, Stripe Elements en el front, `/checkout`, y la CTA de pago del resumen del carrito.
