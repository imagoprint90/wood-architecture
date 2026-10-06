"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronDown, ChevronUp } from "lucide-react";
import { inputClass } from "@/components/ui/Form";

const MAX_HOURS = 24;
const STEP = 0.5;

function toNumber(text: string): number {
  return Number(text.replace(",", "."));
}

function toText(value: number): string {
  return String(value).replace(".", ",");
}

// Pole liczby godzin: przyjmuje wyłącznie cyfry i jeden przecinek, nie pozwala wpisać więcej
// niż 24, a strzałki (oraz klawisze ↑ ↓) zmieniają wartość co pół godziny.
export function HoursInput({
  id,
  name,
  defaultValue = "",
  required,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);

  function handleChange(raw: string) {
    // Kropka z klawiatury numerycznej staje się przecinkiem; wszystko poza cyframi znika.
    let next = raw.replace(/\./g, ",").replace(/[^\d,]/g, "");
    const comma = next.indexOf(",");
    if (comma !== -1) {
      // Jeden przecinek i najwyżej dwie cyfry po nim (dokładność do setnych godziny).
      next = next.slice(0, comma + 1) + next.slice(comma + 1).replace(/,/g, "").slice(0, 2);
    }
    // Wartość powyżej 24 po prostu się nie wpisuje — pole zostaje przy poprzedniej.
    if (toNumber(next) > MAX_HOURS) return;
    setValue(next);
  }

  function step(direction: 1 | -1) {
    const current = value === "" ? 0 : toNumber(value);
    // Z wartości „nierównej” (np. 7,2) pierwszy krok dociąga do najbliższej połówki.
    const snapped = direction === 1 ? Math.floor(current / STEP) * STEP : Math.ceil(current / STEP) * STEP;
    const next = Math.min(MAX_HOURS, Math.max(STEP, snapped + direction * STEP));
    setValue(toText(next));
  }

  const stepButtonClass =
    "flex flex-1 items-center justify-center px-1.5 text-muted transition-colors hover:bg-subtle hover:text-foreground";

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        required={required}
        placeholder="np. 8 lub 7,5"
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") {
            event.preventDefault();
            step(1);
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            step(-1);
          }
        }}
        className={clsx(inputClass, "pr-9 tabular-nums")}
      />
      <div className="absolute inset-y-px right-px flex w-7 flex-col overflow-hidden rounded-r-md border-l border-border">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Dodaj pół godziny"
          title="+0,5 h"
          onClick={() => step(1)}
          className={clsx(stepButtonClass, "border-b border-border")}
        >
          <ChevronUp size={12} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Odejmij pół godziny"
          title="−0,5 h"
          onClick={() => step(-1)}
          className={stepButtonClass}
        >
          <ChevronDown size={12} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
