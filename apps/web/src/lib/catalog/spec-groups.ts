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
  return normalizeOrder([...groups, { title, order: groups.length, fields: [] }]);
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
    return { ...group, fields: normalizeOrder([...group.fields, { label, value, order: group.fields.length }]) };
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
    .map((field, index) => ({ label: field.label, value: "", order: index }));
  return normalizeOrder([...groups, { title: template.title, order: groups.length, fields }]);
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
