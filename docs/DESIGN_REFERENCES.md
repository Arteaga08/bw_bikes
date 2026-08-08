# Referencias visuales — panel admin

Inspiración de layout/composición para pantallas de negocio de la fase 2 (M9–M11). **Nunca se
replican datos, copy ni paleta de la referencia** — solo patrones de composición, adaptados a
`handoff/DESIGN_SYSTEM.md` (tokens propios, un solo acento dorado, sin sombras).

## Flup Furniture — Modern Admin Dashboard (Dribbble)

<https://dribbble.com/shots/18895539-Modern-Admin-Dashboard-UI-Design-for-Flup-Furniture-App-Website>
— compartida por Manuel el 2026-08-07.

**Patrones a retomar:**
- Fila de 4 KPI cards + un quinto tile "Add data" en ghost/dashed — encaja con `StatCard` y el
  patrón ghost/`EmptyState` ya existentes en `apps/web/src/components/ui/`.
- Gráfico de barras de doble serie (ej. Gross margin / Revenue) con leyenda por color arriba a la
  derecha y tooltip flotante al hover.
- Donut chart con lista de leyenda a la izquierda (categoría + %).
- Lista rankeada con bullet de color + porcentaje (ej. ventas por país).
- Sidebar de dos columnas (rail de iconos colapsado + panel expandido con secciones agrupadas) — más
  elaborado que el Sidebar de una sola columna que M8 ya entregó. Si se adopta, es un rediseño del
  shell existente (`apps/web/src/components/shell/Sidebar.tsx`), no una pieza nueva aislada.

**Dónde aplica:**
- KPIs + gráficos → contenido real de **M11** (`/admin` Inicio, `/admin/analitica`), consumiendo
  `GET /api/v1/admin/stats/overview` y los módulos de `apps/api/src/services/stats/` (ya existen
  desde M7, sin UI todavía).
- Lista/tabla de órdenes → **M9** (`/admin/ordenes`).
- Rediseño de Sidebar a dos columnas → cambio transversal al shell, a decidir aparte cuando se
  retome (afecta M8 ya entregado).

**Pendiente al retomar:** elegir librería de charts (Recharts es la opción más común con
Next+Tailwind, pero no está decidida) y mapear la paleta de la referencia a los tokens propios del
proyecto — nunca los colores originales del mockup.

**Nota de cierre de M9:** ninguno de los patrones listados arriba aplicó de verdad — el mockup de
Flup es KPI cards + gráficos + listas rankeadas, y M9 es una cola de trabajo con acciones por fila,
no un dashboard analítico. La tabla/detalle de `/admin/ordenes` (tabs → filtros → tabla ·
`SlideOver` de detalle) sale directo de la plantilla de página admin de
`~/.claude/standards/DASHBOARD_GUIDELINES.md` §3, no de esta referencia. Los KPIs + gráficos siguen
pendientes para M11, que es donde esta referencia sí aplica.
