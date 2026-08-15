"use client";

import { Plus } from "@phosphor-icons/react";
import { Button } from "./Button";
import { Input } from "./Input";

export interface ListToolbarProps {
  searchLabel: string;
  searchPlaceholder?: string;
  value: string;
  onChange: (next: string) => void;
  /** Icon-only mirror of the view's primary action, shown only below `sm` — the `PageHeader` button takes over from `sm` up, so the two never both render. */
  action?: { label: string; onClick: () => void };
  /** Result count ("2 badges"), announced politely so a search that narrows the list is heard, not just seen. Omit while loading/erroring. */
  count?: string;
}

/**
 * The search strip every catalog list view opens with, made sticky (so it
 * survives scrolling past a long result list) and, below `sm`, paired with an
 * icon-only mirror of the view's "Nuevo …" button — on a phone that action
 * used to live only in `PageHeader`, above the fold-worthy content this bar
 * now sits right on top of.
 */
export function ListToolbar({ searchLabel, searchPlaceholder, value, onChange, action, count }: ListToolbarProps) {
  return (
    <div className="sticky top-0 z-10 border-b border-borde bg-base px-md py-md sm:px-lg">
      <div className="flex items-end gap-sm">
        <Input
          label={searchLabel}
          placeholder={searchPlaceholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          wrapperClassName="flex-1 sm:max-w-[18rem]"
        />
        {action ? (
          <Button variant="primary" size="icon-lg" aria-label={action.label} className="sm:hidden" onClick={action.onClick}>
            <Plus aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      {count ? (
        <p aria-live="polite" className="mt-sm font-body text-caption text-grafito">
          {count}
        </p>
      ) : null}
    </div>
  );
}
