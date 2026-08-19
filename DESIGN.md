---
name: Black and White Bikes
description: Panel administrativo de una tienda de bicicletas de lujo — minimalista, potente, premium.
colors:
  negro-carbono: "#0A0A0A"
  blanco-hueso: "#FAFAFA"
  grafito-rino: "#3A3A38"
  dorado-triunfo: "#F2B705"
  dorado-triunfo-hover: "#D9A404"
  dorado-triunfo-pressed: "#BF9003"
  dorado-triunfo-disabled: "#F6E4AC"
  dorado-triunfo-disabled-text: "#A89355"
  negro-carbono-hover: "#2B2B29"
  negro-carbono-disabled: "#D8D8D3"
  negro-carbono-disabled-text: "#9A9A95"
  surface-base: "#F1F1EE"
  surface-card: "#FFFFFF"
  surface-inset: "#EAEAE6"
  surface-overlay: "#0A0A0A"
  border-neutral: "#E2E2DE"
  bare-text: "#3A3A38"
  bare-hover: "#E2E2DE"
  bare-pressed: "#D8D8D3"
  action-danger: "#7A3B32"
  action-danger-soft: "#F1E0DC"
  action-success: "#4A5D3A"
  action-success-soft: "#E8ECE3"
  color-error: "#B42318"
  color-success: "#15803D"
typography:
  display:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "64px"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.5px"
  h1:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "44px"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.4px"
  h2:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.3px"
  h3:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1.30
  body-l:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.60
  body:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.60
  ui:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.40
  eyebrow:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.40
    letterSpacing: "3px"
  caption:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.50
  badge:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "9px"
    fontWeight: 500
    lineHeight: 1.30
    letterSpacing: "1px"
rounded:
  control: "2px"
  card: "10px"
  card-lg: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
  3xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.dorado-triunfo}"
    textColor: "{colors.negro-carbono}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.dorado-triunfo-hover}"
  button-primary-pressed:
    backgroundColor: "{colors.dorado-triunfo-pressed}"
  button-primary-disabled:
    backgroundColor: "{colors.dorado-triunfo-disabled}"
    textColor: "{colors.dorado-triunfo-disabled-text}"
  button-secondary:
    backgroundColor: "{colors.negro-carbono}"
    textColor: "{colors.blanco-hueso}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.negro-carbono-hover}"
  button-secondary-disabled:
    backgroundColor: "{colors.negro-carbono-disabled}"
    textColor: "{colors.negro-carbono-disabled-text}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.negro-carbono}"
    borderColor: "{colors.negro-carbono}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "44px"
  button-bare:
    backgroundColor: "transparent"
    textColor: "{colors.bare-text}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: "0"
  button-bare-hover:
    backgroundColor: "{colors.bare-hover}"
    textColor: "{colors.negro-carbono}"
  button-bare-pressed:
    backgroundColor: "{colors.bare-pressed}"
  button-danger:
    backgroundColor: "{colors.action-danger-soft}"
    textColor: "{colors.action-danger}"
  button-danger-strong:
    backgroundColor: "{colors.action-danger}"
    textColor: "{colors.blanco-hueso}"
  button-success:
    backgroundColor: "{colors.action-success-soft}"
    textColor: "{colors.action-success}"
    borderColor: "{colors.action-success}"
  button-inverse:
    backgroundColor: "transparent"
    textColor: "rgba(250, 250, 250, 0.7)"
  button-inverse-hover:
    textColor: "{colors.dorado-triunfo}"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.negro-carbono}"
    typography: "{typography.ui}"
    padding: "0 4px"
  card:
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.card}"
    padding: "{spacing.lg}"
  badge-accent:
    backgroundColor: "{colors.dorado-triunfo}"
    textColor: "{colors.negro-carbono}"
    typography: "{typography.badge}"
    rounded: "{rounded.control}"
    padding: "4px 8px"
  badge-unavailable:
    backgroundColor: "{colors.grafito-rino}"
    textColor: "{colors.blanco-hueso}"
    typography: "{typography.badge}"
    rounded: "{rounded.control}"
    padding: "4px 8px"
---

# Design System: Black and White Bikes

## 1. Overview

**Creative North Star: "El Rinoceronte Embistiendo"**

Máxima fuerza con el mínimo movimiento necesario. No hay gesto de sobra en
una embestida — cada línea de este sistema (tipografía sin adornos, espacio
en blanco, un solo acento dorado) es contundente porque es económica, no a
pesar de serlo. En el registro *product* del dashboard, eso se traduce a
paneles densos que se leen sin esfuerzo: la información compite consigo
misma, no con decoración.

El sistema rechaza explícitamente dos direcciones: la plantilla
DTC/e-commerce genérica (hero + tarjetas + trust badges + banda CTA, el
reflejo de categoría que cualquier generador produce sin criterio) y la
estética de deporte extremo/MTB agresivo (naranjas vibrantes, tipografía
angular, fotos de salto). Black and White Bikes vende lujo contenido, no
plantilla ni adrenalina.

**Key Characteristics:**
- Un solo acento (dorado) al ~10% de cualquier vista; negro y blanco cargan el 60%.
- Jerarquía por espacio y contraste, nunca por sombra.
- Una sola familia tipográfica en tres pesos, sin mezclar.
- Grid de espaciado de 8px sin valores sueltos.
- Componentes precisos y contenidos: cada estado (hover, focus, disabled) es deliberado, no casual.

## 2. Colors

Paleta restrained: dos neutros cargan el sistema, un tercero da profundidad de texto/borde, y un único acento dirige la acción. Nada compite con el dorado por atención.

### Primary
- **Dorado Triunfo** (#F2B705): el único acento del sistema. CTAs primarios, precios, foco sobre fondos oscuros, micro-detalles. Nunca color de fondo, nunca decoración repetida. Estados: hover #D9A404, pressed #BF9003, disabled #F6E4AC sobre texto #A89355.

### Neutral
- **Negro Carbono** (#0A0A0A): fondo dominante, texto principal, nav, overlay (modal/dropdown/toast). Botón secundario en su estado default; hover #2B2B29, disabled #D8D8D3 con texto #9A9A95.
- **Blanco Hueso** (#FAFAFA): fondos claros, texto sobre negro.
- **Grafito Rino** (#3A3A38): texto secundario y bordes con jerarquía — nunca compite con negro/blanco pero da profundidad donde el texto puro sería demasiado peso. Coincide con el estado `pressed` del botón secundario: el grafito es, literalmente, "el negro en su momento de máxima presión".
- **Base de superficie** (#F1F1EE): fondo de página.
- **Tarjeta** (#FFFFFF) con **borde neutral** (#E2E2DE): tarjetas, inputs, modales de contenido.

### Semantic (validación de formulario)
- **Error** (#B42318): borde y mensaje de campos inválidos. Deliberadamente fuera de la paleta de marca — es semántico convencional accesible, no tintado hacia el sistema, porque aquí el reconocimiento instantáneo importa más que la voz de marca. Siempre emparejado con ícono, nunca solo color. Borde más grueso que el resto de estados (1.5px vs 1px) para que se note antes de leer el mensaje.
- **Success** (#15803D): borde y mensaje de campos verificados. Mismo criterio que error; borde en el grosor default, no necesita el mismo énfasis visual porque no requiere acción del usuario.

### Codificación de datos

Añadida al rediseñar Inicio (2026-08): el sistema tenía reglas de marca (un
acento, sin sombra) pero ninguna regla de cómo un número comunica que algo va
bien o mal. Sin esto, un dashboard monocromo con un solo acento reservado
para CTAs no tiene ningún canal disponible para señalar estado en una tabla o
gráfico — el vacío que dejaba Inicio ilegible no era falta de color, era
falta de una regla para cuándo usarlo.

**Regla base: el color nunca es el único canal, y nunca codifica magnitud.**

Verificado con contraste WCAG sobre los tokens `estado-*` reales:

| Uso | Contraste medido | Veredicto |
|---|---|---|
| `estado-exito`/`advertencia`/`error` como **texto sobre `surface`** | 4.48 / 8.03 / 5.19 : 1 | Cumple AA — permitido |
| Los mismos tres como **rellenos adyacentes** (segmentos de barra, dona) | 1.16 / 1.55 / 1.79 : 1 | Falla el piso de 3:1 — prohibido |

De esa medición salen las reglas de uso:

- **Magnitud → longitud o posición**, nunca hue, nunca opacidad, nunca tamaño
  de fuente. Barra, línea, área, sparkline — el vocabulario que ya usan
  `OrdersByDayChart` y `RankedBarChart`.
- **Dirección (mejor/peor) → `estado-exito`/`estado-error` únicamente como
  color de texto, siempre junto a un glifo** (flecha arriba/abajo). Nunca
  como relleno de área o segmento — es justo lo que la medición de arriba
  descarta. Implementado en `DeltaIndicator`
  (`apps/web/src/components/ui/DeltaIndicator.tsx`): el signo va en el texto
  mismo ("+12%"/"-8%"), no solo en el color.
- **Ausencia de base de comparación ≠ cero.** Un delta sin periodo anterior
  con el que compararse dice "sin base de comparación", nunca `+∞%` ni se
  omite en silencio — mentir con un número es peor que no mostrarlo.
- **Énfasis → dorado, un solo elemento por gráfico, siempre con su valor
  etiquetado.** Regla ya existente de `RankedBarChart`, sin cambios.
- **Prohibido:** barra apilada de estados, dona de estados, paleta
  categórica, heatmap por hue. Confirmado por el validador del skill
  `dataviz` en M11 (grafito+dorado reprueban como par categórico) y
  reconfirmado aquí: los `estado-*` tampoco sirven como relleno.

### Named Rules
**The One Accent Rule.** El dorado nunca supera el 10% de una vista y nunca aparece dos veces como CTA primario en la misma pantalla. Su escasez es lo que lo hace leer como decisión, no como paleta.

**The Text-Only Direction Rule.** Un token `estado-*` puede pintar texto o un glifo; nunca puede pintar un área, una barra o un segmento. Si una vista necesita comunicar "bien/mal" sobre una superficie, se resuelve con un ícono y una etiqueta de texto en ese color, no con el fondo de la superficie misma.

## 3. Typography

**Display/Body Font:** Hanken Grotesk (con fallback `sans-serif`) — una sola familia, tres pesos, sin excepciones.

**Character:** Sans-serif limpio sin adornos; el lujo se percibe por espacio y tamaño, nunca por ornamento tipográfico. El peso ExtraBold es la voz de marca (titulares, hero); Medium es la voz operativa (botones, nav, labels); Regular es la voz editorial (párrafos).

### Hierarchy
- **Display** (800, 64px, lh 1.02, track -0.5px): hero principal. En mobile se reduce 25%.
- **Headline / H1** (800, 44px, lh 1.08, track -0.4px): título de sección.
- **Title / H2** (800, 30px, lh 1.15, track -0.3px): bloques internos.
- **H3** (500, 20px, lh 1.30): nombre de producto, títulos de tarjeta.
- **Body L** (400, 16px, lh 1.60): texto editorial. Máx. 65 caracteres por línea.
- **Body** (400, 14px, lh 1.60): descripciones.
- **UI / Label** (500, 13px, lh 1.40): navegación, botones.
- **Eyebrow** (500, 11px, lh 1.40, track +3px): kickers, labels de precio.
- **Caption** (400, 11px, lh 1.50): precios secundarios, metadatos.
- **Badge** (500, 9px, lh 1.30, track +1px, mayúsculas): tags de estado sobre tarjetas de producto.

### Named Rules
**The Two-Weight Rule.** Nunca más de dos pesos tipográficos en un mismo bloque de contenido. Si un bloque necesita un tercer nivel de énfasis, se resuelve con tamaño o color, no con un tercer peso.

## 4. Elevation

Sistema plano por diseño: no existe `box-shadow` decorativo en ningún componente. La jerarquía de profundidad se construye con cambio de fondo entre cuatro capas — Overlay (#0A0A0A) · Base (#F1F1EE) → Surface (#FFFFFF + borde #E2E2DE) → Inset (#EAEAE6) — nunca con sombra simulando elevación. En un dashboard con muchas superficies apiladas (tablas, tarjetas de métricas, paneles de filtro), la tentación de usar sombra para separar niveles se resuelve subiendo o bajando de capa, no añadiendo profundidad falsa.

**Inset** (#EAEAE6) es la cuarta capa, agregada al cerrar M10.5. Con solo tres, un panel dentro de una tarjeta no tenía a dónde ir y terminaba pintado con el fondo de página: leía como un agujero en la tarjeta, y un control transparente encima se quedaba sin cuerpo propio. La regla no cambia — sigue prohibido resolver profundidad con sombra — pero para cambiar de fondo hacen falta suficientes fondos a los que cambiar. Un escalón por nivel real de anidamiento; si un diseño pide un quinto, el problema es el anidamiento.

### Named Rules
**The Flat-By-Default Rule.** Ninguna superficie usa sombra para simular elevación, ni en reposo ni en hover. La diferencia de capa se lee por el fondo, punto.

## 5. Components

Precisos y contenidos: cada estado se siente deliberado, no casual. Cuatro variantes de botón, seis estados cada una, sin gestos decorativos de por medio.

### Buttons

Tres ejes independientes: **variante** es la forma, **tono** es el color,
**tamaño** es la caja. Matriz completa en `handoff/DESIGN_SYSTEM.md` §4.

- **Shape:** radio casi recto (2px) — transmite precisión, no suavidad.
- **Primary:** fondo Dorado Triunfo (#F2B705), texto Negro Carbono, altura 44px, padding horizontal 24px. Una sola acción principal por vista ("Comprar", "Ir a pagar").
- **Secondary:** fondo Negro Carbono, texto Blanco Hueso. Acciones de igual peso, no la principal.
- **Ghost:** transparente con borde Negro Carbono 1px. Acciones terciarias sueltas.
- **Bare:** transparente **sin borde**, glifo en Grafito Rino. Controles que se repiten en una fila o barra — reordenar, eliminar, cerrar. Al hover **levanta a blanco** (`surface`) con hairline `borde`, el mismo cuerpo que los inputs de al lado. Dentro de un `ButtonGroup` (que ya trae cuerpo blanco propio) ese hover bajaría a `borde` en vez de subir, para no quedar blanco sobre blanco. Agregada al cerrar M10.5: `ghost` repetido como ícono en cada fila producía una reja de recuadros y le daba al control menos importante el borde más fuerte de la fila.
- **Text:** transparente, subrayado que crece desde el centro, sin altura fija. Navegación inline.
- **Tonos** (`ghost`, `bare`, `text`): `neutral`, `danger` (reversible — suave en hover, sólido al presionar), `danger-strong` (irreversible — hover directo a sólido), `inverse` (controles sobre Overlay #0A0A0A). El subrayado de `text` toma el color del tono, nunca el dorado sobre una acción destructiva.
- **Hover / Focus:** hover oscurece el fondo ~10%, pressed ~20%. Foco: anillo de 3px separado 2px del control — negro sobre el primario dorado, dorado sobre fondos oscuros o neutros. Las cinco variantes implementan `:focus-visible`.
- **Disabled:** baja contraste, nunca cambia de tamaño.
- **Loading:** conserva el ancho original (evita saltos de layout); spinner de 10px a la izquierda vía `::before`, bloquea el click. Solo en acciones, no en enlaces.
- **Success:** ventana de 2s tras una acción que salió bien — etiqueta en pasado ("Agregado") con check, color `estado-exito`, y el control queda deshabilitado durante toda la ventana. El doble clic se cierra con el hook `useAsyncAction`, que bloquea de forma síncrona (un `ref`, no solo el estado de React) desde el primer clic hasta que la confirmación termina.

### Cards
- **Corner Style:** 10px (tarjetas pequeñas) / 14px (frames y contenedores grandes) — mayor que el radio de control porque suaviza superficies grandes sin restar precisión.
- **Background:** Surface Card (#FFFFFF) con borde neutral (#E2E2DE, 1px) — el mismo hairline en los cuatro lados, nunca uno engrosado como acento (ver Codificación de datos, §2).
- **Shadow Strategy:** ninguna — ver Elevation.
- **Internal Padding:** `lg` (24px) como base.
- **Estado en una tarjeta KPI** (`StatCard`): un punto sólido de 8px junto al eyebrow, en el color `estado-*`, más el texto del `hint` tinteado igual — nunca un borde lateral engrosado. Corregido en el rediseño de Inicio (2026-08): el stripe original violaba tanto la regla de bordes de arriba como la Text-Only Direction Rule.

### Badges
- **Shape:** mismo radio que los controles (2px), padding 4px 8px.
- **Accent** (fondo Dorado Triunfo, texto Negro Carbono): estado positivo — "Nuevo", "E-Bike". Reutiliza el único acento del sistema; máximo dos badges dorados visibles a la vez para no diluir el CTA primario de la vista.
- **Unavailable** (fondo Grafito Rino, texto Blanco Hueso): estado inerte — "Agotado". Deliberadamente NO usa el par disabled de botón (gris claro sobre gris) porque un badge de catálogo necesita más contraste que un control desactivado; usa el neutro secundario del sistema en su lugar. Decidido vía `impeccable live` el 2026-08-06.
- **Typography:** `badge` (500, 9px, track +1px, mayúsculas).

### Named Rules
**The Precise-and-Contained Rule.** Ningún componente tiene un estado "casual": hover, focus, pressed, disabled y loading están todos definidos con el mismo rigor que el estado default. Un componente sin sus seis estados no está terminado.

## 6. Do's and Don'ts

### Do:
- **Do** usar el dorado (#F2B705) como único acento, máximo un CTA primario dorado por vista.
- **Do** construir jerarquía con espacio (grid de 8px) y contraste de color, nunca con sombra.
- **Do** implementar `:focus-visible` en las cinco variantes de botón (anillo 3px, offset 2px) — WCAG AA.
- **Do** usar `bare` para cualquier control que se repita en una fila o barra, y `ghost` solo para acciones terciarias sueltas.
- **Do** renderizar un enlace con estilo de botón como `ButtonLink` (un `<a>`), nunca como `<Link><Button/></Link>` — eso anida un `<button>` dentro de un `<a>`.
- **Do** pintar un panel anidado dentro de una tarjeta con `inset`, nunca con `base`.
- **Do** mantener una sola familia tipográfica (Hanken Grotesk) en máximo dos pesos por bloque.
- **Do** conservar el ancho de un botón en estado `loading` para evitar saltos de layout.
- **Do** emparejar error/success con ícono, nunca depender solo del color (#B42318 / #15803D) para comunicar el estado.

### Don't:
- **Don't** usar plantilla DTC/e-commerce genérica: hero + 3 tarjetas + trust badges + banda CTA como gramática por defecto de una pantalla de dashboard.
- **Don't** usar estética de deporte extremo/MTB agresivo: naranjas vibrantes, tipografía angular, fotografía de acción/salto.
- **Don't** usar `box-shadow` para simular elevación en ninguna superficie, ni en reposo ni en hover.
- **Don't** repetir el dorado como color de fondo o como decoración recurrente — es acento, nunca superficie.
- **Don't** usar un radio de esquina fuera de la escala (2px control / 10px card / 14px card-lg) sin justificar el porqué.
- **Don't** dejar un botón sin sus seis estados (default, hover, focus, pressed, disabled, loading) al construir un componente nuevo.
- **Don't** poner un contorno a cada ícono de una fila: eso le da al control menos importante el borde más fuerte de la fila. Va `bare`, agrupado si las acciones son adyacentes.
- **Don't** recortar un grupo de botones con `overflow: hidden` — se traga el anillo de foco, que se dibuja 2px por fuera del control.
- **Don't** pasar `h-*`/`w-*` por `className` para cambiar el tamaño de un botón: sin `tailwind-merge` esa clase pierde contra la del componente por orden de CSS, en silencio. Se agrega un tamaño al sistema.
- **Don't** usar un token `estado-*` como relleno de barra apilada, dona o segmento — falla el piso de contraste 3:1 como relleno adyacente (§2, Codificación de datos). Solo como color de texto/glifo.
- **Don't** mostrar un delta como `+∞%` o inventar un `0%` cuando no hay periodo anterior con el que comparar — decir "sin base de comparación" (§2, Codificación de datos).
