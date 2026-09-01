import type { SpecGroup } from "@bw-bikes/shared";

/**
 * Drops everything the storefront must not render: a group the admin turned
 * off, a row it turned off, and a row left blank (a template applied but never
 * filled in). Groups emptied by that filter are dropped too — an apartado with
 * no rows would render as a bare heading.
 *
 * Shared between `bike.service.ts` and `accessory.service.ts` — both embed
 * the same free-form `specGroups` (`spec-group.schema.ts`) and both owe the
 * storefront the same guarantee. It used to live only in `bike.service.ts`,
 * which meant `toPublicAccessory` shipped hidden groups, hidden rows and
 * blank values straight to the PDP; moved here once that asymmetry surfaced
 * so a fix to one product kind can't drift from the other again.
 *
 * Done here rather than in the storefront for the same reason `toPublicBike`
 * filters `variants` to `isActive`: shipping a value the UI is expected not
 * to paint is a leak, not a convenience. The admin DTOs (`toAdminBike`,
 * `toAdminAccessory`) keep every row, unfiltered — the editor has to be able
 * to turn them back on.
 */
export function toPublicSpecGroups(groups: SpecGroup[]): SpecGroup[] {
  return [...groups]
    .filter((group) => group.visible !== false)
    .sort((a, b) => a.order - b.order)
    .map((group) => ({
      // Rebuilt field by field rather than spread: these arrive as Mongoose
      // subdocuments, and `{...subdoc}` copies its internals (`$__`, `_doc`)
      // instead of the data.
      title: group.title,
      order: group.order,
      visible: group.visible,
      fields: [...group.fields]
        .filter((field) => field.visible !== false && field.value.trim() !== "")
        .sort((a, b) => a.order - b.order)
        .map((field) => ({ label: field.label, value: field.value, order: field.order, visible: field.visible })),
    }))
    .filter((group) => group.fields.length > 0);
}
