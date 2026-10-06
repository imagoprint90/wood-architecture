"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";
import { inputClass } from "@/components/ui/Form";
import type { PickerOption } from "@/components/ui/MemberPicker";

// Porównywanie bez wielkości liter i polskich znaków: „sciany” znajdzie „ścian”.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Rozwijana lista pojedynczego wyboru z wyszukiwaniem. Wybrana pozycja trafia do formularza
// jako ukryte pole `name`; puste = nic nie wybrano (wymagalność sprawdza akcja serwera).
export function SearchSelect({
  id,
  name,
  options,
  defaultValue = "",
  placeholder = "Wybierz lub wpisz, aby wyszukać…",
}: {
  id: string;
  name: string;
  options: PickerOption[];
  defaultValue?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const needle = normalize(query.trim());
  const filtered = needle ? options.filter((o) => normalize(o.label).includes(needle)) : options;

  function close() {
    setOpen(false);
    setQuery("");
  }

  function choose(optionId: string) {
    setValue(optionId);
    close();
  }

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={value} />
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        autoComplete="off"
        // Zamknięta lista pokazuje wybraną pozycję; otwarta — to, co użytkownik wpisuje.
        value={open ? query : (selected?.label ?? "")}
        placeholder={selected?.label ?? placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          setHighlighted(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setHighlighted((i) => Math.min(i + 1, filtered.length - 1));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlighted((i) => Math.max(i - 1, 0));
          }
          // Enter wybiera podświetloną pozycję i nie wysyła całego formularza.
          if (event.key === "Enter" && open) {
            event.preventDefault();
            if (filtered[highlighted]) choose(filtered[highlighted].id);
          }
        }}
        className={clsx(inputClass, "pr-9")}
      />
      <ChevronDown
        size={15}
        className={clsx(
          "pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted transition-transform",
          open && "rotate-180"
        )}
      />

      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-muted">Brak wyników.</li>
          ) : (
            filtered.map((option, index) => (
              <li key={option.id} role="option" aria-selected={option.id === value}>
                <button
                  type="button"
                  onClick={() => choose(option.id)}
                  onMouseEnter={() => setHighlighted(index)}
                  className={clsx(
                    "flex w-full items-center gap-2 px-3 py-2 text-left lg:py-1.5",
                    index === highlighted && "bg-subtle"
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.id === value && <Check size={14} className="shrink-0 text-accent" />}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
