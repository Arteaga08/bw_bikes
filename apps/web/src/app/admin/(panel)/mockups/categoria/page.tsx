"use client";

import { Check, MagnifyingGlass } from "@phosphor-icons/react";
import type { KeyboardEvent, ReactNode } from "react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { MOCK_CATEGORY_TREE } from "../fixtures";

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="flex max-w-md flex-col gap-md rounded-card-lg border border-borde bg-surface p-lg">
      <div className="flex flex-col gap-xs">
        <h2 className="font-display text-h3 text-negro">{title}</h2>
        <p className="max-w-[65ch] font-body text-caption text-grafito">{note}</p>
      </div>
      {children}
    </section>
  );
}

interface FlatOption {
  id: string;
  label: string;
}

const FLAT_OPTIONS: FlatOption[] = MOCK_CATEGORY_TREE.flatMap((root) => [
  { id: root.id, label: root.name },
  ...root.children.map((child) => ({ id: child.id, label: `${root.name} › ${child.name}` })),
]);

/** A · Combobox con búsqueda — teclea y filtra; opciones planas "Padre › Hijo". Reutiliza el mismo patrón de teclado/listbox que ya existe en CommandPalette, no lo inventa. */
function ComboboxVariant() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selected, setSelected] = useState<FlatOption | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return FLAT_OPTIONS;
    return FLAT_OPTIONS.filter((option) => option.label.toLowerCase().includes(normalized));
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function choose(option: FlatOption): void {
    setSelected(option);
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
    }
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-xs">
      <Input
        id="mock-combobox"
        label="Categoría"
        role="combobox"
        aria-expanded={open}
        aria-controls="mock-combobox-listbox"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelected(null);
          setActiveIndex(0);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Busca una categoría"
      />
      {open && filtered.length > 0 ? (
        <ul
          id="mock-combobox-listbox"
          role="listbox"
          className="absolute top-full z-10 mt-xs max-h-64 w-full overflow-y-auto rounded-card border border-borde bg-surface p-xs"
        >
          {filtered.map((option, index) => (
            <li key={option.id}>
              <button
                type="button"
                role="option"
                aria-selected={selected?.id === option.id}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
                className={cn(
                  "flex w-full items-center justify-between gap-sm rounded-control px-sm py-sm text-left font-body text-body text-negro",
                  index === activeIndex ? "bg-base" : "",
                )}
              >
                {option.label}
                {selected?.id === option.id ? <Check aria-hidden="true" size={14} weight="bold" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** B · Dos selects encadenados — categoría padre → subcategoría. Cero código nuevo de interacción, cero scroll. */
function ChainedSelectsVariant() {
  const [parentId, setParentId] = useState("");
  const [childId, setChildId] = useState("");
  const parent = MOCK_CATEGORY_TREE.find((root) => root.id === parentId);

  return (
    <div className="flex flex-col gap-md">
      <Select
        label="Categoría"
        value={parentId}
        onChange={(event) => {
          setParentId(event.target.value);
          setChildId("");
        }}
      >
        <option value="">Selecciona una categoría</option>
        {MOCK_CATEGORY_TREE.map((root) => (
          <option key={root.id} value={root.id}>
            {root.name}
          </option>
        ))}
      </Select>
      <Select
        label="Subcategoría (opcional)"
        value={childId}
        disabled={!parent || parent.children.length === 0}
        onChange={(event) => setChildId(event.target.value)}
        helper={parent && parent.children.length === 0 ? "Esta categoría no tiene subcategorías." : undefined}
      >
        <option value="">Sin subcategoría</option>
        {parent?.children.map((child) => (
          <option key={child.id} value={child.id}>
            {child.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** C · Popover con grupos — botón que abre un panel con búsqueda y encabezado fijo por raíz. */
function PopoverVariant() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<FlatOption | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const normalized = query.trim().toLowerCase();
  const groups = MOCK_CATEGORY_TREE.map((root) => ({
    root,
    matchesRoot: root.name.toLowerCase().includes(normalized),
    children: root.children.filter((child) => child.name.toLowerCase().includes(normalized)),
  })).filter((group) => !normalized || group.matchesRoot || group.children.length > 0);

  function choose(option: FlatOption): void {
    setSelected(option);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-xs">
      <span className="font-ui text-ui text-negro">Categoría</span>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex h-11 items-center justify-between rounded-control border border-borde bg-surface px-md font-body text-body text-negro transition-colors duration-150 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro"
      >
        {selected ? selected.label : <span className="text-grafito">Selecciona una categoría</span>}
      </button>
      {open ? (
        <div className="absolute top-full z-10 mt-xs w-full rounded-card border border-borde bg-surface p-sm">
          <div className="relative mb-sm">
            <MagnifyingGlass aria-hidden="true" size={16} className="absolute left-sm top-1/2 -translate-y-1/2 text-grafito" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar"
              className="h-9 w-full rounded-control border border-borde bg-base pl-2xl pr-sm font-body text-body text-negro focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {groups.map((group) => (
              <Fragment key={group.root.id}>
                <button
                  type="button"
                  onClick={() => choose({ id: group.root.id, label: group.root.name })}
                  className="flex w-full items-center justify-between rounded-control px-sm py-xs text-left font-ui text-caption uppercase tracking-[1px] text-grafito hover:bg-base"
                >
                  {group.root.name}
                </button>
                {group.children.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => choose({ id: child.id, label: `${group.root.name} › ${child.name}` })}
                    className="flex w-full items-center justify-between rounded-control py-sm pl-lg pr-sm text-left font-body text-body text-negro hover:bg-base"
                  >
                    {child.name}
                  </button>
                ))}
              </Fragment>
            ))}
            {groups.length === 0 ? <p className="p-sm font-body text-caption text-grafito">Sin resultados.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function CategoriaMockupPage() {
  return (
    <>
      <PageHeader
        title="Selector de categoría"
        subtitle="Punto 1 — el árbol real tiene exactamente dos niveles (tope duro en el backend), así que ninguna variante necesita un widget de árbol de verdad."
      />
      <div className="grid grid-cols-1 gap-lg p-md sm:p-lg lg:grid-cols-3 lg:items-start">
        <Section title="A · Combobox con búsqueda" note="Se teclea y filtra; opciones planas 'Padre › Hijo'. Navegable con flechas y Enter.">
          <ComboboxVariant />
        </Section>
        <Section title="B · Dos selects encadenados" note="Categoría padre → subcategoría. Cero scroll, cero componente nuevo — son dos <Select> reales.">
          <ChainedSelectsVariant />
        </Section>
        <Section title="C · Popover con grupos" note="Lista agrupada por raíz con búsqueda arriba; la raíz misma es seleccionable, no solo etiqueta de grupo.">
          <PopoverVariant />
        </Section>
      </div>
    </>
  );
}
