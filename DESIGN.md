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
  surface-overlay: "#0A0A0A"
  border-neutral: "#E2E2DE"
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
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "44px"
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

### Named Rules
**The One Accent Rule.** El dorado nunca supera el 10% de una vista y nunca aparece dos veces como CTA primario en la misma pantalla. Su escasez es lo que lo hace leer como decisión, no como paleta.

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

Sistema plano por diseño: no existe `box-shadow` decorativo en ningún componente. La jerarquía de profundidad se construye con cambio de fondo entre tres capas — Base (#F1F1EE) → Surface (#FFFFFF + borde #E2E2DE) → Overlay (#0A0A0A) — nunca con sombra simulando elevación. En un dashboard con muchas superficies apiladas (tablas, tarjetas de métricas, paneles de filtro), la tentación de usar sombra para separar niveles se resuelve subiendo o bajando de capa, no añadiendo profundidad falsa.

### Named Rules
**The Flat-By-Default Rule.** Ninguna superficie usa sombra para simular elevación, ni en reposo ni en hover. La diferencia de capa se lee por el fondo, punto.

## 5. Components

Precisos y contenidos: cada estado se siente deliberado, no casual. Cuatro variantes de botón, seis estados cada una, sin gestos decorativos de por medio.

### Buttons
- **Shape:** radio casi recto (2px) — transmite precisión, no suavidad.
- **Primary:** fondo Dorado Triunfo (#F2B705), texto Negro Carbono, altura 44px, padding horizontal 24px. Una sola acción principal por vista ("Comprar", "Ir a pagar").
- **Secondary:** fondo Negro Carbono, texto Blanco Hueso. Acciones de igual peso, no la principal.
- **Ghost:** transparente con borde Negro Carbono 1px. Acciones terciarias.
- **Text:** transparente, subrayado, sin altura fija. Navegación inline.
- **Hover / Focus:** hover oscurece el fondo ~10%, pressed ~20%. Foco: anillo de 3px separado 2px del control — negro sobre el primario dorado, dorado sobre fondos oscuros o neutros. Las cuatro variantes implementan `:focus-visible`.
- **Disabled:** baja contraste, nunca cambia de tamaño.
- **Loading:** conserva el ancho original (evita saltos de layout); spinner de 10px a la izquierda vía `::before`, bloquea el click.

### Cards
- **Corner Style:** 10px (tarjetas pequeñas) / 14px (frames y contenedores grandes) — mayor que el radio de control porque suaviza superficies grandes sin restar precisión.
- **Background:** Surface Card (#FFFFFF) con borde neutral (#E2E2DE, 1px).
- **Shadow Strategy:** ninguna — ver Elevation.
- **Internal Padding:** `lg` (24px) como base.

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
- **Do** implementar `:focus-visible` en las cuatro variantes de botón (anillo 3px, offset 2px) — WCAG AA.
- **Do** mantener una sola familia tipográfica (Hanken Grotesk) en máximo dos pesos por bloque.
- **Do** conservar el ancho de un botón en estado `loading` para evitar saltos de layout.

### Don't:
- **Don't** usar plantilla DTC/e-commerce genérica: hero + 3 tarjetas + trust badges + banda CTA como gramática por defecto de una pantalla de dashboard.
- **Don't** usar estética de deporte extremo/MTB agresivo: naranjas vibrantes, tipografía angular, fotografía de acción/salto.
- **Don't** usar `box-shadow` para simular elevación en ninguna superficie, ni en reposo ni en hover.
- **Don't** repetir el dorado como color de fondo o como decoración recurrente — es acento, nunca superficie.
- **Don't** usar un radio de esquina fuera de la escala (2px control / 10px card / 14px card-lg) sin justificar el porqué.
- **Don't** dejar un botón sin sus seis estados (default, hover, focus, pressed, disabled, loading) al construir un componente nuevo.
