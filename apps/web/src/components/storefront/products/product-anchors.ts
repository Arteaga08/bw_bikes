/**
 * Los ids de las secciones de la PDP a las que se navega con un enlace de
 * ancla. Viven en su propio módulo, y no en el componente que los pinta,
 * porque quien enlaza y quien es enlazado están en lados distintos de la
 * frontera servidor/cliente: `ProductDescriptionTeaser` es `"use client"` y
 * `ProductOverview` no, así que importar la constante desde el componente
 * arrastraría todo ese módulo al bundle del cliente.
 */

/** La sección editorial bajo la galería — `ProductOverview`. */
export const PRODUCT_OVERVIEW_ANCHOR = "descripcion";

/**
 * La ficha técnica completa (`specGroups`). El bloque que la pinta todavía no
 * existe: `ProductSummaryCard` ya enlaza aquí y el enlace queda sin destino
 * hasta que se construya.
 */
export const PRODUCT_SPECS_ANCHOR = "especificaciones";
