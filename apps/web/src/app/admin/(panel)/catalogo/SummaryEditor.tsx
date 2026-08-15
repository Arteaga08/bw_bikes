"use client";

import type { SummaryRow } from "@bw-bikes/shared";
import { CaretDown, CaretUp, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { ButtonGroup } from "@/components/ui/ButtonGroup";
import { Input } from "@/components/ui/Input";
import { MAX_SUMMARY_ROWS, addRow, moveRow, removeRow, updateRow } from "@/lib/catalog/summary";

export interface SummaryEditorProps {
  rows: SummaryRow[];
  onChange: (rows: SummaryRow[]) => void;
}

/**
 * The "En pocas palabras" card — the short overview block the PDP shows next
 * to the marketing copy, above the full sheet. Sibling of `SpecSheetEditor`:
 * fully controlled, driven by the pure functions in `lib/catalog/summary.ts`,
 * and it never calls the API itself.
 *
 * Where it differs from the sheet: these rows ride in the bike's own POST/PATCH
 * body rather than a `PUT` of their own (six bounded rows don't justify a
 * second write), and there is no visibility toggle — a summary row is written
 * on purpose, so removing it is the way to hide it.
 *
 * The client chose a hand-written block over flagging rows of the sheet, which
 * buys freedom of wording ("Transmisión: SRAM XX SL Eagle" as one row where
 * the sheet lists shifters and cassette separately) at the cost of capturing a
 * shared value twice.
 */
export function SummaryEditor({ rows, onChange }: SummaryEditorProps) {
  return (
    <div className="flex flex-col gap-md">
      {rows.length === 0 ? (
        <p className="font-body text-caption text-grafito">
          Sin renglones todavía. Lo esencial de la bici: uso, cuadro, transmisión, peso.
        </p>
      ) : null}

      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex items-end gap-sm">
          <Input
            label="Etiqueta"
            placeholder="p. ej. Uso"
            value={row.label}
            onChange={(event) => onChange(updateRow(rows, rowIndex, { label: event.target.value }))}
          />
          <Input
            label="Valor"
            placeholder="p. ej. Carreras XC"
            value={row.value}
            onChange={(event) => onChange(updateRow(rows, rowIndex, { value: event.target.value }))}
            wrapperClassName="flex-1"
          />
          <ButtonGroup label="Reordenar renglón" className="shrink-0">
            <Button
              variant="bare"
              size="icon"
              aria-label="Subir renglón"
              disabled={rowIndex === 0}
              onClick={() => onChange(moveRow(rows, rowIndex, -1))}
              iconLeft={<CaretUp />}
            />
            <Button
              variant="bare"
              size="icon"
              aria-label="Bajar renglón"
              disabled={rowIndex === rows.length - 1}
              onClick={() => onChange(moveRow(rows, rowIndex, 1))}
              iconLeft={<CaretDown />}
            />
          </ButtonGroup>
          <Button
            variant="bare"
            size="icon"
            tone="danger-strong"
            aria-label="Eliminar renglón"
            onClick={() => onChange(removeRow(rows, rowIndex))}
            iconLeft={<Trash />}
            className="shrink-0"
          />
        </div>
      ))}

      <Button
        variant="ghost"
        disabled={rows.length >= MAX_SUMMARY_ROWS}
        onClick={() => onChange(addRow(rows, "", ""))}
        className="self-start"
      >
        Agregar renglón
      </Button>
    </div>
  );
}
