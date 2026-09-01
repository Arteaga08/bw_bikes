"use client";

import type { SpecGroup, SpecTemplate } from "@bw-bikes/shared";
import { CaretRight, DotsSixVertical, Eye, EyeSlash, Trash } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useEffect, useId, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import type { DragHandleProps } from "@/hooks/use-drag-reorder";
import { useDragReorder } from "@/hooks/use-drag-reorder";
import {
  MAX_SPEC_FIELDS_PER_GROUP,
  MAX_SPEC_GROUPS,
  addField,
  addGroup,
  applyTemplate,
  moveFieldTo,
  moveGroupTo,
  removeField,
  removeGroup,
  renameGroup,
  toggleFieldVisible,
  toggleGroupVisible,
  updateField,
  type SpecSheetError,
} from "@/lib/catalog/spec-groups";
import { cn } from "@/lib/cn";

export interface SpecSheetEditorProps {
  groups: SpecGroup[];
  onChange: (groups: SpecGroup[]) => void;
  /** Active saved shapes (M10.3) — feeds "Aplicar plantilla" and the title/label autocomplete. Managed from `/admin/catalogo/fichas-tecnicas`. */
  templates: SpecTemplate[];
  /**
   * The one row `ProductEditor`'s `validate()` flagged, if any (a value with
   * no etiqueta, or an apartado with no título). Opens that apartado and
   * marks the offending input — without this the admin has no way to tell
   * which of up to twenty collapsed apartados is the one blocking the save.
   */
  error?: SpecSheetError;
}

const TITLES_DATALIST_ID = "spec-template-titles";
const TEMPLATE_HELPER = "Autocompleta con tus plantillas guardadas.";

/**
 * Replaces the raw `<input type="checkbox">` M10.6 used for per-field
 * visibility — the one control in the editor that didn't go through a
 * primitive. `bare`/`icon` is DESIGN.md §5's own rule for "any control that
 * repeats down a row", which a field-visibility toggle is. `aria-pressed`
 * (not a checkbox role) because this is a button that performs an action,
 * not a form field of its own.
 */
function EyeToggleButton({ visible, onToggle, label }: { visible: boolean; onToggle: () => void; label: string }) {
  return (
    <Button variant="bare" size="icon" aria-label={label} aria-pressed={visible} onClick={onToggle} iconLeft={visible ? <Eye /> : <EyeSlash />} />
  );
}

/**
 * The drag handle for an apartado or an especificación row — spread
 * `useDragReorder`'s `getHandleProps(index)` onto it. `cursor-grab`/
 * `touch-none` match `fichas-tecnicas/SpecTemplateFormModal.tsx`'s handle
 * exactly: `touch-none` stops the browser's own scroll/pan gesture from
 * competing with the pointer drag on a phone. M10.6.1 replaces the old
 * up/down `ButtonGroup` pair with this single handle — pointer-based
 * (`useDragReorder`, not native HTML5 drag) so it also works on touch, with
 * the same Arrow-key fallback for keyboard users the old buttons gave.
 */
function DragHandle({ label, className, ...handleProps }: { label: string; className?: string } & DragHandleProps) {
  return <Button variant="bare" size="icon" aria-label={label} className={cn("cursor-grab touch-none", className)} iconLeft={<DotsSixVertical />} {...handleProps} />;
}

function DeleteButton({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return <Button variant="bare" size="icon" tone="danger-strong" aria-label={label} onClick={onClick} iconLeft={<Trash />} className={className} />;
}

/**
 * Vertically aligns an arbitrary control with a labeled `Input` beside it.
 * A bare `items-center` row can't do this on its own: it centers each
 * child's *whole wrapper*, and `Input`'s wrapper is taller (it stacks a
 * label above the box) than a plain control's, so their wrappers' centers
 * don't land on the input box's own center — the control reads as pinned
 * near the top instead of level with the field. Mirroring `Input`'s own
 * shape (an invisible label-height spacer, `gap-xs`, then an `h-11` band
 * matching the input's own height) makes both the same total height with
 * the same internal offset, so their centers coincide under any `items-*`
 * on the parent row.
 */
function AlignedWithInputLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-xs">
      <span aria-hidden="true" className="invisible font-ui text-ui">
        {" "}
      </span>
      <div className="flex h-11 items-center">{children}</div>
    </div>
  );
}

/** "Mostrar en la ficha pública" placed beside the "Título del apartado" input — see `AlignedWithInputLabel` for why it can't just sit in the row as a bare `Toggle`. */
function GroupVisibilityToggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <AlignedWithInputLabel>
      <Toggle label="Mostrar en la ficha pública" checked={checked} onChange={onChange} />
    </AlignedWithInputLabel>
  );
}

/** Fixed-width spacer matching the icon buttons either side of it, so the "Etiqueta"/"Valor" column header lines up with the row below without a shared grid template. */
function HeaderIconSpacer() {
  return <span aria-hidden="true" className="h-9 w-9 shrink-0" />;
}

/**
 * One apartado's especificación list — a labels-once table (a single
 * "Etiqueta"/"Valor" column header instead of repeating both labels, and the
 * old "El dato de este producto en particular." helper, on every row) whose
 * rows reorder by drag. Its own component, not inlined in the outer
 * `groups.map`, because it needs its own `useDragReorder` instance: the hook
 * has to run at a stable position in a component's own render, and each
 * apartado's field list has a different item count.
 *
 * Rows are `flex`, not a fixed `grid-cols-[...]` template: on a narrow phone
 * a rigid grid overflowed past the card and clipped the trailing delete
 * button. Flex lets the Etiqueta/Valor pair stack vertically below `sm` and
 * sit side by side above it, while the icon buttons stay fixed-size on every
 * width.
 */
function SpecFieldsList({
  groups,
  onChange,
  groupIndex,
  fieldLabels,
  fieldLabelsDatalistId,
  groupVisible,
  fieldError,
}: {
  groups: SpecGroup[];
  onChange: (groups: SpecGroup[]) => void;
  groupIndex: number;
  fieldLabels: string[];
  fieldLabelsDatalistId: string;
  groupVisible: boolean;
  /** The one field within *this* apartado `ProductEditor` flagged, if any — see `SpecSheetEditorProps.error`. */
  fieldError?: SpecSheetError;
}) {
  const group = groups[groupIndex];
  const fieldCount = group?.fields.length ?? 0;
  const { draggingIndex, dropTargetIndex, registerRow, getHandleProps } = useDragReorder({
    itemCount: fieldCount,
    onReorder: (from, to) => onChange(moveFieldTo(groups, groupIndex, from, to)),
  });

  if (!group) return null;
  const atFieldLimit = fieldCount >= MAX_SPEC_FIELDS_PER_GROUP;

  return (
    <div className={cn("flex flex-col gap-xs", !groupVisible && "opacity-60")}>
      {group.fields.length > 0 ? (
        <div className="hidden items-center gap-sm px-xs sm:flex">
          <HeaderIconSpacer />
          <HeaderIconSpacer />
          <div className="flex min-w-0 flex-1 gap-sm">
            <span className="min-w-0 flex-1 font-ui text-caption text-grafito sm:max-w-[16rem]">Etiqueta</span>
            <span className="min-w-0 flex-1 font-ui text-caption text-grafito">Valor</span>
          </div>
          <HeaderIconSpacer />
        </div>
      ) : (
        <p className="px-xs font-body text-caption text-grafito">Sin especificaciones todavía.</p>
      )}
      {group.fields.length > 1 ? <p className="px-xs font-body text-caption text-grafito">Arrastra para reordenar.</p> : null}

      {group.fields.map((field, fieldIndex) => {
        const fieldVisible = field.visible !== false;

        return (
          <div
            key={fieldIndex}
            ref={registerRow(fieldIndex)}
            className={cn(
              "flex items-center gap-sm rounded-control px-xs py-1 transition-colors duration-150 hover:bg-surface",
              draggingIndex === fieldIndex && "opacity-50",
              dropTargetIndex === fieldIndex && draggingIndex !== fieldIndex && "outline-2 outline-offset-2 outline-negro",
            )}
          >
            <DragHandle label={`Reordenar la especificación ${field.label || fieldIndex + 1}`} {...getHandleProps(fieldIndex)} />
            <EyeToggleButton
              visible={fieldVisible}
              onToggle={() => onChange(toggleFieldVisible(groups, groupIndex, fieldIndex))}
              label={`Mostrar la especificación ${field.label || fieldIndex + 1}`}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-xs sm:flex-row sm:gap-sm">
              <Input
                label="Etiqueta"
                labelHidden
                placeholder="p. ej. Peso"
                list={fieldLabels.length > 0 ? fieldLabelsDatalistId : undefined}
                value={field.label}
                onChange={(event) => onChange(updateField(groups, groupIndex, fieldIndex, { label: event.target.value }))}
                error={fieldError?.fieldIndex === fieldIndex ? fieldError.message : undefined}
                wrapperClassName="min-w-0 flex-1 sm:max-w-[16rem]"
              />
              <Input
                label="Valor"
                labelHidden
                placeholder="p. ej. 8.2 kg"
                value={field.value}
                onChange={(event) => onChange(updateField(groups, groupIndex, fieldIndex, { value: event.target.value }))}
                wrapperClassName="min-w-0 flex-1"
              />
            </div>
            <DeleteButton label="Eliminar especificación" onClick={() => onChange(removeField(groups, groupIndex, fieldIndex))} />
          </div>
        );
      })}

      <Button variant="ghost" disabled={atFieldLimit} onClick={() => onChange(addField(groups, groupIndex, "", ""))} className="self-start">
        Agregar especificación
      </Button>
    </div>
  );
}

/**
 * The free-form technical sheet editor: add/rename/reorder/delete for groups
 * and fields alike, all driven by the pure functions in
 * `lib/catalog/spec-groups.ts` — this component is a thin presentation layer
 * over them. Saving is `ProductEditor`'s job: on create the current `groups`
 * ride inside the product's own POST body, on edit its unified "Guardar
 * cambios" action does the product's PATCH and then this sheet's own `PUT`,
 * in that order — this component never calls the API itself.
 *
 * M10.3 layers memory on top without touching the free-form contract: a
 * "plantilla" only ever prefills a group's title and labels (never a value —
 * see `SpecTemplate`'s own doc comment), and `<datalist>` autocompletes what
 * the admin types either way. Nothing here stops an admin from typing a
 * brand-new title or label the templates have never seen.
 *
 * M10.6 adds the visibility toggles and renames the copy. The Spanish UI now
 * says **apartado** and **especificación** where it used to say "grupo" and
 * "campo": the panel already has screens called *Categorías* for the bike
 * taxonomy (Ruta › Endurance), so the words the admin had in mind for these
 * two levels were taken. The data names (`SpecGroup`, `fields`, `label`) are
 * untouched — logic stays in English, UI in Spanish.
 *
 * M10.6.1 replaces the original stacked layout (every apartado expanded at
 * once, up/down button pairs, both labels repeated on every row) with a
 * collapsible accordion: apartados collapse to a one-line bar and only one
 * opens at a time, so a product with many apartados (the real cap is 20)
 * doesn't turn into a page-long scroll before the first one is even read.
 * Reordering — apartados and especificaciones alike — is drag-only via
 * `useDragReorder`, the same pointer-based (works on touch) pattern
 * `fichas-tecnicas/SpecTemplateFormModal.tsx` already established, with its
 * Arrow-key fallback covering keyboard users.
 */
export function SpecSheetEditor({ groups, onChange, templates, error }: SpecSheetEditorProps) {
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(groups.length > 0 ? 0 : null);
  const panelIdBase = useId();

  // A fresh `error` always wins over whatever apartado the admin last had
  // open — it's the one `ProductEditor` just refused to save.
  useEffect(() => {
    if (error) setOpenIndex(error.groupIndex);
  }, [error]);

  const { draggingIndex, dropTargetIndex, registerRow, getHandleProps } = useDragReorder({
    itemCount: groups.length,
    onReorder: (from, to) => onChange(moveGroupTo(groups, from, to)),
  });

  function handleAddGroup(): void {
    const title = newGroupTitle.trim();
    if (!title || groups.length >= MAX_SPEC_GROUPS) return;
    onChange(addGroup(groups, title));
    setNewGroupTitle("");
    setOpenIndex(groups.length);
  }

  function handleApplyTemplate(): void {
    const template = templates.find((candidate) => candidate.id === selectedTemplateId);
    if (!template) return;
    onChange(applyTemplate(groups, template));
    setSelectedTemplateId("");
    setOpenIndex(groups.length);
  }

  /** The template whose title matches this group's, if any — drives both the field datalist and the "suggested by" note. */
  function templateFor(groupTitle: string): SpecTemplate | undefined {
    const normalized = groupTitle.trim().toLowerCase();
    if (!normalized) return undefined;
    return templates.find((candidate) => candidate.title.trim().toLowerCase() === normalized);
  }

  return (
    <div className="flex flex-col gap-md">
      <datalist id={TITLES_DATALIST_ID}>
        {templates.map((template) => (
          <option key={template.id} value={template.title} />
        ))}
      </datalist>

      {templates.length > 0 ? (
        <div className="flex flex-wrap items-end gap-sm">
          <Select
            label="Aplicar plantilla"
            value={selectedTemplateId}
            onChange={(event) => setSelectedTemplateId(event.target.value)}
            wrapperClassName="min-w-[16rem] flex-1"
          >
            <option value="">Selecciona una plantilla</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.title} ({template.fields.length} campos)
              </option>
            ))}
          </Select>
          <Button variant="secondary" disabled={!selectedTemplateId || groups.length >= MAX_SPEC_GROUPS} onClick={handleApplyTemplate}>
            Agregar apartado desde plantilla
          </Button>
        </div>
      ) : null}

      {groups.length === 0 ? <p className="font-body text-caption text-grafito">Sin apartados todavía.</p> : null}
      {groups.length > 1 ? <p className="font-body text-caption text-grafito">Arrastra un apartado para reordenarlo.</p> : null}

      {groups.map((group, groupIndex) => {
        const fieldLabelsDatalistId = `spec-template-fields-${groupIndex}`;
        const template = templateFor(group.title);
        const fieldLabels = template?.fields.map((field) => field.label) ?? [];
        // `!== false`, not a plain negation: a sheet saved before M10.6 carries
        // no flag at all and has to read as visible.
        const groupVisible = group.visible !== false;
        const isOpen = openIndex === groupIndex;
        const panelId = `${panelIdBase}-panel-${groupIndex}`;
        const groupError = error?.groupIndex === groupIndex ? error : undefined;

        return (
          // `bg-inset`, not `bg-base`: this panel lives inside an
          // `EditorSection` card (`bg-surface`), and `base` is the page's own
          // ground — painting it here made the panel read as a hole in the
          // card and left borderless controls with no body of their own.
          <div
            key={groupIndex}
            ref={registerRow(groupIndex)}
            className={cn(
              "flex flex-col rounded-card border border-borde bg-inset transition-opacity duration-150",
              draggingIndex === groupIndex && "opacity-50",
              dropTargetIndex === groupIndex && draggingIndex !== groupIndex && "outline-2 outline-offset-2 outline-negro",
            )}
          >
            {fieldLabels.length > 0 ? (
              <datalist id={fieldLabelsDatalistId}>
                {fieldLabels.map((label) => (
                  <option key={label} value={label} />
                ))}
              </datalist>
            ) : null}

            <div className="flex items-center gap-sm p-md">
              <DragHandle label={`Reordenar el apartado ${group.title || groupIndex + 1}`} className="shrink-0" {...getHandleProps(groupIndex)} />
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : groupIndex)}
                className="flex min-w-0 flex-1 items-center gap-sm rounded-control text-left transition-colors duration-150 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro"
              >
                <CaretRight aria-hidden="true" weight="bold" className={cn("h-4 w-4 shrink-0 text-grafito transition-transform duration-150", isOpen && "rotate-90")} />
                <span className="min-w-0 flex-1 truncate font-ui text-ui text-negro">{group.title || "Apartado sin título"}</span>
                <span className="shrink-0 font-ui text-caption text-grafito">
                  {group.fields.length} especificaci{group.fields.length === 1 ? "ón" : "ones"}
                </span>
                {!groupVisible ? <Badge variant="neutral" className="shrink-0">Oculto</Badge> : null}
              </button>
              <DeleteButton label="Eliminar apartado" onClick={() => onChange(removeGroup(groups, groupIndex))} className="shrink-0" />
            </div>

            {isOpen ? (
              <div id={panelId} className="flex flex-col gap-md border-t border-borde p-md">
                <div className="flex flex-wrap items-center gap-md">
                  <Input
                    label="Título del apartado"
                    list={TITLES_DATALIST_ID}
                    value={group.title}
                    onChange={(event) => onChange(renameGroup(groups, groupIndex, event.target.value))}
                    error={groupError && groupError.fieldIndex === undefined ? groupError.message : undefined}
                    wrapperClassName="min-w-[14rem] flex-1"
                  />
                  <GroupVisibilityToggle checked={groupVisible} onChange={() => onChange(toggleGroupVisible(groups, groupIndex))} />
                </div>

                {template ? (
                  <p className="font-body text-caption text-grafito">
                    Etiquetas sugeridas por la plantilla «{template.title}».
                  </p>
                ) : null}

                <SpecFieldsList
                  groups={groups}
                  onChange={onChange}
                  groupIndex={groupIndex}
                  fieldLabels={fieldLabels}
                  fieldLabelsDatalistId={fieldLabelsDatalistId}
                  groupVisible={groupVisible}
                  fieldError={groupError}
                />
              </div>
            ) : null}
          </div>
        );
      })}

      <div className="flex flex-wrap items-end gap-sm">
        <Input
          label="Nuevo apartado"
          placeholder="p. ej. Transmisión"
          list={TITLES_DATALIST_ID}
          helper={templates.length > 0 ? TEMPLATE_HELPER : undefined}
          value={newGroupTitle}
          onChange={(event) => setNewGroupTitle(event.target.value)}
          wrapperClassName="min-w-[16rem] flex-1"
        />
        <Button variant="secondary" disabled={!newGroupTitle.trim() || groups.length >= MAX_SPEC_GROUPS} onClick={handleAddGroup}>
          Agregar apartado
        </Button>
      </div>
    </div>
  );
}
