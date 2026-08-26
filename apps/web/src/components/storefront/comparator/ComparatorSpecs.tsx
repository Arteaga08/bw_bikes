import type { ComparisonGroup } from "./comparator-rows";

export interface ComparatorSpecsProps {
  groups: ComparisonGroup[];
  /** Only ever read by screen readers — sighted users get the pairing from the columns above. */
  leftName: string;
  rightName: string;
}

/** Lo que se pinta cuando una de las dos bicis no declara ese dato. */
const MISSING = "—";

/**
 * The aligned spec sheet: the label on its own line, the two values side by
 * side underneath it. One layout at every width — comparing *is* seeing both
 * values at once, so the columns never stack, they only get narrower.
 *
 * Deliberately not a `<table>`. The design puts the label above its two
 * values rather than beside them, which a table can only do by overriding
 * `display` on its rows and cells — and that strips the table semantics in
 * several screen readers unless every role is re-declared by hand. A plain
 * grid with the bike's name attached to each value, visible only to assistive
 * tech, reads correctly ("Grupo, Tarmac SL7: Ultegra Di2, Allez Sport:
 * Claris") without pretending to be a structure it isn't.
 */
export function ComparatorSpecs({ groups, leftName, rightName }: ComparatorSpecsProps) {
  if (groups.length === 0) {
    return (
      <p className="mt-xl font-body text-body text-grafito">
        Estas bicicletas todavía no tienen ficha técnica publicada para comparar.
      </p>
    );
  }

  return (
    <div className="mt-xl flex flex-col gap-xl">
      {groups.map((group) => (
        <section key={group.title}>
          <h3 className="font-ui text-eyebrow uppercase text-grafito">{group.title}</h3>

          <dl className="mt-md flex flex-col">
            {group.rows.map((row) => (
              <div key={row.label} className="border-t border-borde py-md">
                <dt className="font-body text-caption uppercase text-grafito">{row.label}</dt>
                <div className="mt-xs grid grid-cols-2 gap-md">
                  <dd className="font-body text-body text-negro">
                    <span className="sr-only">{leftName}: </span>
                    {row.left ?? MISSING}
                  </dd>
                  <dd className="font-body text-body text-negro">
                    <span className="sr-only">{rightName}: </span>
                    {row.right ?? MISSING}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
