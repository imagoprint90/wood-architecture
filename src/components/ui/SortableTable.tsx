"use client";

import { useMemo, useState, type ReactNode } from "react";
import clsx from "clsx";
import { ArrowDown, ArrowUp } from "lucide-react";

export interface SortableColumn {
  label: string;
  align?: "left" | "right";
  // Klasy komórek tej kolumny (np. "font-medium").
  className?: string;
  // false = kolumna bez sortowania (np. „Akcje”).
  sortable?: boolean;
}

export interface SortableRow {
  key: string;
  // Gotowe komórki, po jednej na kolumnę.
  cells: ReactNode[];
  // Wartości do sortowania, po jednej na kolumnę; null = brak wartości (zawsze na końcu).
  sort: (string | number | null)[];
}

type SortValue = string | number | null;

function compare(a: SortValue, b: SortValue): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "pl", { numeric: true, sensitivity: "base" });
}

// Klasy kolumny bez tych, które w tabeli przycinają tekst — na karcie ma się zawijać.
function cardClass(className?: string): string | undefined {
  return className?.replace(/(^|\s)(max-w-\S+|truncate)(?=\s|$)/g, "").trim() || undefined;
}

// Lista z kolumną „L.p.” i sortowaniem. Na komputerze to tabela z klikalnymi nagłówkami;
// na telefonie każdy wiersz staje się kartą (etykieta → wartość), żeby nic nie wymagało
// przewijania w bok. Dane i gotowe komórki przygotowuje strona na serwerze.
export function SortableTable({ columns, rows }: { columns: SortableColumn[]; rows: SortableRow[] }) {
  // Bez wybranego sortowania wiersze idą w kolejności przygotowanej przez stronę.
  const [sort, setSort] = useState<{ column: number; ascending: boolean } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const { column, ascending } = sort;
    return [...rows].sort((a, b) => {
      const x = a.sort[column];
      const y = b.sort[column];
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
      return ascending ? compare(x, y) : compare(y, x);
    });
  }, [rows, sort]);

  function toggleSort(column: number) {
    setSort((current) =>
      current?.column === column ? { column, ascending: !current.ascending } : { column, ascending: true }
    );
  }

  const headClass =
    "border-b border-border bg-subtle text-xs font-semibold tracking-wider text-muted uppercase";
  const DirectionIcon = sort?.ascending === false ? ArrowDown : ArrowUp;

  return (
    <>
      {/* ===== Telefon: karty ===== */}
      <div className="sm:hidden">
        <div className="flex items-center gap-2 border-b border-border bg-subtle/60 px-4 py-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted">
            <span className="shrink-0">Sortuj:</span>
            <select
              value={sort?.column ?? ""}
              onChange={(event) =>
                setSort(
                  event.target.value === ""
                    ? null
                    : { column: Number(event.target.value), ascending: sort?.ascending ?? true }
                )
              }
              className="h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-sm text-foreground"
            >
              <option value="">domyślnie</option>
              {columns.map((column, index) =>
                column.sortable === false ? null : (
                  <option key={index} value={index}>
                    {column.label}
                  </option>
                )
              )}
            </select>
          </label>
          <button
            type="button"
            disabled={!sort}
            onClick={() => sort && toggleSort(sort.column)}
            aria-label={sort?.ascending === false ? "Kolejność malejąca" : "Kolejność rosnąca"}
            className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-foreground disabled:opacity-40"
          >
            <DirectionIcon size={14} />
          </button>
        </div>

        <ul>
          {sorted.map((row, position) => {
            const actions = row.cells.filter((_, index) => columns[index].sortable === false);
            return (
              <li key={row.key} className="border-b border-border px-4 py-3 last:border-b-0">
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1.5">
                  <dt className="text-xs text-muted">L.p.</dt>
                  <dd className="text-muted tabular-nums">{position + 1}</dd>
                  {row.cells.map((cell, index) => {
                    const column = columns[index];
                    if (column.sortable === false) return null;
                    return (
                      <div key={index} className="contents">
                        <dt className="text-xs text-muted">{column.label}</dt>
                        {/* Na karcie tekst może się zawijać — bez przycinania z widoku tabeli. */}
                        <dd className={clsx("min-w-0 break-words", cardClass(column.className))}>
                          {cell}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                {actions.length > 0 && <div className="mt-2 flex justify-end">{actions}</div>}
              </li>
            );
          })}
        </ul>
      </div>

      {/* ===== Tablet i komputer: tabela ===== */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full whitespace-nowrap">
          <thead>
            <tr>
              <th className={clsx(headClass, "w-0 py-2 pr-2 pl-5 text-right")}>L.p.</th>
              {columns.map((column, index) => {
                const active = sort?.column === index;
                const Icon = sort?.ascending ? ArrowUp : ArrowDown;
                const right = column.align === "right";
                return (
                  <th
                    key={index}
                    aria-sort={active ? (sort?.ascending ? "ascending" : "descending") : undefined}
                    className={clsx(headClass, "last:pr-2")}
                  >
                    {column.sortable === false ? (
                      <span className={clsx("block px-3 py-2", right ? "text-right" : "text-left")}>
                        {column.label}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleSort(index)}
                        title="Sortuj według tej kolumny"
                        className={clsx(
                          "flex w-full cursor-pointer items-center gap-1 px-3 py-2 uppercase transition-colors hover:text-foreground",
                          right ? "justify-end" : "justify-start",
                          active && "text-primary"
                        )}
                      >
                        {column.label}
                        {active ? (
                          <Icon size={11} strokeWidth={2.5} className="shrink-0" />
                        ) : (
                          <ArrowDown size={11} className="shrink-0 opacity-25" />
                        )}
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, position) => (
              <tr
                key={row.key}
                className="border-b border-border transition-colors last:border-b-0 hover:bg-subtle/70"
              >
                <td className="py-2.5 pr-2 pl-5 text-right align-middle text-muted tabular-nums">
                  {position + 1}
                </td>
                {row.cells.map((cell, index) => {
                  const column = columns[index];
                  return (
                    <td
                      key={index}
                      className={clsx(
                        "px-3 py-2.5 align-middle last:pr-5",
                        column.align === "right" && "text-right tabular-nums",
                        column.className
                      )}
                    >
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
