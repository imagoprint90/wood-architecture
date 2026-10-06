"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface PickerOption {
  id: string;
  label: string;
  hint?: string;
}

// Porównywanie bez wielkości liter i polskich znaków: „zol” znajdzie „Żółkiewski”.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Rozwijana lista wielokrotnego wyboru z wyszukiwaniem. Wybrane pozycje trafiają do
// formularza jako ukryte pola o nazwie `name` (po jednym na pozycję).
export function MemberPicker({
  name,
  options,
  defaultSelected = [],
  placeholder = "Szukaj…",
  emptyLabel = "Nikogo nie wybrano.",
}: {
  name: string;
  options: PickerOption[];
  defaultSelected?: string[];
  placeholder?: string;
  emptyLabel?: string;
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const needle = normalize(query.trim());
  const filtered = needle
    ? options.filter((o) => normalize(`${o.label} ${o.hint ?? ""}`).includes(needle))
    : options;
  const selectedOptions = options.filter((o) => selected.includes(o.id));

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  return (
    <div ref={rootRef} className="relative">
      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

      <div className="relative">
        <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${name}-list`}
          aria-label={placeholder}
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            // Enter wybiera pierwszy wynik i nie wysyła całego formularza.
            if (event.key === "Enter") {
              event.preventDefault();
              if (open && filtered[0]) toggle(filtered[0].id);
            }
          }}
          className="h-11 w-full rounded-md border border-border bg-surface pr-9 pl-9 lg:h-9 text-base outline-none lg:text-[0.875rem] transition-colors placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? "Zwiń listę" : "Rozwiń listę"}
          onClick={() => setOpen((value) => !value)}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground"
        >
          <ChevronDown size={15} className={clsx("transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <ul
          id={`${name}-list`}
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-muted">Brak wyników.</li>
          ) : (
            filtered.map((option) => {
              const isSelected = selected.includes(option.id);
              return (
                <li key={option.id} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => toggle(option.id)}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-subtle"
                  >
                    <span
                      className={clsx(
                        "flex size-4 shrink-0 items-center justify-center rounded border",
                        isSelected ? "border-primary bg-primary text-on-primary" : "border-border"
                      )}
                    >
                      {isSelected && <Check size={12} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.hint && <span className="shrink-0 text-xs text-muted">{option.hint}</span>}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {selectedOptions.length === 0 ? (
          <p className="text-xs text-muted">{emptyLabel}</p>
        ) : (
          selectedOptions.map((option) => (
            <span
              key={option.id}
              className="inline-flex items-center gap-1 rounded-full bg-accent/15 py-0.5 pr-1 pl-2.5 text-xs font-medium text-primary"
            >
              {option.label}
              <button
                type="button"
                aria-label={`Usuń: ${option.label}`}
                onClick={() => toggle(option.id)}
                className="rounded-full p-0.5 hover:bg-foreground/10"
              >
                <X size={12} />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}
