# Product

## Register

product

## Users

Equipo interno (admin/ops) de Black and White Bikes: quien gestiona catálogo,
pedidos, envíos, precios/inventario y analítica de ventas de la tienda. Es
contexto de trabajo, no de compra — el objetivo es operar la tienda con
eficiencia y confianza en los datos, no persuadir a un visitante. Ya existe
la capa de datos (M1-M7 en `docs/MILESTONES.md`: Settings por sección,
analítica de stats/product-views con ventanas de tiempo consistentes,
alertas de operación); este trabajo es la capa visual sobre esa base
(M11 — panel visual de Settings y analítica).

## Product Purpose

Panel administrativo para operar Black and White Bikes: configurar
envío/precios/inventario por sección sin pisar otras configuraciones,
revisar analítica de ventas y preferencias de catálogo con ventanas de
tiempo consistentes entre módulos, y gestionar alertas operativas
(autorizaciones por expirar, pedidos esperando confirmación de proveedor).
Éxito significa que el equipo puede confiar en los números que ve sin
verificarlos dos veces, y completar tareas de configuración sin miedo a
romper algo que no estaba tocando.

## Brand Personality

Minimalista, Potente, Premium. El dashboard hereda la disciplina del sistema
de marca (60/30/10, un acento dorado, jerarquía sin sombras) pero al servicio
de la operación: potente significa que la información densa (tablas,
métricas, filtros) se lee con la misma claridad que un titular de marca, no
que se sacrifica densidad por estética.

## Anti-references

- Plantilla DTC/e-commerce genérica: hero + 3 cards + trust badges + banda
  CTA — el reflejo de categoría que cualquier generador produce sin criterio.
  El dashboard no es una landing; no debe pedir prestada esa gramática visual.
- Estética de deporte extremo/MTB agresivo: naranjas vibrantes, tipografía
  angular, fotos de salto/acción. Black and White Bikes vende lujo contenido,
  no adrenalina — ni en el sitio público ni en el panel interno.
- Dashboards SaaS genéricos de dark-mode-azul-con-glow: el sistema ya tiene
  identidad propia (negro/blanco/dorado); no se diluye por reflejo de
  categoría "panel admin".

## Design Principles

- **El dorado es acento único, nunca decoración repetida.** Un solo CTA
  primario dorado por vista, incluso en pantallas densas de tabla/formulario.
- **Jerarquía por espacio y contraste, nunca por sombra falsa.** El sistema
  es plano por diseño (`handoff/DESIGN_SYSTEM.md` §3.2); en un dashboard con
  muchas superficies apiladas (tablas, tarjetas de métricas, paneles de
  filtro) la tentación de usar sombras para separar niveles se resuelve con
  cambio de fondo, no con elevación.
- **Un cambio no debe pisar otro.** Reflejo directo del invariante ya
  implementado en `Settings.updateSection` (M7): en la UI, editar una
  sección de configuración debe sentirse aislada de las demás, sin efectos
  secundarios visibles ni sorpresas.
- **Los números que se muestran juntos deben ser comparables.** La API ya
  garantiza que los módulos de un mismo panel de stats comparten ventana de
  tiempo (M7); el dashboard debe hacer esa consistencia visible, no solo
  correcta en el backend.
- **Precisión antes que decoración.** Radios casi rectos en controles,
  tipografía de una sola familia en tres pesos, espaciado en grid de 8px —
  el panel admin no necesita menos disciplina que el sitio de marca, solo
  una aplicación distinta de la misma disciplina.

## Accessibility & Inclusion

WCAG AA. Foco visible en todos los controles interactivos (anillo 3px,
offset 2px — ya corregido en `handoff/tokens.css` para las 4 variantes de
botón), navegación por teclado completa en tablas/filtros/formularios,
contraste de texto AA en todas las combinaciones de superficie del sistema.
