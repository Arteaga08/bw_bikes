# Playbook de auditoría — seguridad y bugs

Prompt reutilizable para repetir la auditoría de agosto 2026 (rama
`audit/fase-1-seguridad-bugs`) en sesiones futuras. Pégalo completo en una
sesión nueva de Claude Code; ajusta solo la sección "Alcance" si el código
cambió de forma (nuevas apps, nuevo gateway de pago, etc.).

> **Orden fijo: primero seguridad (Parte 1), después bugs (Parte 2), después
> fixes.** No mezclar: un hallazgo de seguridad sin explotar es más caro que un
> bug funcional, y mezclar las dos caza-listas diluye la severidad de ambas.

---

## Cómo usar este documento

1. Copia el prompt de la sección "Prompt para pegar" completo.
2. Antes de pegarlo, actualiza manualmente:
   - La lista de milestones/fases entregadas (`docs/MILESTONES.md`).
   - La sección "Limitaciones conocidas y aceptadas" si algo de esa lista se
     resolvió o cambió de decisión desde la última corrida.
3. Espera el informe de hallazgos (Parte 1 + Parte 2) antes de aprobar
   cualquier fix — no dejes que la sesión salte directo a "arreglar" sin
   mostrar primero qué encontró.

---

## Prompt para pegar

```
Actúa como un auditor senior de seguridad y control de calidad para una
plataforma de e-commerce que procesa pagos con tarjeta de artículos de alto
valor (bicicletas de lujo, MXN). El código vive en apps/api (Express +
Mongoose + Stripe) y packages/shared. apps/web puede estar vacío o no —
verifícalo antes de asumir que hay frontend que auditar.

Trabaja en dos partes, en este orden, sin mezclarlas:

### Parte 1 — Seguridad

Verifica cada uno de estos 5 pilares contra el código real (no contra lo que
un comentario dice que hace) y cita archivo:línea como evidencia:

1. **Privacidad de la tarjeta (PCI).** ¿El backend ve, toca o persiste algún
   dato de tarjeta o el clientSecret de un PaymentIntent? Debe ser "nunca".
2. **Idempotencia.** ¿Existen dos capas independientes contra doble cobro:
   una a nivel de nuestra propia API (header/índice único) y otra a nivel del
   proveedor de pago (idempotency key nativa)? ¿Qué pasa cuando la idempotency
   key del proveedor expira (~24h en Stripe) y un replay genera un recurso
   nuevo — se persiste el nuevo id o queda huérfano?
3. **Atomicidad todo-o-nada.** ¿El cobro y el movimiento de inventario están
   protegidos contra una falla a mitad de camino? Busca sagas con
   compensación explícita, reservas atómicas sin read-then-write, y qué pasa
   si el proceso muere entre pasos.
4. **3D Secure + Radar (o el antifraude equivalente del gateway).** ¿El código
   solicita explícitamente un desafío de autenticación fuerte
   (`request_three_d_secure` o equivalente) y envía señales antifraude
   (dirección de envío, etc.) al crear el pago? Si no, es el hallazgo más caro
   posible: sin esto, la responsabilidad legal de un contracargo se queda en
   la tienda en vez de transferirse al banco emisor. Antes de proponer el fix,
   busca el costo real (precio oficial del proveedor) — no asumas que cuesta
   dinero sin verificarlo.
5. **Webhooks firmados.** ¿Se verifica la firma contra el body crudo (bytes
   exactos, montado antes de cualquier parser JSON)? ¿Hay ventana de
   tolerancia contra replay? ¿Hay dedupe por id de evento con un índice único
   insertado ANTES de procesar (no un find-then-insert)?

Además, audita a fondo (no solo confirmes) esta superficie:

- **Auth/sesión**: rotación de refresh tokens, detección de reuso, 2FA
  obligatorio para admin en cada request (no solo al login), invalidación por
  cambio de contraseña, anti-enumeración (timing + mensajes genéricos).
- **Autorización/IDOR**: la propiedad de un recurso debe vivir DENTRO del
  filtro de la query (`Model.findOne({_id, userId})`), nunca como chequeo
  posterior a una carga por id.
- **Mass assignment**: todo input pasa por validación con descarte de campos
  desconocidos (`stripUnknown` o equivalente); ningún schema de registro/perfil
  acepta un campo de rol o de estado privilegiado.
- **Inyección**: sanitización recursiva de operadores NoSQL/prototype
  pollution en body/params/query — presta atención especial a si el framework
  usa un getter para `req.query` que silenciosamente descarta mutaciones.
- **CSRF/origen**: si existe un chequeo de Origin/Referer como defensa en
  profundidad sobre `SameSite=strict`, verifica que compare el origen exacto
  (parseado), nunca por prefijo de string (`startsWith` dejaría pasar
  `https://dominio-legitimo.com.evil.com`).
- **Rate limiting**: revisa que TODO endpoint mutante sensible (login, 2FA,
  refresh, logout, checkout, webhook) tenga un limitador dedicado, no solo el
  backstop global. Un endpoint de refresh de sesión merece su propio
  presupuesto: no es adivinable por fuerza bruta, pero sí es abusable.
- **Config/secretos**: carga de env fail-fast, longitudes mínimas de
  secretos, exigencias reforzadas en producción, cero secretos en código
  fuente (solo en `.env.*.local` ignorado por git).
- **Logs/errores**: nunca se filtra un stack trace o un secreto en producción;
  los logs redactan campos sensibles.

### Parte 2 — Caza de bugs

Solo después de terminar la Parte 1. Barre por dominio, priorizando dinero e
inventario:

1. **Concurrencia**: reserva vs. commit vs. expiración de holds; toda
   transición de estado debe ser un CAS (compare-and-swap) atómico contra la
   base de datos, no un read-modify-write en dos pasos.
2. **Máquina de estados**: enumera todas las transiciones válidas y busca
   estados alcanzables que ningún handler de webhook/job maneja. Presta
   atención a qué pasa cuando un evento llega para un recurso ya en estado
   terminal, y a operaciones que dejan un recurso "huérfano" (p. ej. una orden
   cancelada localmente mientras su intento de pago sigue vivo en el
   proveedor — busca esto específicamente en cualquier flujo que reemplace o
   descarte un intento de pago anterior).
3. **Dinero**: redondeos de impuestos, acumulación de centavos, reglas de
   envío en el borde exacto de un umbral, coherencia entre el preview
   (carrito) y el cobro real (checkout).
4. **Jobs en segundo plano**: solapamiento de ticks, errores no capturados
   que maten el reagendado, comportamiento cuando la configuración cambia a
   mitad de un ciclo.
5. **Configuración dinámica (settings/feature flags)**: caché vs.
   invalidación en multi-instancia, valores límite que rompan invariantes.
6. **Coherencia doc↔código**: ¿la documentación de milestones/fases dice algo
   que el `git log` contradice?

**Método obligatorio**: cada hallazgo debe traer un *escenario de fallo
concreto* — entradas/estado específico → resultado incorrecto específico.
Nada de "podría ser un problema" o "sería buena práctica". Si no puedes
construir el escenario, no es un hallazgo, es una observación de estilo.

Reporta los hallazgos de ambas partes juntos, ordenados por severidad, antes
de proponer o aplicar ningún fix. Para cada uno: archivo:línea, resumen en una
frase, y el escenario de fallo.

### Verificación de cualquier fix

Todo fix va con TDD (test que falla primero) cuando toca dinero, inventario o
autenticación. Al cerrar, correr y reportar la salida real de:

    pnpm -r typecheck
    pnpm -r lint
    pnpm -r test
    pnpm -r build
    pnpm audit --prod

No declares nada "corregido" sin pegar la salida del test correspondiente.
```

---

## Controles endurecidos en la corrida de agosto 2026

Además de los 7 hallazgos de la Parte 1/2, se atendieron dos mejoras menores
que salieron a relucir al revisar la superficie completa:

- **CSP/HSTS explícitos** (`config/security-headers.ts`): `helmet()` corría
  con sus defaults (pensados para servir HTML); ahora usa `default-src 'none'`
  + `frame-ancestors 'none'` (esta API nunca sirve una página) y HSTS a 1 año
  con `includeSubDomains` + `preload`.
- **Verificación de contraseñas filtradas** (`services/password-breach.service.ts`):
  registro y reset de contraseña consultan la API k-anonymity de
  [Have I Been Pwned](https://haveibeenpwned.com/API/v3#PwnedPasswords) antes
  de aceptar una contraseña nueva. Diseño **fail-open**: si la API de HIBP no
  responde, no bloquea el registro — la disponibilidad de la tienda no debe
  depender de un tercero. El chequeo se ejecuta **antes** de la búsqueda por
  email en `registerUser`, no después — de lo contrario, una contraseña
  filtrada conocida (trivial de elegir a propósito) se vuelve un oráculo de
  existencia de cuenta (400 solo posible cuando el email no existe todavía).

## Limitaciones conocidas y aceptadas (no re-reportar sin nueva evidencia)

Decisiones ya tomadas por el negocio o el equipo — una corrida futura de este
playbook no debería volver a levantarlas como hallazgo nuevo salvo que algo
cambió:

- **CFDI se captura pero no se timbra** (decisión M7). Sentry (M15) y CFDI
  timbrado son trabajo de fases posteriores, no deuda de fase 1.
- **Cupones, MSI y facturación fiscal completa**: fuera de alcance, decidido
  en M5/M7.
- **Rate limiting con `MemoryStore`** (H-4 del audit de agosto 2026):
  aceptado mientras la API corra en una sola instancia. Migrar a un store
  compartido (Redis) es el disparador correcto si se agrega una segunda
  réplica — no antes.
- **URLs firmadas de adjuntos sin expiración temporal** (H-7): limitación de
  la cuenta de Cloudinary actual (falta `auth_token`), documentada en
  `storage.service.ts`. No es una regresión de código.
- **Radar for Fraud Teams** (reglas antifraude personalizadas, listas de
  bloqueo): fuera de alcance mientras el volumen de ventas sea bajo — tiene
  costo por transacción evaluada. Radar Lite (incluido gratis en la comisión
  estándar de Stripe) cubre la protección base y sí se espera que esté activo.
- **CI (`.github/workflows`) y cobertura de tests**: huecos reales de
  infraestructura, no de auditoría de seguridad/bugs — se reportan como
  recomendación aparte, no bloquean el cierre de esta auditoría.

---

## Pendiente hasta que exista `apps/web` (fase 3)

Esta sección no aplica mientras el frontend no exista — cuando lo haga,
agrégala a la Parte 1 como un sexto pilar:

- El formulario de pago usa Stripe Elements (o Payment Element) montado
  directamente contra la API de Stripe — el dato de tarjeta nunca pasa por
  una request a nuestro propio backend, ni siquiera de tránsito.
- El cliente llama `stripe.confirmPayment` (o equivalente) y maneja el
  redirect/challenge de 3D Secure — el backend por sí solo no puede completar
  ese paso, solo puede pedirlo.
- Ningún log del lado del cliente (analytics, Sentry, etc.) captura el
  `clientSecret` completo ni datos de tarjeta.
