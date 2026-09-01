import type { SpecField, SpecGroup, SpecTemplate } from "@bw-bikes/shared";

/**
 * Mirror `apps/api/src/models/schemas/spec-group.schema.ts` — redeclared
 * because `apps/web` never imports `apps/api` source (same reasoning as
 * `BULK_ALLOWED_STATUSES` in `lib/orders/status.ts`). Used to show remaining
 * counts and block the "add" buttons before the server has to reject a 400.
 */
export const MAX_SPEC_GROUPS = 20;
export const MAX_SPEC_FIELDS_PER_GROUP = 30;
export const MAX_SPEC_TITLE_LENGTH = 80;
export const MAX_SPEC_LABEL_LENGTH = 80;
export const MAX_SPEC_VALUE_LENGTH = 400;

/**
 * Reindexes `order` to a dense `0..n-1` sequence, in current array order.
 * Every mutator below ends with this — it's what keeps `order` honest after
 * an add, a delete in the middle, or a reorder, without the caller having to
 * remember to do it.
 */
export function normalizeOrder<T extends { order: number }>(items: T[]): T[] {
  return items.map((item, index) => ({ ...item, order: index }));
}

/**
 * The eight pure operations the free-form spec sheet editor needs — add,
 * rename, reorder and delete, for groups and for fields alike. Kept as plain
 * functions over `SpecGroup[]`, not component state directly, so the four
 * required operations are testable without mounting a form
 * (docs/superpowers/specs/…-design.md §"Ficha técnica libre"). The component
 * sends the whole array back in one `PUT /spec-groups` on save — the same
 * atomic-replace contract the backend expects.
 */
export function addGroup(groups: SpecGroup[], title: string): SpecGroup[] {
  return normalizeOrder([...groups, { title, order: groups.length, visible: true, fields: [] }]);
}

export function renameGroup(groups: SpecGroup[], groupIndex: number, title: string): SpecGroup[] {
  return groups.map((group, index) => (index === groupIndex ? { ...group, title } : group));
}

export function removeGroup(groups: SpecGroup[], groupIndex: number): SpecGroup[] {
  return normalizeOrder(groups.filter((_, index) => index !== groupIndex));
}

export function moveGroup(groups: SpecGroup[], groupIndex: number, direction: -1 | 1): SpecGroup[] {
  const target = groupIndex + direction;
  if (target < 0 || target >= groups.length) return groups;

  const next = [...groups];
  const [moved] = next.splice(groupIndex, 1);
  next.splice(target, 0, moved as SpecGroup);
  return normalizeOrder(next);
}

export function addField(groups: SpecGroup[], groupIndex: number, label: string, value: string): SpecGroup[] {
  return groups.map((group, index) => {
    if (index !== groupIndex) return group;
    return {
      ...group,
      fields: normalizeOrder([...group.fields, { label, value, order: group.fields.length, visible: true }]),
    };
  });
}

/**
 * Turning an apartado or an especificación off, rather than deleting it
 * (M10.6). A saved template is a superset — "Eléctrica" carries every row an
 * e-bike could need — so a non-electric bike has to be able to drop those rows
 * from the storefront while keeping the shape for the next product. The API
 * stores the flag; `toPublicBike` is what actually withholds it from the PDP.
 *
 * `visible !== false` rather than a plain negation: a group loaded from a
 * document written before the flag existed carries no value at all, and must
 * read as visible.
 */
export function toggleGroupVisible(groups: SpecGroup[], groupIndex: number): SpecGroup[] {
  return groups.map((group, index) => (index === groupIndex ? { ...group, visible: group.visible === false } : group));
}

export function toggleFieldVisible(groups: SpecGroup[], groupIndex: number, fieldIndex: number): SpecGroup[] {
  return groups.map((group, index) => {
    if (index !== groupIndex) return group;
    return {
      ...group,
      fields: group.fields.map((field, fi) => (fi === fieldIndex ? { ...field, visible: field.visible === false } : field)),
    };
  });
}

export function updateField(
  groups: SpecGroup[],
  groupIndex: number,
  fieldIndex: number,
  patch: Partial<Pick<SpecField, "label" | "value">>,
): SpecGroup[] {
  return groups.map((group, index) => {
    if (index !== groupIndex) return group;
    return {
      ...group,
      fields: group.fields.map((field, fi) => (fi === fieldIndex ? { ...field, ...patch } : field)),
    };
  });
}

export function removeField(groups: SpecGroup[], groupIndex: number, fieldIndex: number): SpecGroup[] {
  return groups.map((group, index) => {
    if (index !== groupIndex) return group;
    return { ...group, fields: normalizeOrder(group.fields.filter((_, fi) => fi !== fieldIndex)) };
  });
}

/**
 * Prefills a new group from a saved `SpecTemplate` (M10.3) — its title and
 * every label, each with an empty value for the admin to fill in. A
 * template carries no values by definition (`spec-template.model.ts`), so
 * this is the only field `addField` couldn't already give us for free.
 */
export function applyTemplate(groups: SpecGroup[], template: SpecTemplate): SpecGroup[] {
  if (groups.length >= MAX_SPEC_GROUPS) return groups;
  const fields = template.fields
    .slice(0, MAX_SPEC_FIELDS_PER_GROUP)
    .map((field, index) => ({ label: field.label, value: "", order: index, visible: true }));
  return normalizeOrder([...groups, { title: template.title, order: groups.length, visible: true, fields }]);
}

export function moveField(groups: SpecGroup[], groupIndex: number, fieldIndex: number, direction: -1 | 1): SpecGroup[] {
  return groups.map((group, index) => {
    if (index !== groupIndex) return group;

    const target = fieldIndex + direction;
    if (target < 0 || target >= group.fields.length) return group;

    const nextFields = [...group.fields];
    const [moved] = nextFields.splice(fieldIndex, 1);
    nextFields.splice(target, 0, moved as SpecField);
    return { ...group, fields: normalizeOrder(nextFields) };
  });
}

/**
 * Arbitrary-target counterpart to `moveGroup`'s ±1 step — what a drag release
 * needs (`useDragReorder`'s `onReorder(from, to)`, see `hooks/use-drag-reorder.ts`),
 * since a pointer can land several rows away in one gesture, not just on a
 * neighbor. `to` is clamped rather than rejected, matching the drag hook's own
 * contract of always handing back an in-range target.
 */
export function moveGroupTo(groups: SpecGroup[], from: number, to: number): SpecGroup[] {
  const clampedTo = Math.min(Math.max(to, 0), groups.length - 1);
  if (from === clampedTo) return groups;

  const next = [...groups];
  const [moved] = next.splice(from, 1);
  next.splice(clampedTo, 0, moved as SpecGroup);
  return normalizeOrder(next);
}

/** Arbitrary-target counterpart to `moveField`'s ±1 step, same reasoning as `moveGroupTo`. */
export function moveFieldTo(groups: SpecGroup[], groupIndex: number, from: number, to: number): SpecGroup[] {
  return groups.map((group, index) => {
    if (index !== groupIndex) return group;

    const clampedTo = Math.min(Math.max(to, 0), group.fields.length - 1);
    if (from === clampedTo) return group;

    const nextFields = [...group.fields];
    const [moved] = nextFields.splice(from, 1);
    nextFields.splice(clampedTo, 0, moved as SpecField);
    return { ...group, fields: normalizeOrder(nextFields) };
  });
}

/**
 * Una fila sin etiqueta *ni* valor no lleva ningún dato: es la fila que
 * "Agregar especificación" acaba de crear y que el admin todavía no llenó
 * (`addField(groups, groupIndex, "", "")`). El backend exige `label` no
 * vacío (`spec-group.validator.ts`), así que enviarla tal cual tumba el
 * guardado completo de la ficha con un mensaje que no dice ni el apartado ni
 * la fila responsable. Se llama antes de las dos rutas de guardado en
 * `ProductEditor` (el `specGroups` del POST de creación y el `PUT
 * /spec-groups` de edición) — nunca dentro de los mutadores de arriba, que
 * deben poder crear una fila vacía sin que desaparezca en cuanto se agrega.
 */
export function pruneEmptyFields(groups: SpecGroup[]): SpecGroup[] {
  return groups.map((group) => ({
    ...group,
    fields: normalizeOrder(group.fields.filter((field) => field.label.trim() !== "" || field.value.trim() !== "")),
  }));
}

export interface SpecSheetError {
  groupIndex: number;
  fieldIndex?: number;
  message: string;
}

/**
 * Errores reales del admin que sí deben bloquear el guardado, a diferencia de
 * la fila 100% vacía que `pruneEmptyFields` descarta en silencio: un apartado
 * sin título, o una fila con `value` lleno pero `label` vacío (a medio
 * escribir, no simplemente sin tocar). Nombra el apartado en el mensaje —
 * `SpecSheetEditor` solo tiene un apartado abierto a la vez, así que sin esto
 * el admin no tiene forma de saber cuál de los veinte le está fallando.
 */
export function findSpecSheetError(groups: SpecGroup[]): SpecSheetError | undefined {
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex]!;
    if (group.title.trim() === "") {
      return { groupIndex, message: "El apartado no tiene título." };
    }
    for (let fieldIndex = 0; fieldIndex < group.fields.length; fieldIndex += 1) {
      const field = group.fields[fieldIndex]!;
      if (field.label.trim() === "" && field.value.trim() !== "") {
        return {
          groupIndex,
          fieldIndex,
          message: `El apartado «${group.title}» tiene una especificación con valor pero sin etiqueta.`,
        };
      }
    }
  }
  return undefined;
}
