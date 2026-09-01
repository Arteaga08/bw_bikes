# A4 — Mis tallas

Lee primero [`00-CONTEXTO.md`](00-CONTEXTO.md). Requiere A2 (shell). Independiente de A3, A5, A6.

## Objetivo

Que el cliente guarde su estatura, estilo de rodar preferido, y las tallas de su equipo, y que la
ficha de producto **preseleccione** la talla de bici sugerida a partir de esos datos.

## Por qué no hace falta lógica nueva de recomendación

`apps/web/src/lib/size-recommendation.ts` ya expone:

```ts
export type RideStyle = "comfortable" | "balanced" | "performance";
export function recommendSize(
  guide: PublicSizeGuideEntry[],
  heightCm: number,
  style: RideStyle,
): SizeRecommendation | undefined
```

Es la misma función que hoy usa `SizeGuideModal.tsx` (el "¿Cuál es mi talla?" de la PDP, con su
selector de estilo de manejo en `RIDE_STYLES`). Guardar `heightCm` y `rideStyle` en el perfil permite
llamar a esta función **sin escribir ninguna lógica de recomendación nueva**: A4 solo persiste los
dos valores de entrada y consume la salida donde haga falta.

## Backend

En `user.model.ts`, campo `fit?`:

```ts
interface GearSize {
  category: GearSizeCategory;   // enum, ver 00-CONTEXTO.md
  value: string;                // ≤ 20, texto libre ("M", "42", "54cm") — cada categoría tiene su propia convención de tallas y no vale la pena un enum por categoría
}

interface CustomerFit {
  heightCm?: number;    // 100–230, mismo rango razonable que MIN/MAX_HEIGHT_CM del modal (140–210) ampliado un poco para no bloquear casos límite reales
  rideStyle?: RideStyle;
  gearSizes: GearSize[]; // máx 7 (una por categoría), sin categorías repetidas
}
```

`GearSizeCategory` en `packages/shared/src/types/account.ts`:
`"helmet" | "handlebar_width" | "saddle_width" | "shorts" | "top" | "bottom" | "gloves"`.

Endpoint:

- `PUT /account/fit` — reemplaza `{ heightCm?, rideStyle?, gearSizes? }` completo (mismo patrón que
  `PUT /cart/billing-info`: un solo documento, no una colección con altas/bajas). Válida
  `gearSizes` sin categorías duplicadas y con el tope de longitud de `value`.

`GET /account` (A2) crece con `fit?: CustomerFit`.

## Frontend

- `apps/web/src/app/(storefront)/mi-cuenta/mis-tallas/page.tsx`. Dos `AccountCard`:
  1. **"Tu medida"** — estatura (`Input` numérico, cm) y estilo de rodar (los mismos tres botones
     `RIDE_STYLES` que `SizeGuideModal.tsx` ya define — extraer ese arreglo a un módulo compartido,
     p. ej. `apps/web/src/lib/ride-styles.ts`, para que el modal y esta página usen la misma fuente
     en vez de declararlo dos veces). "Editar" abre `FitForm.tsx` en un `Modal`.
  2. **"Tallas de equipamiento"** — rejilla de dos columnas con las siete categorías (etiquetas en
     español: Cascos, Ancho del manubrio, Ancho del sillín, Shorts, Partes superiores, Partes
     inferiores, Guantes), cada una mostrando su valor guardado o un enlace "Añadir talla +" cuando
     no hay ninguna, tal como la referencia visual. Editar una entrada abre un `Modal` pequeño con
     un solo `Input` de texto.
- `PUT /account/fit` en ambos formularios (cada uno envía el documento completo — leer el estado
  actual antes de escribir el campo que cambió, o mantener el estado combinado en la página y que
  ambos formularios lo actualicen sobre el mismo objeto).

### Preselección en la ficha de producto

Esta parte toca `apps/web/src/components/storefront/products/ProductInfo.tsx`, que hoy inicializa
`selectedSize` como `undefined`:

- La PDP obtiene `account.fit` (de una sola llamada a `GET /account`, cacheada en el `CartProvider`
  de la entrega B o en un contexto ligero propio si B aún no existe — decidir al implementar según
  qué esté hecho primero; si el cliente no tiene sesión, simplemente no hay preselección).
- Si `fit.heightCm` y `fit.rideStyle` existen y el producto es una bici con guía de tallas
  (`getPublicBikeSizeGuide`, ya usado por `SizeGuideModal`), llama `recommendSize(guide, heightCm,
  rideStyle)`.
- La talla resultante **preselecciona** `selectedSize` al montar, **solo si** esa talla existe entre
  `sizeOptions` y está `available` (no agotada, no inexistente en este modelo) — nunca marcar una
  talla que no se puede comprar.
- Cuando se preselecciona, mostrar un aviso discreto junto al selector: "Sugerida según tu perfil ·
  cambiar" (el "cambiar" no hace nada especial, es solo texto — el cliente ya puede tocar cualquier
  otra talla).
- El modal "¿Cuál es mi talla?" (`SizeGuideModal`) arranca con su input de estatura pre-llenado con
  `fit.heightCm` cuando existe, en vez de `DEFAULT_HEIGHT_CM`.

## Tests

Backend: `apps/api/tests/account-fit.test.ts` — poner y actualizar `heightCm`/`rideStyle`, poner
tallas de equipo, rechaza categoría duplicada, rechaza categoría fuera del enum.

Web: `FitForm.test.tsx`, `GearSizesCard.test.tsx` (o el nombre que tome), y un caso nuevo en
`ProductInfo.test.tsx`: con `fit` guardado y una talla disponible que coincide, el selector arranca
con esa talla marcada y el aviso visible; si la talla sugerida está agotada, no se preselecciona
nada.

## Verificación

```
pnpm --filter @bw-bikes/api test
pnpm --filter @bw-bikes/web test
pnpm typecheck && pnpm lint
```

Manual: guardar estatura y estilo, abrir una ficha de bici con guía de tallas y confirmar que la
talla sugerida aparece marcada con el aviso; abrir el modal "¿Cuál es mi talla?" y confirmar que la
estatura ya viene rellenada; guardar una talla de casco y verla reflejada en "Mis tallas".

## Hecho cuando

- El cliente guarda estatura, estilo de rodar y tallas de equipo desde `/mi-cuenta/mis-tallas`.
- La ficha de una bici preselecciona la talla sugerida cuando aplica, sin marcar nunca una talla no
  disponible.
- El modal de guía de tallas arranca pre-llenado con la estatura guardada.
- Todos los tests de arriba pasan y `pnpm typecheck && pnpm lint` están verdes.
