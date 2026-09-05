# Política de Devoluciones y Reembolsos — plantilla

> **Cómo usar esta plantilla:** llena cada `[PLACEHOLDER: ...]`. Esta política hoy **no existe
> como página** en el sitio — al aprobar el contenido, hay que crear la ruta `/devoluciones` en
> `apps/web/src/app/(storefront)/devoluciones/page.tsx`.
>
> **Importante antes de publicar:** el sistema hoy **no tiene ningún flujo de devolución física
> de producto (RMA)** implementado. El único mecanismo existente es el reembolso monetario, que
> se dispara manualmente desde el dashboard de Stripe (no hay endpoint propio de reembolso). Antes
> de prometer un proceso de devolución por escrito, defínelo operativamente con tu equipo —
> especialmente quién recibe la bici/producto de vuelta, cómo se verifica su estado, y quién paga
> el envío de retorno.

**Última actualización:** [PLACEHOLDER: fecha de publicación]

---

## Derecho de retracto

Conforme a la Ley Federal de Protección al Consumidor, cuentas con **5 días hábiles** a partir de
la recepción de tu pedido para solicitar su devolución, sin necesidad de justificar el motivo.

## Condiciones para aceptar una devolución

[PLACEHOLDER: condiciones — por ejemplo, producto sin uso, con empaque y etiquetas originales,
sin daños. Define esto con tu equipo; no existe hoy en el código.]

## Cómo solicitar una devolución

[PLACEHOLDER: proceso paso a paso — a qué correo/formulario escribir, qué información incluir
(número de pedido, motivo), y en cuánto tiempo te responderemos. Este flujo no existe todavía en
el sistema — hoy no hay ningún formulario ni endpoint de solicitud de devolución.]

## Quién paga el envío de devolución

[PLACEHOLDER: define si el costo de envío de vuelta lo cubre el cliente o la tienda, y si depende
del motivo (producto defectuoso vs. cambio de opinión).]

## Tiempos y forma de reembolso

Una vez recibido y verificado el producto devuelto, procesamos el reembolso a través de Stripe,
directamente al mismo método de pago con el que se realizó la compra. El tiempo en que el
reembolso se refleja en tu estado de cuenta depende del banco emisor de tu tarjeta y puede tardar
algunos días hábiles.

Recibirás un correo de confirmación en cuanto el reembolso sea procesado.

## Productos que no aplican para devolución

[PLACEHOLDER: si hay excepciones — por ejemplo, productos personalizados o bajo pedido — indícalas
aquí explícitamente.]

## Pedidos bajo pedido / preventa cancelados antes del envío

Si tu pedido bajo pedido o en preventa es cancelado antes de confirmarse con el proveedor o antes
de enviarse, no se realiza ningún cargo (o se cancela el cargo pendiente en su totalidad).

## Contacto

¿Dudas sobre una devolución o reembolso? Escríbenos a
[PLACEHOLDER: correo de contacto de devoluciones/soporte].
