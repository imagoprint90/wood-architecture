"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import clsx from "clsx";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

const CHANGE_EVENT = "collapsible-filters-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readOpen(storageKey: string): boolean {
  try {
    return localStorage.getItem(storageKey) === "1";
  } catch {
    // Brak dostępu do localStorage (np. tryb prywatny) — panel po prostu zaczyna zwinięty.
    return false;
  }
}

// Zwijany panel filtrów. To, czy jest rozwinięty, zapamiętuje przeglądarka (localStorage),
// więc stan przetrwa przeładowanie strony i kolejne wizyty.
export function CollapsibleFilters({
  storageKey,
  activeCount,
  clearHref,
  children,
}: {
  storageKey: string;
  // Ile filtrów jest ustawionych inaczej niż domyślnie — widać to także przy zwiniętym panelu.
  activeCount: number;
  clearHref: string;
  children: ReactNode;
}) {
  const open = useSyncExternalStore(
    subscribe,
    () => readOpen(storageKey),
    () => false
  );

  function toggle() {
    try {
      localStorage.setItem(storageKey, open ? "0" : "1");
    } catch {
      // Bez localStorage nie ma czego zapamiętać.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-3 px-4 py-2 sm:px-5">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex flex-1 items-center gap-2 py-1 text-left font-medium text-muted transition-colors hover:text-foreground"
        >
          <SlidersHorizontal size={14} />
          Filtry
          {activeCount > 0 && (
            <span className="rounded-full bg-accent/20 px-1.5 text-xs font-semibold text-primary">
              {activeCount}
            </span>
          )}
          <ChevronDown size={14} className={clsx("transition-transform", open && "rotate-180")} />
        </button>
        {activeCount > 0 && (
          <a href={clearHref} className="text-xs text-primary underline-offset-2 hover:underline">
            Wyczyść filtry
          </a>
        )}
      </div>
      {/* Zwinięty panel zostaje w dokumencie (ukryty), więc pola nie tracą wpisanych wartości. */}
      <div hidden={!open} className="border-t border-border bg-subtle/60">
        {children}
      </div>
    </div>
  );
}
