# SEO — Palabras clave (research inicial)

> **Estado:** research cualitativo, sin datos de volumen/competencia de herramienta
> (Ahrefs/SEMrush/GSC). Sirve para definir arquitectura de contenido e IA del sitio
> público ahora; antes de publicar, validar volumen real con Google Keyword Planner
> o Search Console una vez haya tráfico.
>
> **Contexto de negocio:** Black and White Bikes es distribuidor autorizado de
> marcas de bicicletas de alta gama (no reventa de usadas), venta a toda la
> República Mexicana. Catálogo: carretera, gravel, montaña, urbana/eléctrica.
> Audiencia: desde quien se inicia en ciclismo hasta profesional. A futuro:
> competencias y embajadores.

## Cómo usar este documento

Cuando se construya `apps/web`, estas keywords se mapean a:
- **Title tag / H1** → keyword principal de cada página de categoría
- **Meta description / intro (100 primeras palabras)** → keyword + variación semántica
- **URL slug** → versión corta de la keyword principal
- **Contenido de blog/guías** → keywords informacionales (fase 2, cuando exista sección de contenido)

No mezclar keywords transaccionales y navegacionales en la misma página: cada
página de categoría apunta a **una** intención principal.

---

## 1. Keywords transaccionales — genéricas de marca/tienda

Para homepage y páginas "quiénes somos" / landing principal.

| Keyword | Intención | Prioridad |
|---|---|---|
| bicicletas de alta gama méxico | Transaccional | Alta |
| tienda de bicicletas premium méxico | Transaccional | Alta |
| distribuidor bicicletas de lujo | Transaccional | Media |
| comprar bicicleta de gama alta | Transaccional | Alta |
| bicicletas premium envío a toda la república | Transaccional | Media |
| tienda de bicicletas de marca méxico | Transaccional | Alta |

## 2. Keywords por categoría de producto

Cada categoría es una página propia — no compitan entre sí por la misma keyword.

### Carretera (Road)
- bicicleta de carretera de alta gama
- bicicleta de ruta profesional méxico
- comprar bicicleta de carretera méxico
- bicicletas de ruta para principiantes *(informacional/transicional)*
- bicicleta de carretera carbono

### Gravel
- bicicleta gravel méxico
- comprar bicicleta gravel
- bicicleta gravel para principiantes
- mejores bicicletas gravel 2026 *(informacional — blog)*
- bicicleta gravel vs montaña *(informacional — comparativa, blog)*

### Montaña (MTB)
- bicicleta de montaña de alta gama
- bicicleta mtb profesional méxico
- comprar bicicleta de montaña méxico
- bicicleta de montaña doble suspensión
- bicicleta mtb para principiantes

### Urbana / Eléctrica
- bicicleta urbana premium méxico
- bicicleta eléctrica de alta gama
- comprar bicicleta eléctrica méxico
- bicicleta urbana para ir al trabajo *(informacional — blog)*

## 3. Keywords por audiencia / nivel

Útiles para páginas de "guía de compra" o filtros de catálogo, no páginas
independientes salvo que el volumen lo justifique.

- bicicleta para principiantes ciclismo
- cómo empezar en el ciclismo de ruta *(blog)*
- mejor bicicleta para empezar a rodar *(blog)*
- equipo de ciclismo profesional méxico
- bicicleta para triatlón

## 4. Keywords de marca — pendiente

**Bloqueado:** falta que el cliente confirme el listado de marcas del catálogo.

Cuando se tenga la lista, el patrón por marca es:

```
[marca] méxico
comprar [marca] méxico
[marca] [modelo] precio méxico
distribuidor [marca] méxico
```

Ejemplo si el catálogo incluye Trek: "trek méxico", "comprar trek méxico",
"distribuidor trek méxico". Estas keywords suelen tener volumen alto y
competencia relativamente baja a nivel local — priorizar en cuanto se
confirme el catálogo.

## 5. Keywords geográficas

La marca vende a toda la República, pero conviene reforzar presencia en las
plazas de mayor densidad de ciclismo de alta gama (útil para Google Business
Profile / local SEO si hay showroom o punto de entrega físico):

- bicicletas de alta gama CDMX
- bicicletas premium Guadalajara
- bicicletas de lujo Monterrey
- tienda de bicicletas [ciudad] *(duplicar patrón según plazas prioritarias del negocio)*

*(Nota: solo vale la pena si hay showroom/punto físico o campañas locales;
si la operación es 100% e-commerce nacional, priorizar 1–2 en vez de todas.)*

## 6. Keywords de contenido futuro (competencias / embajadores)

Para cuando se lance esa sección — content pillar de autoridad y engagement,
no transaccional directo:

- competencias de ciclismo méxico
- calendario de carreras ciclismo méxico
- embajadores de ciclismo méxico
- equipo de ciclismo [nombre de marca propia si aplica]

## 7. Próximos pasos

1. Cliente confirma listado de marcas del catálogo → completar sección 4.
2. Validar volumen real de las keywords de secciones 1–3 con Google Keyword
   Planner o Search Console antes de fijar la IA definitiva de categorías.
3. Definir si habrá showroom/punto físico → decide si sección 5 se implementa.
4. Cuando se defina la arquitectura de `apps/web`, mapear cada keyword de
   prioridad Alta a una URL/página específica (evitar keyword cannibalization).
