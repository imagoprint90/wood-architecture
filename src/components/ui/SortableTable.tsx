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

// Tabela listy z kolumną „L.p.” i sortowaniem po kliknięciu nagłówka. Dane i gotowe komórki
// przygotowuje strona na serwerze; tutaj tylko kolejność wierszy.
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

  return (
    <div className="overflow-x-auto">
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
  );
}
