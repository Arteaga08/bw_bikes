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
| Overlay | `#0A0A0A` | Modal de confirmación, dropdown, toast, footer, sidebar |
| Base | `#F1F1EE` | Fondo de página |
| Surface | `#FFFFFF` + borde `#E2E2DE` | Tarjetas, inputs, modales de contenido |
| **Inset** | **`#EAEAE6`** | **Panel anidado dentro de una tarjeta** |
| Borde | `#E2E2DE` | Hairlines · hover de control sobre `inset` o `base` |

No usar `box-shadow` para simular elevación. La diferencia de capa se lee por
el cambio de fondo, no por sombra.

**`inset` es la cuarta superficie**, agregada al cerrar M10.5. Las tres
originales no alcanzaban para un panel dentro de una tarjeta y la única salida
era pintarlo `bg-base`, que es el suelo de la página: el panel leía como un
agujero en la tarjeta, y un control transparente encima no tenía cuerpo propio
— mostraba exactamente el mismo fondo que se ve fuera de la tarjeta. Se
notaron tres síntomas del mismo defecto: los botones de ícono de la ficha
técnica sin cuerpo, un input deshabilitado invisible (`disabled:bg-base` sobre
un panel `bg-base`), y el encabezado de tabla con el mismo relleno que el
hover de fila.

La regla no cambia — sigue prohibido resolver profundidad con sombra — pero
para cambiar de fondo hacen falta suficientes fondos a los que cambiar. Sigue
siendo un escalón por nivel real de anidamiento: si un diseño necesita un
quinto, el problema es el anidamiento, no la paleta.

### 3.3 Espaciado — grid base 8px
`xs 4px · sm 8px · md 16px · lg 24px · xl 32px · 2xl 48px · 3xl 64px`

Todo margin/padding debe salir de esta escala. Si un espacio "casi encaja"
pero no es exacto, se ajusta al token más cercano — no se inventan valores
sueltos (ej. nunca `padding: 18px`, usar `16px` o `24px`).

---

## 4. Botones — 5 variantes × 4 tonos × 6 estados

El sistema tiene tres ejes independientes. **Variante** es la forma y el peso,
**tono** es el color, **tamaño** es la caja.

### 4.1 Variantes (forma)

| Variante | Uso |
|---|---|
| **Primario** (dorado) | Una sola acción principal por vista: "Comprar", "Ir a pagar" |
| **Secundario** (negro) | Acciones de igual peso pero no la principal: "Ver bici" |
| **Ghost** (contorno) | Acciones terciarias sueltas: "Editar", "Agregar campo", filtros |
| **Bare** (sin contorno) | Controles que se repiten en una fila o barra: reordenar ↑↓, eliminar, cerrar |
| **Texto** (link subrayado) | Navegación inline: "Ver más", "Seguir comprando" |

`bare` se agregó al cerrar M10.5 y es la única incorporación al vocabulario
original. Motivo: `ghost` y `bare` son la misma caja al mismo tamaño y solo se
distinguen por si dibujan borde en reposo. Un `ghost` suelto necesita el
contorno para leerse como control; repetido como ícono en cada fila de un
formulario produce una reja de recuadros negros y le da al control **menos**
importante el borde **más** fuerte de la fila. `bare` descansa como glifo en
grafito y solo gana cuerpo bajo el cursor.

**El hover de `bare` levanta a blanco** (`surface`) con hairline `borde`: el
mismo cuerpo que tienen los inputs de al lado, así que el control se anuncia
como control en vez de apagarse contra el panel. Decidido el 2026-08-12
comparando las tres opciones renderizadas.

La regla debajo es **separarse un paso del fondo propio**, y tiene una
consecuencia: dentro de un `ButtonGroup`, que ya trae cuerpo blanco, blanco
sobre blanco sería invisible. Ese caso baja a `borde` (#E2E2DE) en vez de
subir. Vive como regla de CSS en `globals.css`
(`.btn-group-solid > button.is-bare-neutral:hover`) y no como utilidad de
Tailwind, porque dos `hover:bg-*` en el mismo elemento se resuelven por orden
del CSS generado, no del string — un selector descendente gana por
especificidad, siempre. Solo aplica al tono neutral: un basurero dentro de un
grupo conserva su rojo.

### 4.2 Tonos (color)

`neutral · danger · danger-strong · inverse`

Aplican a `ghost`, `bare` y `text`; las variantes sólidas definen su color por
completo y lo ignoran.

- **danger**: tier reversible (Archivar — hay "Restaurar"). Suave en hover,
  sólido solo al presionar.
- **danger-strong**: tier irreversible (Eliminar). Hover salta directo a
  sólido, sin el paso suave. Los dos tiers se leen como severidades distintas
  sin un segundo token rojo.
- **inverse**: controles sobre `overlay` (#0A0A0A) — sidebar, footer de la
  tienda, modal oscuro. `blanco/70` → hover `dorado`, anillo de foco dorado.

El subrayado de `text` toma el color del tono, no el acento: una línea dorada
bajo un "Eliminar" rojo metería el acento único del sistema dentro de un
control destructivo, que es el único lugar donde no debe aparecer.

### 4.3 Tamaños (caja)

| Tamaño | Caja | Uso |
|---|---|---|
| `md` | 44px alto, padding 24px | Default: formularios y acciones sueltas |
| `sm` | 36px alto, padding 16px | Acciones de fila en `DataTable` (`md` alarga la fila) |
| `icon-sm` | 20×20 | Control dentro de algo más chico que él: la × de un chip |
| `icon` | 36×36 | Ícono solo en fila o barra de herramientas |
| `icon-lg` | 44×44 | Chrome suelto que necesita el área táctil completa (menú móvil) |

Los tamaños de ícono siempre llevan `aria-label`. El glifo escala con el
control (16px normal, 20px en `icon-lg`, 12px en `icon-sm`) — nunca se le pasa
`size` al ícono desde afuera.

### 4.4 Estados

`default · hover · focus · pressed · disabled · loading · success`

- Hover oscurece el fondo ~10%; pressed ~20% (valores exactos en `tokens.css`).
- Focus: anillo de 3px separado 2px del control — negro sobre el primario
  dorado, dorado sobre fondos oscuros o neutros.
- Disabled: baja contraste, no cambia tamaño.
- Loading: conserva el ancho original del botón (evita saltos de layout);
  agrega un spinner de 10px centrado en la caja, sobre el texto (que queda
  invisible pero sigue ocupando su espacio). Centrado en vez de anclado al
  padding para que un botón estirado (`w-full`) no lo descuadre. Solo existe
  en `Button`, no en `ButtonLink` — un enlace no tiene estado pendiente.
- Success: ventana corta de confirmación (2 s) tras una acción que salió bien.
  Cambia la etiqueta por uno en pasado ("Agregado", "Guardado") con un check, y
  usa `estado-exito` sobre `estado-exito-soft` — no un verde nuevo. **Deshabilita
  el control**, que es el punto: esa ventana es justo cuando un clic impaciente
  agregaría una segunda unidad al carrito.
- Control: radio 2px, transición 150ms.

**Doble clic.** Un atributo `disabled` no alcanza por sí solo: entre el primer
clic y el commit de React, un segundo clic rápido todavía se dispara. El hook
`useAsyncAction` (`apps/web/src/hooks/use-async-action.ts`) cierra el hueco con
una guardia síncrona por `ref` y libera el candado recién al cerrar la ventana
de confirmación. Si una acción puede tardar o cobrar, va por ese hook, no por
un `onClick` suelto.

### 4.5 Mapa de color — qué variante para qué acción

**Panel admin**

| Acción | Variante · tono · tamaño |
|---|---|
| Guardar cambios (una por vista) | `primary` `md` — dorado #F2B705 sobre texto negro |
| Cancelar, acción de igual peso | `secondary` `md` — negro #0A0A0A sobre texto blanco |
| Editar, Agregar campo, filtros | `ghost` `neutral` |
| Archivar (reversible) | `ghost` `danger` |
| Eliminar (irreversible) | `ghost` `danger-strong` |
| Reordenar ↑↓ en fila | `bare` `neutral` `icon` dentro de `ButtonGroup` |
| Borrar campo/imagen en fila | `bare` `danger-strong` `icon` |
| Cerrar panel / toast | `CloseButton` (`bare` `icon`) |
| Quitar chip | `CloseButton` `icon-sm` |
| Menú móvil | `bare` `icon-lg` |
| Cerrar sesión (sidebar negra) | `text` `inverse` |
| Navegación inline, "Administrar badges" | `ButtonLink` `text` |

**Tienda (M12–M14)** — diseño cerrado, sin componentes propios todavía

| Acción | Variante · tono | Por qué ese color |
|---|---|---|
| Ir a pagar / Comprar | `primary` `md` | El único CTA dorado de la vista; el acento se reserva para la conversión. |
| Agregar al carrito | `secondary` `md` + ícono `ShoppingCart`, vía `useAsyncAction` | Igual peso pero no es la conversión. En una grilla de catálogo hay muchos; en dorado diluirían el CTA. Confirma con `success` + `successLabel="Agregado"` y un toast, y queda bloqueado durante la ventana. |
| Iniciar sesión (submit) | `primary` `md` ancho completo | Única acción de esa pantalla. |
| Seguir comprando, Ver más | `text` `neutral` | Navegación inline, sin peso de control. |
| Filtros de catálogo | `ghost` `neutral` `sm` | Terciario y numeroso: necesita el borde para leerse como control. |
| Cantidad − / + | `bare` `neutral` `icon` en `ButtonGroup` | Control repetido: debe recederse, igual que reordenar. |
| Quitar del carrito | `bare` `danger-strong` `icon` | Destructivo de bajo riesgo. |
| Redes sociales (footer) | `SocialButton` (`bare` `inverse`) | Sobre `overlay`; el hover a dorado es el único acento permitido ahí. |

Carrito, checkout y login **no** tienen componente propio: son `Button` con
otra etiqueta y otro ícono. Inventarles un nombre antes de que exista el flujo
sería abstracción prematura. `SocialButton` sí existe, porque carga requisitos
que la composición no da gratis (`rel="noopener noreferrer"` sobre
`target="_blank"`, y nombre accesible para un control sin texto).

### 4.6 Implementación

Componentes en `apps/web/src/components/ui/`:

| Componente | Qué resuelve |
|---|---|
| `Button` | La matriz completa; `buttonClasses()` es la fuente única de clases |
| `ButtonLink` | Un `<a>` con la misma forma. Evita `<Link><Button/></Link>`, que anida un `<button>` dentro de un `<a>`: HTML inválido y dos controles anunciados donde el usuario ve uno |
| `ButtonGroup` | Contenedor segmentado para acciones adyacentes (↑↓, −/+). Cuerpo blanco propio y el único borde; sin `overflow-hidden`, que recortaría el anillo de foco |
| `CloseButton` | El único cierre del sistema. Antes había tres × distintas, ninguna con el ícono Phosphor |
| `Tabs` (`TabList`/`Tab`) | Pestañas que cambian el contenido de abajo, con patrón WAI-ARIA completo. No para navegar a otra ruta |
| `SocialButton` | Enlace externo a perfil con logo, seguridad y nombre accesible |
| `useAsyncAction` (hook) | Corre una acción asíncrona una sola vez a la vez y sostiene la ventana de confirmación — las dos mitades de "sin doble clic" |

`tokens.css` mantiene el espejo en CSS puro (`.btn-primary`, `.btn-secondary`,
`.btn-ghost`, `.btn-bare`, `.btn-text` y los modificadores de tono) para
cualquier contexto sin React.

**Excepción documentada:** los enlaces de "saltar al campo" de `ErrorSummary`
no usan `Button variant="text"`. Son enlaces dentro de prosa a tamaño
`caption` (11px) dentro de una alerta roja; el `text` variant es un control a
tamaño `ui` (13px) fijo. Misma razón por la que `Breadcrumbs` y `SkipLink` son
enlaces con estilo propio y no botones.

Radios de control casi rectos (2px) transmiten precisión; radios mayores en
tarjetas (10–14px) suavizan superficies grandes sin perder esa sensación — ver
comentario en `tokens.css`.

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
| Modal de confirmación de compra | 16px | `rhino-dorado.svg` (mismo criterio que "Agregado al carrito" — consistencia entre los dos modales de confirmación) | Inline, antes del mensaje de confirmación. |

**Regla de checkout, explícita:** es la única pantalla del sitio con **cero**
apariciones del rinoceronte, footer incluido. Todas las demás quedan en 1 o 2
según la tabla — nunca 0, salvo checkout.

**Dashboard admin (registro *product*):** el rinoceronte **no** se usa como
chrome genérico — no como separador de secciones, divisor de tablas, ni
decoración recurrente de UI funcional. Confirmado en sesión de
`impeccable live` (2026-08-06): un separador de sección con el rinoceronte
se sintió genérico y fuera de lugar en un panel operativo.

**Excepción, 2026-08-20:** el rinoceronte (`rhino-dorado.svg`, 20px) ahora
también aparece junto a "Hola de nuevo" en el `TopBar` global
(`apps/web/src/components/shell/TopBar.tsx`), decisión explícita de Manuel al
rediseñar el header — chrome visible en cada vista del admin, así que deja de
ser "un solo lugar no-funcional". Es la única segunda aparición permitida en
el dashboard; sigue prohibido como separador de secciones, divisor de tablas
o decoración recurrente en cualquier otro lugar de la UI funcional.

---

## 6. Pendiente de definir (no bloquea el desarrollo)

Estos puntos no están formalizados todavía. Resuélvelos con el mismo criterio
del sistema (dorado = acento único, negro/blanco = base, grid de 8px) cuando
aparezcan, y avisa si algo no encaja con lo ya definido:

- **Iconografía** — decidido: **Phosphor Icons**, peso `regular` (trazo ~2px,
  equivalente al grosor del rinoceronte). Reemplaza la elección previa de
  Lucide.
- **Breakpoints responsive** — solo está definido el comportamiento de
  Display/H1 en mobile. Sigue pendiente.

**Ya cerrados** (quedan aquí solo como registro, ver `tokens.css` para la
implementación):
- **Inputs de formulario** — decidido 2026-08-07: estados `default` /
  `focus` / `error` / `success`. Error y éxito son semántico convencional
  accesible (`--color-error: #B42318`, `--color-success: #15803D`), siempre
  emparejado con ícono, nunca solo color. El estado de error usa borde más
  grueso (`--field-border-width-invalid: 1.5px` vs `1px` default) para que
  se note más; éxito se queda en el grosor default — solo el error necesita
  ese énfasis. Ver `handoff/input-states-proposals.html` para las 3
  propuestas comparadas.
- **Badges/tags** — decidido: fondo dorado/texto negro para estados
  positivos ("Nuevo", "E-Bike"), grafito/blanco para "Agotado" (§ ver
  `.badge` / `.badge-agotado` en `tokens.css`).

---

## 7. Referencia rápida de pantallas (ver Mockups PDF)

01 Home · 02 Catálogo · 03 Ficha de producto · 04 Carrito · 05 Checkout ·
06 Error 404 — cada una con notas de diseño explicando decisiones específicas
de layout.

---

## 8. Pantalla de carga (splash)

Decidida el 2026-08-07 tras 3 propuestas evaluadas con `emil-design-eng` +
`impeccable craft`. Prototipo completo en `handoff/loading-screen-proposals.html`
(Propuesta B). Wordmark real en `brand-assets/wordmark-sin-rinoceronte.png`.

**Mecánica:** el propio rinoceronte (contorno dorado → sólido dorado) es la
barra de progreso — se rellena de izquierda a derecha según el avance real de
carga (API + fotos de producto), vía `clip-path`, no `width` (evita layout
thrash). El wordmark aparece con fade-in una vez que hay avance visible, nunca
antes.

**Máquina de estados** (dispara con evento real, nunca con timer fijo):
- **Entrada:** contorno del rinoceronte visible de inmediato, 0ms.
- **Hold mínimo:** 350ms — evita parpadeo en cargas casi instantáneas.
- **Relleno:** `clip-path` del rinoceronte dorado, suavizado 100ms `linear`
  por tick (progreso real, no simulado).
- **Wordmark:** fade-in opacity, 300ms `ease-out`, una vez hay avance.
- **Umbral extendido (&gt;2.5s):** sin cambio visual adicional en esta
  propuesta — el relleno del rinoceronte ya comunica que sigue avanzando.
- **Salida:** `opacity` + `scale(1→1.02)` de todo el splash, 200ms
  `cubic-bezier(0.23, 1, 0.32, 1)` — rápida y silenciosa, porque el relleno ya
  cargó el peso de la espera.
- **`prefers-reduced-motion`:** se respeta — transición se reduce a solo
  `opacity`, sin `scale`.

**Layout:** rinoceronte y wordmark en columna centrada, gap de 8px
(`--space-sm`) entre ambos — el wordmark ya viene recortado sin relleno
interno, así que el gap chico es suficiente para respirar sin separarlos.

**Pendiente:** conectar el evento de progreso real (fetch de API + `decode()`
de imágenes) en vez de la simulación con `requestAnimationFrame` del
prototipo — eso es implementación, no diseño.
