# Aviso de Privacidad — plantilla

> **Cómo usar esta plantilla:** llena cada `[PLACEHOLDER: ...]` con el dato real, o pásale este
> archivo completo a tu abogado/asesor antes de publicarlo. Todo lo demás (datos recabados,
> proveedores, cookies) ya está verificado contra el código actual — no son suposiciones.
> Una vez aprobado, el contenido se porta al componente `apps/web/src/app/(storefront)/privacidad/page.tsx`
> (hoy tiene texto placeholder) y se decide si se quita `robots: { index: false }`.

**Última actualización:** [PLACEHOLDER: fecha de publicación]

---

## Responsable de tus datos personales

[PLACEHOLDER: razón social completa], con domicilio en [PLACEHOLDER: domicilio fiscal completo],
RFC [PLACEHOLDER: RFC de la empresa] ("B/W", "nosotros"), es responsable del tratamiento de tus
datos personales conforme a la Ley Federal de Protección de Datos Personales en Posesión de los
Particulares (LFPDPPP).

## Datos personales que recabamos

Recabamos los siguientes datos cuando creas una cuenta, realizas una compra, o envías una
solicitud de embajador/patrocinio:

- **Identificación y contacto:** nombre, apellido, correo electrónico, teléfono, fecha de
  nacimiento (opcional), ciudad.
- **Direcciones de envío** que guardas en tu cuenta: calle, número, colonia, código postal,
  estado, referencias de entrega (cobertura solo territorio nacional mexicano).
- **Datos fiscales**, si solicitas factura: RFC, razón social, uso de CFDI, régimen fiscal, código
  postal fiscal. *(Nota interna, no publicar: estos datos hoy se capturan pero la factura no se
  timbra todavía — evita prometer facturación real hasta que exista.)*
- **Medidas y preferencias de talla** ("mis tallas") que guardas para agilizar tus compras.
- **Datos de pago:** nunca vemos ni almacenamos el número completo de tu tarjeta. Nuestro
  procesador de pagos (Stripe) la tokeniza directamente en tu navegador; nosotros solo recibimos
  la marca y los últimos 4 dígitos, para mostrarte un resumen de tu compra.
- **Si aplicas a nuestro programa de embajadores o patrocinios:** disciplina, ciudad, redes
  sociales, número aproximado de seguidores, motivación, o datos del evento (nombre, fecha, sede,
  asistentes esperados), además de los archivos que adjuntes a tu solicitud.

## Para qué usamos tus datos

- Procesar tus pedidos y pagos.
- Crear y administrar tu cuenta.
- Enviarte notificaciones sobre el estado de tus pedidos, envíos y pagos.
- Verificar tu correo electrónico y permitirte recuperar tu contraseña.
- Evaluar solicitudes de embajador o patrocinio.
- Cumplir con obligaciones legales y fiscales.

[PLACEHOLDER: si planeas usar los datos para marketing directo o perfiles de compra a futuro,
agrega aquí esa finalidad como "secundaria" con su propio mecanismo de opt-out — hoy el sitio no
hace nada de esto.]

## Con quién compartimos tus datos

Compartimos datos únicamente con los proveedores necesarios para operar la tienda, nunca con
fines publicitarios de terceros:

| Proveedor | Para qué | Datos que recibe |
|---|---|---|
| **Stripe** | Procesamiento de pagos | Datos de tarjeta (tokenizados, nunca pasan por nuestro servidor), monto de la compra |
| **Resend** | Envío de correos transaccionales (verificación, confirmación de pedido, envío, reembolsos) | Tu correo y nombre |
| **Cloudinary** | Almacenamiento de imágenes y, si aplicas a embajador/patrocinio, de tus archivos adjuntos | Las imágenes/documentos que subes |
| **MongoDB Atlas** | Base de datos donde vive tu información | Todos los datos anteriores |

[PLACEHOLDER: si compartes datos con la paquetería para la entrega física (nombre, dirección,
teléfono), agrégala aquí explícitamente — hoy el sitio soporta DHL, FedEx, Estafeta,
Paquetexpress, Redpack y UPS.]

## Cookies que utilizamos

Usamos únicamente cookies técnicas necesarias para el funcionamiento del sitio — ninguna de
publicidad, analítica de terceros ni redes sociales:

| Cookie | Para qué sirve | Duración |
|---|---|---|
| `bw_access` | Mantiene tu sesión iniciada | Corta (sesión de acceso) |
| `bw_refresh` | Renueva tu sesión sin que tengas que volver a iniciar sesión | Más larga |
| `bw_2fa_challenge` | Solo para personal administrativo, paso de verificación en dos pasos | Muy corta (minutos) |

Al pagar, nuestro procesador de pagos (Stripe) puede colocar sus propias cookies técnicas
antifraude en tu navegador; no las controlamos directamente, forman parte de su tecnología de
seguridad.

Como todas nuestras cookies son estrictamente necesarias, no requieres dar un consentimiento
adicional para usarlas. Si en el futuro incorporamos herramientas de analítica o publicidad,
actualizaremos este aviso y agregaremos el mecanismo de consentimiento correspondiente.

## Tus derechos (ARCO)

Puedes solicitar en cualquier momento el **A**cceso, **R**ectificación o **C**ancelación de tus
datos personales, así como **O**ponerte a su tratamiento, escribiendo a
[PLACEHOLDER: correo de contacto para solicitudes de privacidad] o desde tu cuenta.

Responderemos tu solicitud en un plazo de [PLACEHOLDER: plazo de respuesta, p. ej. 20 días
hábiles], conforme lo establece la LFPDPPP.

## Cambios a este aviso

Podemos actualizar este aviso periódicamente. Publicaremos cualquier cambio en esta misma página
con su fecha de actualización.

## Contacto

¿Dudas sobre este aviso? Escríbenos a [PLACEHOLDER: correo de contacto general].
