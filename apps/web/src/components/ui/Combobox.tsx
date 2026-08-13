"use client";

import { Check } from "@phosphor-icons/react";
import type { KeyboardEvent } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface ComboboxOption {
  id: string;
  label: string;
}

export interface ComboboxProps {
  id?: string;
  label: string;
  value: string;
  onChange: (id: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  error?: string;
  helper?: string;
  required?: boolean;
}

/**
 * A searchable single-select: types to filter a flat option list, using the
 * same keyboard/listbox pattern `CommandPalette` already proved (arrows,
 * Enter, Escape, `role="listbox"`/`role="option"`) instead of reinventing
 * one. Reach for this over `Select` only when the list benefits from
 * typeahead or from flattening a shallow tree — a two-level category tree
 * rendered as "Padre › Hijo" is the motivating case; `Select` stays the
 * default for a short, flat list like Marca.
 *
 * Doesn't reuse `Input` directly: the dropdown must anchor right below the
 * `<input>` box alone, not below the label+input+helper block `Input` renders
 * as one unit, so the positioning wrapper has to sit tighter than that.
 */
export function Combobox({ id, label, value, onChange, options, placeholder, error, helper, required }: ComboboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listboxId = `${inputId}-listbox`;
  const descriptionId = error ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined;
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.id === value) ?? null;

  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // The displayed text tracks the controlled `value` while the field isn't
  // being actively edited — e.g. the surrounding form resets or loads data.
  // Adjusted during render (React's documented pattern for deriving state
  // from a prop change) rather than in an effect, which would setState
  // synchronously after an extra render instead of before the first paint.
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (!open) setQuery(selected?.label ?? "");
  }

  const queryMatchesSelection = query === (selected?.label ?? "");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized || queryMatchesSelection) return options;
    return options.filter((option) => option.label.toLowerCase().includes(normalized));
  }, [query, options, queryMatchesSelection]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery(selected?.label ?? "");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selected]);

  function choose(option: ComboboxOption): void {
    onChange(option.id);
    setQuery(option.label);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option) choose(option);
    } else if (event.key === "Escape") {
      setOpen(false);
      setQuery(selected?.label ?? "");
    }
  }

  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor={inputId} className="font-ui text-ui text-negro">
        {label}
      </label>
      <div ref={containerRef} className="relative">
        <input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-describedby={descriptionId}
          aria-invalid={Boolean(error) || undefined}
          autoComplete="off"
          required={required}
          value={query}
          placeholder={placeholder}
          onFocus={() => {
            setOpen(true);
            setActiveIndex(0);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            "h-11 w-full rounded-control border bg-surface px-md font-body text-body-l text-negro sm:text-body",
            "transition-colors duration-150",
            "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro",
            error ? "border-estado-error" : "border-borde",
          )}
        />
        {open && filtered.length > 0 ? (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute top-full z-10 mt-xs max-h-64 w-full overflow-y-auto rounded-card border border-borde bg-surface p-xs"
          >
            {filtered.map((option, index) => (
              <li key={option.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.id === value}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                  className={cn(
                    "flex w-full items-center justify-between gap-sm rounded-control px-sm py-sm text-left font-body text-body text-negro",
                    "transition-colors duration-150",
                    index === activeIndex && "bg-base",
                  )}
                >
                  {option.label}
                  {option.id === value ? <Check aria-hidden="true" size={14} weight="bold" /> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {error ? (
        <p id={descriptionId} className="font-body text-caption text-estado-error">
          {error}
        </p>
      ) : helper ? (
        <p id={descriptionId} className="font-body text-caption text-grafito">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
