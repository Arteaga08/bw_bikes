import type { SpecGroup } from "@bw-bikes/shared";

export interface ProductSpecGroupsProps {
  groups: SpecGroup[];
}

/**
 * El contenido de la fila "Especificaciones técnicas": un apartado tras otro,
 * cada uno con su título a la izquierda y sus pares label/valor a la derecha.
 *
 * `groups` llega ya saneado por `bike.service.ts` (`toPublicSpecGroups`):
 * apartados/campos ocultos fuera, campos con `value` vacío fuera, todo
 * ordenado por `order`, apartados sin campos ya descartados. Este componente
 * no repite esos guards — confía en el contrato del backend.
 *
 * **Hairline solo entre apartados, nunca bajo cada renglón** — la misma regla
 * que ya explica el doc comment de `ProductSummaryCard`: un filete por fila
 * es el reflejo automático para una ficha de specs, y con hasta 30 campos por
 * apartado satura la lectura en vez de ordenarla. Los pares se agrupan por
 * proximidad (label pegado a su valor, aire entre pares) y la única regla
 * horizontal que queda es la que separa un apartado del siguiente.
 *
 * Una sola columna de valores, no dos junto al label: los valores reales son
 * frases largas ("Tarmac SL9 FACT 10r Carbon, Rider First Engineered, Win
 * Tunnel Engineered..."), así que el label va arriba y el valor debajo, con
 * el mismo tope de 68ch que `ProductOverview` usa para su propio texto largo.
 *
 * La etiqueta ("Freno Delantero") se pinta en el mismo tamaño que el valor,
 * solo que en `negro`/`font-medium` contra el `grafito` regular del valor —
 * jerarquía por peso y color, no por tamaño. Antes era un eyebrow de 11px en
 * mayúsculas (`text-eyebrow uppercase`), que funciona para un resumen de 4-5
 * filas (`ProductSummaryCard`) pero no para una subcategoría real dentro de
 * un apartado — la referencia que Manuel trajo (Specialized/Cannondale) la
 * lee como un renglón más de la ficha, no como metadata diminuta.
 */
export function ProductSpecGroups({ groups }: ProductSpecGroupsProps) {
  return (
    <div className="flex flex-col">
      {groups.map((group, index) => (
        <section
          key={`${group.order}-${group.title}`}
          className={
            index === 0
              ? "lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-xl"
              : "mt-xl border-t border-borde pt-xl lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-xl"
          }
        >
          <h3 className="font-display text-h3 text-negro">{group.title}</h3>

          <dl className="mt-md grid gap-lg lg:mt-0">
            {group.fields.map((field) => (
              <div key={`${field.order}-${field.label}`}>
                <dt className="font-body text-body-l font-medium text-negro">{field.label}</dt>
                <dd className="mt-xs max-w-[68ch] font-body text-body-l text-grafito">{field.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
