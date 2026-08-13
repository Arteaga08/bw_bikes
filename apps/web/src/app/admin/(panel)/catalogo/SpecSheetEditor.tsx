"use client";

import type { SpecGroup, SpecTemplate } from "@bw-bikes/shared";
import { CaretDown, CaretUp, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  MAX_SPEC_FIELDS_PER_GROUP,
  MAX_SPEC_GROUPS,
  addField,
  addGroup,
  applyTemplate,
  moveField,
  moveGroup,
  removeField,
  removeGroup,
  renameGroup,
  updateField,
} from "@/lib/catalog/spec-groups";

export interface SpecSheetEditorProps {
  groups: SpecGroup[];
  onChange: (groups: SpecGroup[]) => void;
  /** Active saved shapes (M10.3) — feeds "Aplicar plantilla" and the title/label autocomplete. Managed from `/admin/catalogo/fichas-tecnicas`. */
  templates: SpecTemplate[];
}

const TITLES_DATALIST_ID = "spec-template-titles";
const TEMPLATE_HELPER = "Autocompleta con tus plantillas guardadas.";

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
 */
export function SpecSheetEditor({ groups, onChange, templates }: SpecSheetEditorProps) {
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  function handleAddGroup(): void {
    const title = newGroupTitle.trim();
    if (!title || groups.length >= MAX_SPEC_GROUPS) return;
    onChange(addGroup(groups, title));
    setNewGroupTitle("");
  }

  function handleApplyTemplate(): void {
    const template = templates.find((candidate) => candidate.id === selectedTemplateId);
    if (!template) return;
    onChange(applyTemplate(groups, template));
    setSelectedTemplateId("");
  }

  /** The template whose title matches this group's, if any — drives both the field datalist and the "suggested by" note. */
  function templateFor(groupTitle: string): SpecTemplate | undefined {
    const normalized = groupTitle.trim().toLowerCase();
    if (!normalized) return undefined;
    return templates.find((candidate) => candidate.title.trim().toLowerCase() === normalized);
  }

  return (
    <div className="flex flex-col gap-lg">
      <datalist id={TITLES_DATALIST_ID}>
        {templates.map((template) => (
          <option key={template.id} value={template.title} />
        ))}
      </datalist>

      {templates.length > 0 ? (
        <div className="flex items-end gap-sm">
          <Select
            label="Aplicar plantilla"
            value={selectedTemplateId}
            onChange={(event) => setSelectedTemplateId(event.target.value)}
            wrapperClassName="flex-1"
          >
            <option value="">Selecciona una plantilla</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.title} ({template.fields.length} campos)
              </option>
            ))}
          </Select>
          <Button variant="secondary" disabled={!selectedTemplateId || groups.length >= MAX_SPEC_GROUPS} onClick={handleApplyTemplate}>
            Agregar grupo desde plantilla
          </Button>
        </div>
      ) : null}

      {groups.length === 0 ? <p className="font-body text-caption text-grafito">Sin grupos todavía.</p> : null}

      {groups.map((group, groupIndex) => {
        const fieldLabelsDatalistId = `spec-template-fields-${groupIndex}`;
        const template = templateFor(group.title);
        const fieldLabels = template?.fields.map((field) => field.label) ?? [];

        return (
          <div key={groupIndex} className="flex flex-col gap-sm rounded-control border border-borde bg-base p-md">
            {fieldLabels.length > 0 ? (
              <datalist id={fieldLabelsDatalistId}>
                {fieldLabels.map((label) => (
                  <option key={label} value={label} />
                ))}
              </datalist>
            ) : null}

            <div className="flex items-end gap-sm">
              <Input
                label="Título del grupo"
                list={TITLES_DATALIST_ID}
                helper={templates.length > 0 ? TEMPLATE_HELPER : undefined}
                value={group.title}
                onChange={(event) => onChange(renameGroup(groups, groupIndex, event.target.value))}
                wrapperClassName="flex-1"
              />
              <span className="shrink-0 pb-xs font-ui text-caption text-grafito">
                {group.fields.length}/{MAX_SPEC_FIELDS_PER_GROUP} campos
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Subir grupo"
                disabled={groupIndex === 0}
                onClick={() => onChange(moveGroup(groups, groupIndex, -1))}
              >
                <CaretUp aria-hidden="true" size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Bajar grupo"
                disabled={groupIndex === groups.length - 1}
                onClick={() => onChange(moveGroup(groups, groupIndex, 1))}
              >
                <CaretDown aria-hidden="true" size={16} />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Eliminar grupo" onClick={() => onChange(removeGroup(groups, groupIndex))}>
                <Trash aria-hidden="true" size={16} />
              </Button>
            </div>

            {template ? (
              <p className="font-body text-caption text-grafito">
                Etiquetas sugeridas por la plantilla «{template.title}».
              </p>
            ) : null}

            <div className="flex flex-col gap-sm pl-lg">
              {group.fields.map((field, fieldIndex) => (
                <div key={fieldIndex} className="flex items-end gap-sm">
                  <Input
                    label="Etiqueta"
                    placeholder="p. ej. Peso"
                    list={fieldLabels.length > 0 ? fieldLabelsDatalistId : undefined}
                    value={field.label}
                    onChange={(event) => onChange(updateField(groups, groupIndex, fieldIndex, { label: event.target.value }))}
                  />
                  <Input
                    label="Valor"
                    placeholder="p. ej. 8.2 kg"
                    helper="El dato de este producto en particular."
                    value={field.value}
                    onChange={(event) => onChange(updateField(groups, groupIndex, fieldIndex, { value: event.target.value }))}
                    wrapperClassName="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Subir campo"
                    disabled={fieldIndex === 0}
                    onClick={() => onChange(moveField(groups, groupIndex, fieldIndex, -1))}
                  >
                    <CaretUp aria-hidden="true" size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Bajar campo"
                    disabled={fieldIndex === group.fields.length - 1}
                    onClick={() => onChange(moveField(groups, groupIndex, fieldIndex, 1))}
                  >
                    <CaretDown aria-hidden="true" size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Eliminar" onClick={() => onChange(removeField(groups, groupIndex, fieldIndex))}>
                    <Trash aria-hidden="true" size={16} />
                  </Button>
                </div>
              ))}
              <Button
                variant="ghost"
                disabled={group.fields.length >= MAX_SPEC_FIELDS_PER_GROUP}
                onClick={() => onChange(addField(groups, groupIndex, "", ""))}
                className="self-start"
              >
                Agregar campo
              </Button>
            </div>
          </div>
        );
      })}

      <div className="flex items-end gap-sm">
        <Input
          label="Nuevo grupo"
          placeholder="p. ej. Transmisión"
          list={TITLES_DATALIST_ID}
          helper={templates.length > 0 ? TEMPLATE_HELPER : undefined}
          value={newGroupTitle}
          onChange={(event) => setNewGroupTitle(event.target.value)}
          wrapperClassName="flex-1"
        />
        <Button variant="secondary" disabled={!newGroupTitle.trim() || groups.length >= MAX_SPEC_GROUPS} onClick={handleAddGroup}>
          Agregar grupo
        </Button>
      </div>
    </div>
  );
}
