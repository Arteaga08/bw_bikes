"use client";

import { Input } from "./Input";

export interface ListToolbarProps {
  searchLabel: string;
  searchPlaceholder?: string;
  value: string;
  onChange: (next: string) => void;
  /** Result count ("2 badges"), announced politely so a search that narrows the list is heard, not just seen. Omit while loading/erroring. */
  count?: string;
}

/**
 * The search strip every catalog list view opens with, made sticky so it
 * survives scrolling past a long result list.
 */
export function ListToolbar({ searchLabel, searchPlaceholder, value, onChange, count }: ListToolbarProps) {
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
      </div>
      {count ? (
        <p aria-live="polite" className="mt-sm font-body text-caption text-grafito">
          {count}
        </p>
      ) : null}
    </div>
  );
}
