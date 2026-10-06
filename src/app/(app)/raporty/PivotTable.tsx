"use client";

import { useMemo, useState, type ReactNode } from "react";
import clsx from "clsx";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { Pivot, PivotRow, ReportParams } from "@/lib/reports";

// Komórka bez żadnego wpisu pokazuje myślnik zamiast zera — wtedy od razu widać, gdzie są dane.
function formatCell(value: number, kind: ReportParams["value"]): string {
  return value === 0 ? "–" : formatValue(value, kind);
}

function formatValue(value: number, kind: ReportParams["value"]): string {
  return value.toLocaleString("pl-PL", { maximumFractionDigits: kind === "koszt" ? 0 : 2 });
}

const TONE_HEAD = { saturday: "bg-accent/35", holiday: "bg-danger/25" };
const TONE_CELL = { saturday: "bg-accent/20", holiday: "bg-danger/15" };

// Po czym sortowane są wiersze: nazwa, suma, kolumny ciągłości albo konkretna kolumna (indeks).
type SortKey = "label" | "total" | "reported" | "missing" | number;
interface Sort {
  key: SortKey;
  ascending: boolean;
}

function sortValue(row: PivotRow, key: Exclude<SortKey, "label">): number {
  if (key === "total") return row.total;
  if (key === "reported") return row.reportedDays ?? 0;
  if (key === "missing") return row.missingDays ?? 0;
  return row.values[key];
}

export function PivotTable({
  pivot,
  params,
  rowLabel,
}: {
  pivot: Pivot;
  params: ReportParams;
  rowLabel: string;
}) {
  // Bez wybranego sortowania wiersze idą w kolejności z serwera (alfabetycznie, a etapy prac
  // w kolejności ustawionej przez administratora).
  const [sort, setSort] = useState<Sort | null>(null);

  const rows = useMemo(() => {
    if (!sort) return pivot.rows;
    const { key, ascending } = sort;
    const sorted = [...pivot.rows].sort((a, b) => {
      const byLabel = a.label.localeCompare(b.label, "pl");
      if (key === "label") return byLabel;
      // Przy równych wartościach kolejność alfabetyczna, niezależnie od kierunku.
      return sortValue(a, key) - sortValue(b, key) || (ascending ? byLabel : -byLabel);
    });
    return ascending ? sorted : sorted.reverse();
  }, [pivot.rows, sort]);

  // Pierwsze kliknięcie: nazwy A→Z, liczby od największej; kolejne odwraca kierunek.
  function toggleSort(key: SortKey) {
    setSort((current) =>
      current?.key === key ? { key, ascending: !current.ascending } : { key, ascending: key === "label" }
    );
  }

  // Dni miesiąca to ~31 wąskich kolumn; pozostałe wymiary mają mało kolumn, za to długie nazwy.
  const narrow = params.colDim === "dzien";
  const headBase =
    "border-b border-border bg-subtle text-xs font-semibold tracking-wider text-muted uppercase";
  const stickyFirst = "sticky left-0 z-[1] border-r border-border text-left";
  const numeric = clsx("text-right tabular-nums", narrow ? "px-1" : "px-3");

  // Zwykła funkcja pomocnicza (nie komponent) — korzysta ze stanu sortowania tej tabeli.
  function sortButton(
    sortKey: SortKey,
    align: "left" | "center" | "right",
    className: string,
    children: ReactNode
  ) {
    const active = sort?.key === sortKey;
    const Icon = sort?.ascending ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => toggleSort(sortKey)}
        title="Sortuj według tej kolumny"
        className={clsx(
          "flex w-full cursor-pointer items-center gap-1 py-2 uppercase transition-colors hover:text-foreground",
          align === "left" && "justify-start",
          align === "center" && "flex-col justify-center gap-0",
          align === "right" && "justify-end",
          active && "text-primary",
          className
        )}
      >
        <span>{children}</span>
        {/* W wąskich kolumnach dni strzałka pojawia się tylko w aktywnej, żeby nie poszerzać tabeli. */}
        {active ? (
          <Icon size={11} strokeWidth={2.5} className="shrink-0" />
        ) : (
          align !== "center" && <ArrowDown size={11} className="shrink-0 opacity-25" />
        )}
      </button>
    );
  }

  function ariaSort(key: SortKey) {
    if (sort?.key !== key) return undefined;
    return sort.ascending ? "ascending" : "descending";
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 whitespace-nowrap">
        <thead>
          <tr>
            <th className={clsx(headBase, "w-0 py-2 pr-2 pl-5 text-right")}>L.p.</th>
            <th aria-sort={ariaSort("label")} className={clsx(headBase, stickyFirst)}>
              {sortButton("label", "left", "px-3", <>{rowLabel}</>)}
            </th>
            {pivot.columns.map((column, i) => (
              <th
                key={column.key}
                title={column.title}
                aria-sort={ariaSort(i)}
                className={clsx(headBase, narrow && "min-w-8", column.tone && TONE_HEAD[column.tone])}
              >
                {sortButton(i, narrow ? "center" : "right", narrow ? "px-1" : "px-3", <>{column.sublabel && (
                    <span className="block text-[0.6875rem] font-medium opacity-80">{column.sublabel}</span>
                  )}
                  {column.label}</>)}
              </th>
            ))}
            {params.continuity && (
              <>
                <th aria-sort={ariaSort("reported")} className={clsx(headBase, "border-l border-border")}>
                  {sortButton("reported", "right", "px-3", "Dni z raportem")}
                </th>
                <th aria-sort={ariaSort("missing")} className={headBase}>
                  {sortButton("missing", "right", "px-3", "Braki")}
                </th>
              </>
            )}
            <th aria-sort={ariaSort("total")} className={clsx(headBase, "border-l border-border")}>
              {sortButton("total", "right", "pr-5 pl-3", "Suma")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, position) => (
            <tr key={row.key} className="group">
              <td className="border-b border-border py-2 pr-2 pl-5 text-right text-muted tabular-nums group-hover:bg-subtle/70">
                {position + 1}
              </td>
              <td
                className={clsx(
                  stickyFirst,
                  "border-b border-border bg-surface px-3 py-2 font-medium group-hover:bg-subtle"
                )}
              >
                {row.label}
              </td>
              {row.values.map((value, i) => {
                const column = pivot.columns[i];
                const missing = row.missing?.[i];
                return (
                  <td
                    key={column.key}
                    title={missing ? "Dzień roboczy bez raportu" : column.title}
                    className={clsx(
                      "border-b border-border py-2 group-hover:bg-subtle/70",
                      narrow ? "px-1 text-center tabular-nums" : numeric,
                      column.tone && TONE_CELL[column.tone],
                      missing && "bg-warning/25 text-warning",
                      value === 0 && !missing && "text-muted/40"
                    )}
                  >
                    {formatCell(value, params.value)}
                  </td>
                );
              })}
              {params.continuity && (
                <>
                  <td className="border-b border-l border-border px-3 py-2 text-right tabular-nums">
                    {row.reportedDays}
                  </td>
                  <td
                    className={clsx(
                      "border-b border-border px-3 py-2 text-right tabular-nums",
                      row.missingDays ? "font-semibold text-warning" : "text-muted/40"
                    )}
                  >
                    {row.missingDays}
                  </td>
                </>
              )}
              <td className="border-b border-l border-border py-2 pr-5 pl-3 text-right font-semibold tabular-nums">
                {formatValue(row.total, params.value)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="bg-subtle" />
            <td className={clsx(stickyFirst, "bg-subtle px-3 py-2.5")}>Razem</td>
            {pivot.columnTotals.map((value, i) => (
              <td
                key={pivot.columns[i].key}
                className={clsx(
                  "bg-subtle py-2.5",
                  narrow ? "px-1 text-center tabular-nums" : numeric,
                  value === 0 && "text-muted/40"
                )}
              >
                {formatCell(value, params.value)}
              </td>
            ))}
            {params.continuity && <td colSpan={2} className="border-l border-border bg-subtle" />}
            <td className="border-l border-border bg-subtle py-2.5 pr-5 pl-3 text-right tabular-nums">
              {formatValue(pivot.grandTotal, params.value)}
              {params.value === "koszt" ? " zł" : " h"}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
