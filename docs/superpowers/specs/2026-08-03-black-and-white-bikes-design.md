# Black and White Bikes — Diseño del sistema

**Fecha:** 2026-08-03
**Estado:** Aprobado. Ejecución por milestones — ver `docs/MILESTONES.md` para el avance real.

## Contexto

E-commerce de bicicletas de lujo para México (montaña, ruta, ciudad) más accesorios, con panel de
administración propio. Ticket alto ($80k–$300k MXN), catálogo técnico, y un mecanismo de negocio que
no existe en un e-commerce estándar: parte del catálogo se ofrece sin stock propio — el dueño debe
confirmar disponibilidad con el proveedor antes de que el cobro se haga efectivo.

Rigen `~/.claude/standards/BACKEND_ARCHITECTURE_GUIDELINES.md`, `BACKEND_SECURITY_GUIDELINES.md`,
`ECOMMERCE_ARCHITECTURE_GUIDELINES.md`, `FRONTEND_GUIDELINES.md`, `DASHBOARD_GUIDELINES.md` y
`PROJECT_GUIDELINES.md`. Este documento no las repite; documenta las decisiones específicas de este
proyecto y dónde se aparta o extiende el patrón genérico.

## Flujo del proyecto

```
FASE 1  Backend y seguridad          M1 – M7
FASE 2  Dashboard de administración  M8 – M11
FASE 3  Página pública (storefront)  M12 – M14
FASE 4  Automatización               M15 – M17
```

En serie: no se avanza de fase sin verificar la anterior. Cada milestone se ejecuta en un chat nuevo
con contexto fresco — ver el protocolo de cierre en el plan de arranque
(`~/.claude/plans/nuevo-proyecto-black-and-prancy-dewdrop.md`) para los comandos exactos de
commit/merge y el prompt de traspaso.

## Decisiones cerradas con el cliente

| Tema | Decisión |
|---|---|
| Stock bajo pedido | Preautorización Stripe con **captura manual**: se autoriza al comprar, el admin confirma stock y captura; si no hay, cancela la autorización sin cargo |
| Pasarela | **Solo Stripe** (detrás de un adapter, para no bloquear sumar Mercado Pago después) |
| Catálogo | **Dos entidades separadas**: `Bike` y `Accessory`, cada una con su árbol de categorías y su SKU |
| Cross-sell | La página de detalle de bici sugiere accesorios para completar la compra |
| Ficha técnica | **100% libre**, sin plantillas: el admin construye grupos y campos por producto |
| Cuentas | **Obligatorias**, con verificación de correo |
| Embajadores / patrocinios | Solo solicitudes + flujo de aprobación en admin. Sin comisiones |
| Bots | Dos, **reactivos**: IG/FB DM y WhatsApp FAQ. Fase 4 |
| Envíos | Pendiente de definir — ver "Decisiones abiertas" |

### Consecuencias que el cliente debe tener presentes

1. **Ficha técnica libre → filtros de tienda limitados.** No hay forma confiable de filtrar sobre
   campos que cada producto nombra distinto. La ficha técnica es **solo de exhibición**; los filtros
   del storefront se construyen sobre campos de primera clase (categoría, talla, color, precio,
   marca, tipo de freno).
2. **La autorización de Stripe expira a los ~7 días.** El sistema avisa al admin antes y libera de
   forma ordenada (M5).
3. **Preautorización con captura manual no es compatible con MSI.** Las bicis bajo pedido no pueden
   ofrecer meses sin intereses; las que sí tienen stock, sí.
4. **Meta no permite promociones proactivas por DM** fuera de la ventana de 24 h — los bots de la
   fase 4 son reactivos, no emisores de campañas.

## Arquitectura

Monorepo pnpm:

```
bw_bikes/
├── apps/
│   ├── api/     Express 5 + TS estricto — routes/controllers/services/models/validators/middlewares
│   └── web/     Next.js App Router + Tailwind — storefront (es) + /admin
├── packages/
│   └── shared/  Contrato tipado: ApiResponse, enums de estado, tipos de dominio
└── docs/
    ├── superpowers/specs/   Este documento
    └── MILESTONES.md        Tablero de avance real
```

Backend y frontend hablan solo por HTTP REST (`/api/v1`). Auth por cookie `HttpOnly`. Deploy
separado (web en Vercel, api en Render/Railway).

### Dos catálogos separados, un solo motor transaccional

```
CATÁLOGO (separado)                 TRANSACCIONAL (único)
─────────────────────               ─────────────────────
BikeCategory     ──┐
Bike               ├──► referencia  InventoryItem { itemType, itemId, sku, onHand, reserved }
   variantes            por          Cart          { lines: [{ itemType, itemId, sku, qty }] }
   specGroups[]        {tipo,id,sku} Order         { lines: [ snapshot inmutable ] }
                    │
AccessoryCategory ──┤
Accessory          ─┘
```

`itemType` (`"bike" | "accessory"`) vive en `packages/shared`. Las líneas de orden guardan snapshot
inmutable, así que el módulo de órdenes nunca vuelve a leer el catálogo. Cross-sell:
`Bike.relatedAccessories: ObjectId[]`, curaduría manual.

### Ficha técnica libre

```ts
specGroups: [{ title: string, order: number,
               fields: [{ label: string, value: string, order: number }] }]
```

Embebida en el producto, sin colección ni plantilla. El admin agrega/renombra/reordena/borra grupos
y campos; se valida (Joi, longitudes máximas) y se sanitiza (`xss`) como cualquier string de usuario.

### Máquina de estados de la orden (M5, módulo crítico)

```
                       ┌─ (toda la orden es in_stock) ─────────────┐
pending_payment ──────►│                                           ├──► paid ──► processing ──► shipped ──► delivered
                       └─ (alguna línea on_request) ──►            │
                          authorized ──► awaiting_supplier_confirmation
                                              │  admin confirma ───┘
                                              │  admin rechaza ────► cancelled
                                              └─ autorización expira ► authorization_expired
```

Regla del carrito mixto: si cualquier línea es `on_request`, la orden completa usa
`capture_method: "manual"`. El detalle completo de reglas de pago, webhooks e idempotencia vive en el
plan de arranque y se implementa en M5.

## Fases y milestones

El detalle completo de qué entrega cada milestone (M1–M17) y su criterio de verificación vive en
`~/.claude/plans/nuevo-proyecto-black-and-prancy-dewdrop.md`. Este documento no lo duplica para
evitar que las dos fuentes diverjan; `docs/MILESTONES.md` es la fuente de verdad de **qué está hecho**.

## Decisiones abiertas

1. **Costo de envío** — **cerrada en M6**: tarifa plana configurable desde `Settings` (M7 la migró
   del env var donde vivía hasta entonces).
2. **Jobs en background** — **cerrada en M4**: cron (`setTimeout` autoreagendado desde M7, leyendo el
   intervalo de `Settings.jobs` en cada tick) + TTL de Mongo, no BullMQ + Redis.
3. **Facturación CFDI/SAT** — **cerrada parcialmente en M7**: no se integra ningún PAC (Facturama, SW
   Sapien, etc.); si más adelante se necesita, es un milestone propio con timbrado, cancelación y
   notas de crédito por reembolso. Lo que M7 sí hace es capturar los datos fiscales opcionales
   (`BillingInfo`: RFC, razón social, uso de CFDI, régimen fiscal) en el carrito y congelarlos en la
   orden al checkout, para que un futuro milestone de facturación no tenga que migrar órdenes
   históricas.
4. **Sentry** para error tracking — **cerrada en M7: sí**. La implementación (DSN, adapter detrás de
   la misma factory que `mailer`/`notifier`) baja a M15, junto con el resto de las integraciones
   reales de la fase 4.

## Verificación

Por milestone: `pnpm -r exec tsc --noEmit`, `pnpm -r lint`, `pnpm -r build`, `pnpm -r test`,
`pnpm audit --prod`, todos limpios antes de declarar el milestone cerrado. M5 añade las 7 pruebas
end-to-end del mecanismo de pago (sobreventa, bajo pedido feliz/rechazado, expiración, webhook
duplicado, carrito mixto, anti-IDOR) — detalladas en el plan de arranque.
