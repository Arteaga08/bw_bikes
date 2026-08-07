# Black and White Bikes — Design System

Marca de bicicletas de lujo. Estética minimalista moderna, inspirada en
referentes de ciclismo premium (Cannondale, Orbea, Canyon): sans-serif limpio,
sin adornos, donde el lujo se percibe a través del espacio en blanco y el
tamaño — nunca de la decoración.

**Archivos de referencia en este paquete:**
- `tokens.css` — variables CSS listas para importar
- `tailwind.config.snippet.js` — extensión de Tailwind con los mismos tokens
- `fonts/` — Hanken Grotesk (Regular, Medium, ExtraBold)
- `brand-assets/` — el rinoceronte vectorizado (SVG + PNG, 4 variantes de color)
- `Black_and_White_Bikes_Style_Brief.pdf` — paleta, tipografía, botones, jerarquía
- `Black_and_White_Bikes_Mockups.pdf` — 7 pantallas completas de referencia visual

Antes de construir un componente nuevo: revisa si ya existe un patrón
equivalente en el PDF de mockups. Si existe, replícalo en vez de inventar uno.

---

## 1. Color — sistema 60/30/10

| Token | Hex | Rol | Uso |
|---|---|---|---|
| `negro` | `#0A0A0A` | Primario · 30% | Fondos dominantes, texto, nav |
| `blanco` | `#FAFAFA` | Primario · 30% | Fondos claros, texto sobre negro |
| `grafito` | `#3A3A38` | Secundario · 30% | Texto secundario, bordes con jerarquía |
| `dorado` | `#F2B705` | Acento · 10% | **Un solo** CTA por vista, precios, focus, micro-detalles |

**Regla de oro:** el dorado pierde fuerza si se repite. Nunca más de un botón
primario dorado visible a la vez en una misma pantalla.

---

## 2. Tipografía

Una sola familia — **Hanken Grotesk** — en tres pesos. No mezclar con otras
fuentes, ni siquiera para números o iconografía.

| Peso | Uso |
|---|---|
| ExtraBold (800) | Títulos, hero, nombre de marca. Siempre sentence case, tracking negativo. |
| Medium (500) | Botones, nav, eyebrows, labels de precio. |
| Regular (400) | Párrafos, descripciones, contenido editorial. |

Escala completa (tokens en `tokens.css`): Display 64px → H1 44px → H2 30px →
H3 20px → Body L 16px → Body 14px → UI 13px → Eyebrow/Caption 11px.

En mobile, Display y H1 se reducen 25%; del H2 hacia abajo la escala se
mantiene igual. Ancho máximo de párrafo: 65 caracteres. Nunca usar más de dos
pesos en un mismo bloque de contenido.

---

## 3. Jerarquía visual

El sistema es plano — **sin sombras** — así que la jerarquía se construye con
tamaño, contraste de color y espacio, no con elevación falsa.

### 3.1 Jerarquía de contenido (dentro de una tarjeta/sección)
1. **Primario** — precio y CTA. Texto grande (ExtraBold o Medium grande),
   fondo dorado o negro sólido. Es lo primero que el ojo encuentra.
2. **Secundario** — nombre de producto / título de sección. Medium, siempre
   negro, nunca gris.
3. **Terciario** — metadatos (envío, MSI, fechas). Regular pequeño, siempre
   gris grafito, nunca compite visualmente con el precio.

### 3.2 Jerarquía de profundidad (sin sombras)
| Capa | Color | Uso |
|---|---|---|
| Base | `#F1F1EE` | Fondo de página |
| Surface | `#FFFFFF` + borde `#E2E2DE` | Tarjetas, inputs, modales de contenido |
| Overlay | `#0A0A0A` | Modal de confirmación, dropdown, toast, footer |

No usar `box-shadow` para simular elevación. La diferencia de capa se lee por
el cambio de fondo, no por sombra.

### 3.3 Espaciado — grid base 8px
`xs 4px · sm 8px · md 16px · lg 24px · xl 32px · 2xl 48px · 3xl 64px`

Todo margin/padding debe salir de esta escala. Si un espacio "casi encaja"
pero no es exacto, se ajusta al token más cercano — no se inventan valores
sueltos (ej. nunca `padding: 18px`, usar `16px` o `24px`).

---

## 4. Botones — 4 variantes × 6 estados

| Variante | Uso |
|---|---|
| **Primario** (dorado) | Una sola acción principal por vista: "Comprar", "Ir a pagar" |
| **Secundario** (negro) | Acciones de igual peso pero no la principal: "Ver bici" |
| **Ghost** (contorno) | Acciones terciarias: "Detalles", filtros |
| **Texto** (link subrayado) | Navegación inline: "Ver más", "Seguir comprando" |

Estados: `default · hover · focus · pressed · disabled · loading`

- Hover oscurece el fondo ~10%; pressed ~20% (valores exactos en `tokens.css`).
- Focus: anillo de 3px separado 2px del control — negro sobre el primario
  dorado, dorado sobre fondos oscuros o neutros.
- Disabled: baja contraste, no cambia tamaño.
- Loading: conserva el ancho original del botón (evita saltos de layout);
  agrega un spinner de 10px a la izquierda del texto.
- Control: altura 44px, radio 2px, padding horizontal 24px, transición 150ms.

Implementación base ya lista en `tokens.css` (`.btn-primary`, `.btn-secondary`,
`.btn-ghost`, `.btn-text`) usando `:hover`, `:active`, `:disabled` y
`:focus-visible`. El estado `loading` se implementa como modificador de clase
(`.btn-primary.is-loading` / `.btn-secondary.is-loading` en `tokens.css`):
deshabilita el click, oculta el texto y muestra un spinner de 10px vía
`::before`. Radios de control casi rectos (2px) transmiten precisión; radios
mayores en tarjetas (10–14px) suavizan superficies grandes sin perder esa
sensación — ver comentario en `tokens.css`.

---

## 5. Rinoceronte — acento decorativo

Extraído y vectorizado del logo. **Es un acento pequeño, no una ilustración
de fondo.**

- Tamaño: 12–28px según contexto. Nunca supera la altura del texto al que
  acompaña.
- Color: 100% opacidad, un solo color plano (dorado, negro o blanco según el
  fondo). Nunca marca de agua ni patrón repetido a gran escala — a tamaño
  grande compite con la fotografía de producto.
- Nunca se rota, deforma ni cambia de proporción.
- Máximo dos apariciones por vista (un modal abierto cuenta como su propia
  vista para este límite, independiente de la página que tiene debajo).
- Usos válidos: junto a un eyebrow, junto al nombre de producto (H3), junto a
  un label de footer, dentro de un modal de confirmación. **El separador
  centrado entre reglas horizontales queda descartado** — se probó en
  `impeccable live` (2026-08-06) tanto en el dashboard como en la ficha de
  producto y en ambos casos se sintió genérico, más una plantilla de
  "sección divider" que una decisión de marca. No usar este patrón en
  ninguna pantalla, aunque el Style Brief (pág. 5, "Usos como acento") lo
  mencione — este documento es la fuente de verdad más reciente y lo
  reemplaza en este punto.

Archivos en `brand-assets/`: SVG en dorado/negro/blanco + PNG transparente
a 1200 y 2400px por si algún contexto no acepta SVG.

### 5.1 Dónde aparece — mapa completo del sitio público

Los 3 usos válidos de arriba (junto a eyebrow, separador centrado, firma de
footer) aplican al **sitio público** (registro *brand*). Regla base antes de
listar pantalla por pantalla:

**La firma de footer es la aparición base.** El footer es global — vive en
casi todas las páginas del sitio — así que cuenta como una de las dos
apariciones permitidas en cualquier vista donde esté presente. La segunda
aparición (si la hay) es la que varía por pantalla y está descrita abajo.
Ninguna pantalla lista una tercera aparición: si el footer y el uso
específico de la pantalla ya suman dos, ahí se detiene.

| Pantalla / lugar | Footer (base) | Segunda aparición | Total | Nota |
|---|---|---|---|---|
| **Home** | Sí | Eyebrow del hero ("Edición 2026") | 2 (límite) | No agregar una tercera. |
| **Catálogo** | Sí | Ninguna | 1 | Es una grilla densa de tarjetas de producto; el rinoceronte competiría con fotos/precios. Solo footer. |
| **Ficha de producto** | Sí | Junto al nombre del producto (H3, ej. "Rhino Race") | 2 (límite) | Reemplaza el separador (descartado). Refuerza la marca justo donde ya aparece "Rhino" en el nombre del modelo — no es decoración añadida, es un eco del naming existente. El eyebrow de esta pantalla es breadcrumb de navegación, no lugar de marca — tampoco se usa ahí. |
| **Carrito** | Sí | Ninguna | 1 | Pantalla de repaso transaccional: el foco son montos y el CTA "Ir a pagar", no decoración. |
| **Checkout** | No (footer se oculta) | Ninguna | 0 | Pantalla de conversión de alto riesgo. Cero apariciones del rinoceronte mientras el usuario está pagando — ni siquiera el footer, que ya se retira en el mockup de referencia (nav reducida). La prioridad absoluta es que complete el pago sin fricción visual. |
| **Confirmación de pedido / pantalla de éxito** | Sí | Eyebrow de confirmación ("Pedido confirmado") | 2 (límite) | Es el momento positivo del flujo (peak-end rule) — el lugar correcto para volver a mostrar marca, justo después de la ausencia total en checkout. |
| **Error 404** | Sí | Un solo rinoceronte estático (16–24px) centrado sobre el mensaje "404" | 2 (límite) | **Corrige el mockup actual**, que lo usa como patrón diagonal repetido de fondo — contradice directamente la regla de "nunca marca de agua ni patrón repetido" señalada en la auditoría de `impeccable`. Un solo rinoceronte estático, no un patrón. |
| **Páginas de contenido** (Nosotros, Compromiso, Distribuidores, Garantía, Envíos, Tallas, Contacto) | Sí | Junto al eyebrow del hero editorial, solo si la página tiene uno (ej. "Nosotros" con hero propio) | 1–2 | Páginas sin hero propio (ej. Garantía, Tallas, si son solo texto/tabla) se quedan en 1 aparición: footer únicamente. |
| **Modal — "Agregado al carrito"** | No aplica (el modal es su propia vista) | Junto al mensaje de confirmación, dentro del modal | 1 | Aparece al agregar un producto desde catálogo o ficha; refuerza el mismo momento positivo que la confirmación de pedido, a menor escala. |
| **Modal — confirmación de compra** (si existe un paso de confirmación antes de procesar el pago) | No aplica | Junto al mensaje de confirmación, dentro del modal | 1 | Único modal permitido dentro del flujo de checkout — es distinto del checkout mismo (que queda en 0): es una confirmación puntual, no decoración persistente durante el llenado del formulario. |

### 5.2 Specs exactas por instancia

Tamaño, variante de color (de `brand-assets/`) y ancla exacta para cada
aparición de la tabla de arriba. Todas dentro del rango 12–28px que ya
define la regla general.

| Instancia | Tamaño | Variante | Ancla |
|---|---|---|---|
| Firma de footer (global) | 12px | `rhino-dorado.svg` (footer es siempre overlay negro) | Inline, inmediatamente antes de "© 2026 Black and White Bikes", mismo baseline, alineado a la izquierda del bloque de copyright. |
| Home — eyebrow del hero | 16px | `rhino-dorado.svg` (sobre hero oscuro full-bleed) | Inline, antes del texto "EDICIÓN 2026", mismo baseline que el eyebrow. |
| Ficha de producto — junto al nombre | 20px | `rhino-negro.svg` (fondo claro, `surface-card`) | Inline, antes del H3 del nombre de producto (ej. antes de "Rhino Race"), alineado a la altura x del texto — no supera el alto del H3 (20px). |
| Confirmación de pedido — eyebrow | 16px | `rhino-dorado.svg` si el fondo es oscuro (overlay), `rhino-negro.svg` si es claro (surface-base) | Inline, antes de "Pedido confirmado", mismo baseline que el eyebrow. |
| Error 404 | 24px | `rhino-dorado.svg` (fondo negro overlay, como ya define el mockup) | Centrado horizontalmente, sobre el número "404", estático — sin rotación ni repetición. |
| Páginas de contenido — eyebrow de hero editorial | 16px | Según fondo del hero de esa página (dorado sobre oscuro, negro sobre claro) | Inline, antes del eyebrow de la página. |
| Modal "Agregado al carrito" | 16px | `rhino-dorado.svg` | Inline, antes del mensaje de confirmación (ej. antes de "Agregado al carrito"). |
| Modal de confirmación de compra | 16px | `rhino-negro.svg` (mismo criterio: modal sobre fondo claro) | Inline, antes del mensaje de confirmación. |

**Regla de checkout, explícita:** es la única pantalla del sitio con **cero**
apariciones del rinoceronte, footer incluido. Todas las demás quedan en 1 o 2
según la tabla — nunca 0, salvo checkout.

**Dashboard admin (registro *product*):** el rinoceronte **no** se usa como
chrome genérico — no como separador de secciones, divisor de tablas, ni
decoración recurrente de UI funcional. Confirmado en sesión de
`impeccable live` (2026-08-06): un separador de sección con el rinoceronte
se sintió genérico y fuera de lugar en un panel operativo. Si el dashboard
necesita un momento de marca, se reserva a un único lugar no-funcional (por
ejemplo, la pantalla de login), nunca repetido como elemento de interfaz.

---

## 6. Pendiente de definir (no bloquea el desarrollo)

Estos puntos no están formalizados todavía. Resuélvelos con el mismo criterio
del sistema (dorado = acento único, negro/blanco = base, grid de 8px) cuando
aparezcan, y avisa si algo no encaja con lo ya definido:

- **Inputs de formulario** — estados focus/error/success (checkout usa campos
  básicos en el mockup, sin spec de validación)
- **Iconografía** — decidido: **Phosphor Icons**, peso `regular` (trazo ~2px,
  equivalente al grosor del rinoceronte). Reemplaza la elección previa de
  Lucide.
- **Breakpoints responsive** — solo está definido el comportamiento de
  Display/H1 en mobile
- **Badges/tags** — "NUEVO", "E-BIKE" aparecen en mockups sin spec de color/
  tamaño formal (por ahora: fondo dorado, texto negro, 9px, Medium, mayúsculas)

---

## 7. Referencia rápida de pantallas (ver Mockups PDF)

01 Home · 02 Catálogo · 03 Ficha de producto · 04 Carrito · 05 Checkout ·
06 Error 404 — cada una con notas de diseño explicando decisiones específicas
de layout.
