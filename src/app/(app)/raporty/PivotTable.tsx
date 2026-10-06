"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import clsx from "clsx";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { EntryDetail, Pivot, PivotColumn, PivotRow, ReportParams } from "@/lib/reports";

function formatValue(value: number, kind: ReportParams["value"]): string {
  return value.toLocaleString("pl-PL", { maximumFractionDigits: kind === "koszt" ? 0 : 2 });
}

// Kwota w złotych z groszami, bez symbolu waluty (jest w nagłówku kolumny).
function formatMoney(amount: number): string {
  return amount.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatHours(hours: number): string {
  return `${hours.toLocaleString("pl-PL", { maximumFractionDigits: 2 })} h`;
}

const TONE_HEAD = { saturday: "bg-accent/35", holiday: "bg-danger/25" };
const TONE_CELL = { saturday: "bg-accent/20", holiday: "bg-danger/15" };

// Ile wpisów mieści dymek; reszta jest podsumowana jednym wierszem.
const TOOLTIP_LIMIT = 6;

// Po czym sortowane są wiersze: nazwa, suma, kolumny ciągłości albo konkretna kolumna (indeks).
type SortKey = "label" | "hours" | "cost" | "reported" | "missing" | number;
interface Sort {
  key: SortKey;
  ascending: boolean;
}

// Komórka, nad którą jest kursor (albo którą dotknięto), z jej położeniem na ekranie.
interface Hovered {
  rowKey: string;
  column: number;
  rect: { left: number; right: number; top: number; bottom: number };
}

function sortValue(row: PivotRow, key: Exclude<SortKey, "label">): number {
  if (key === "hours") return row.totalHours;
  if (key === "cost") return row.totalCost;
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
  const [hovered, setHovered] = useState<Hovered | null>(null);

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

  // Dymek jest przypięty do miejsca na ekranie, więc przy przewijaniu strony lub tabeli
  // znika — inaczej zostałby nad inną komórką.
  useEffect(() => {
    if (!hovered) return;
    const close = () => setHovered(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    // Stuknięcie lub kliknięcie gdziekolwiek chowa dymek; jeśli trafiło w komórkę z wpisami,
    // jej własne kliknięcie zaraz pokaże go ponownie.
    window.addEventListener("pointerdown", close, true);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("pointerdown", close, true);
    };
  }, [hovered]);

  // Pierwsze kliknięcie: nazwy A→Z, liczby od największej; kolejne odwraca kierunek.
  function toggleSort(key: SortKey) {
    setSort((current) =>
      current?.key === key ? { key, ascending: !current.ascending } : { key, ascending: key === "label" }
    );
  }

  function showDetails(element: HTMLElement, rowKey: string, column: number) {
    const { left, right, top, bottom } = element.getBoundingClientRect();
    setHovered({ rowKey, column, rect: { left, right, top, bottom } });
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

  const hoveredRow = hovered ? pivot.rows.find((row) => row.key === hovered.rowKey) : undefined;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 whitespace-nowrap">
        <thead>
          <tr>
            <th className={clsx(headBase, "w-0 py-2 pr-2 pl-5 text-right")}>L.p.</th>
            <th aria-sort={ariaSort("label")} className={clsx(headBase, stickyFirst)}>
              {sortButton("label", "left", "px-3", rowLabel)}
            </th>
            {pivot.columns.map((column, i) => (
              <th
                key={column.key}
                title={column.title}
                aria-sort={ariaSort(i)}
                className={clsx(headBase, narrow && "min-w-8", column.tone && TONE_HEAD[column.tone])}
              >
                {sortButton(
                  i,
                  narrow ? "center" : "right",
                  narrow ? "px-1" : "px-3",
                  <>
                    {column.sublabel && (
                      <span className="block text-[0.6875rem] font-medium opacity-80">{column.sublabel}</span>
                    )}
                    {column.label}
                  </>
                )}
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
            <th aria-sort={ariaSort("hours")} className={clsx(headBase, "border-l border-border")}>
              {sortButton("hours", "right", "px-3", "Suma godzin")}
            </th>
            <th
              aria-sort={ariaSort("cost")}
              title="Godziny × stawka godzinowa zapamiętana przy każdym wpisie"
              className={headBase}
            >
              {sortButton("cost", "right", "pr-5 pl-3", "Suma PLN")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, position) => {
            const rowPending = row.pending.some(Boolean);
            return (
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
                  const hasEntries = row.entries[i].length > 0;
                  const missing = row.missing?.[i];
                  const active = hovered?.rowKey === row.key && hovered.column === i;
                  return (
                    <td
                      key={column.key}
                      // Komórki z wpisami pokazują dymek ze szczegółami: po najechaniu myszą,
                      // a na ekranie dotykowym po stuknięciu.
                      tabIndex={hasEntries ? 0 : undefined}
                      title={!hasEntries ? (missing ? "Dzień roboczy bez raportu" : column.title) : undefined}
                      onMouseEnter={
                        hasEntries ? (event) => showDetails(event.currentTarget, row.key, i) : undefined
                      }
                      onMouseLeave={hasEntries ? () => setHovered(null) : undefined}
                      onFocus={hasEntries ? (event) => showDetails(event.currentTarget, row.key, i) : undefined}
                      onBlur={hasEntries ? () => setHovered(null) : undefined}
                      // Na ekranie dotykowym stuknięcie pokazuje dymek; chowa go stuknięcie
                      // gdzie indziej (komórka traci fokus) albo przewinięcie.
                      onClick={hasEntries ? (event) => showDetails(event.currentTarget, row.key, i) : undefined}
                      className={clsx(
                        "border-b border-border py-2 outline-none group-hover:bg-subtle/70",
                        narrow ? "px-1 text-center tabular-nums" : numeric,
                        column.tone && TONE_CELL[column.tone],
                        hasEntries && "cursor-default",
                        // Niezatwierdzone godziny — ten sam pomarańcz co status „Zgłoszony”.
                        row.pending[i] && "bg-warning/14 font-semibold text-warning",
                        // Brak raportu w dniu roboczym — czerwona ramka, żeby nie mylić z powyższym.
                        missing && "font-semibold text-danger ring-1 ring-danger/60 ring-inset",
                        !hasEntries && !missing && "text-muted/40",
                        active && "ring-2 ring-accent ring-inset"
                      )}
                    >
                      {missing ? "!" : hasEntries ? formatValue(value, params.value) : "–"}
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
                        row.missingDays ? "font-semibold text-danger" : "text-muted/40"
                      )}
                    >
                      {row.missingDays}
                    </td>
                  </>
                )}
                <td
                  title={rowPending ? "Suma zawiera godziny czekające na zatwierdzenie" : undefined}
                  className={clsx(
                    "border-b border-l border-border px-3 py-2 text-right font-semibold tabular-nums",
                    rowPending && "text-warning"
                  )}
                >
                  {formatValue(row.totalHours, "godziny")}
                </td>
                <td
                  title={
                    row.missingRate
                      ? "Część godzin nie ma stawki godzinowej i jest policzona jako 0 zł. Ustaw stawkę w zakładce Użytkownicy."
                      : undefined
                  }
                  className={clsx(
                    "border-b border-border py-2 pr-5 pl-3 text-right font-semibold tabular-nums",
                    row.totalCost === 0 && "font-normal text-muted/40"
                  )}
                >
                  {row.missingRate && row.totalCost === 0 ? (
                    <span className="font-normal text-muted">brak stawki</span>
                  ) : (
                    <>
                      {formatMoney(row.totalCost)}
                      {row.missingRate && <span className="text-muted">*</span>}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
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
                {value === 0 ? "–" : formatValue(value, params.value)}
              </td>
            ))}
            {params.continuity && <td colSpan={2} className="border-l border-border bg-subtle" />}
            <td className="border-l border-border bg-subtle px-3 py-2.5 text-right tabular-nums">
              {formatValue(pivot.grandHours, "godziny")} h
            </td>
            <td className="bg-subtle py-2.5 pr-5 pl-3 text-right tabular-nums">{formatMoney(pivot.grandCost)} zł</td>
          </tr>
        </tfoot>
      </table>

      {hovered && hoveredRow && (
        <CellTooltip
          rect={hovered.rect}
          title={`${hoveredRow.label} · ${columnTitle(pivot.columns[hovered.column], params)}`}
          entries={hoveredRow.entries[hovered.column].map((index) => pivot.details[index])}
          params={params}
        />
      )}
    </div>
  );
}

// Pełna nazwa kolumny do nagłówka dymka: dzień jako data, tydzień z zakresem dat.
function columnTitle(column: PivotColumn, params: ReportParams): string {
  if (params.colDim === "dzien") {
    const [year, month, day] = column.key.split("-");
    return `${day}.${month}.${year}${column.title ? ` (${column.title})` : ""}`;
  }
  if (params.colDim === "miesiac") return column.title ?? column.label;
  return column.sublabel ? `${column.label} (${column.sublabel})` : column.label;
}

function CellTooltip({
  rect,
  title,
  entries,
  params,
}: {
  rect: Hovered["rect"];
  title: string;
  entries: EntryDetail[];
  params: ReportParams;
}) {
  // W każdym wpisie pokazujemy tylko to, czego nie mówi już wiersz i kolumna tabeli:
  // np. w układzie „pracownicy × dni” — budowę i etap, w „budowy × etapy” — pracownika i datę.
  const dims: string[] = [params.rowDim, params.colDim];
  const showEmployee = !dims.includes("pracownik");
  const showProject = !dims.includes("budowa");
  const showStage = !dims.includes("rodzaj");
  const showDate = !dims.includes("dzien");

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const pendingHours = entries.reduce((sum, e) => sum + (e.approved ? 0 : e.hours), 0);
  const totalCost = entries.reduce((sum, e) => sum + e.cost, 0);
  const visible = entries.slice(0, TOOLTIP_LIMIT);

  // Dymek pod komórką, a w dolnej części ekranu — nad nią; w poziomie nie wychodzi poza okno.
  const width = Math.min(352, window.innerWidth - 16);
  const left = Math.min(Math.max(8, (rect.left + rect.right) / 2 - width / 2), window.innerWidth - width - 8);
  const above = rect.top > window.innerHeight * 0.55;
  const vertical = above ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 };

  return (
    <div
      role="tooltip"
      style={{ left, width, ...vertical }}
      className="pointer-events-none fixed z-50 rounded-lg border border-border bg-surface text-left whitespace-normal shadow-xl"
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-3 py-2">
        <span className="min-w-0 truncate font-semibold">{title}</span>
        <span className="shrink-0 font-semibold tabular-nums">{formatHours(totalHours)}</span>
      </div>

      <ul className="divide-y divide-border">
        {visible.map((entry, index) => {
          const context = [
            showDate ? entry.date : null,
            showEmployee ? entry.employee : null,
            showProject ? entry.project : null,
            showStage ? entry.stage : null,
          ].filter(Boolean);
          return (
            <li key={index} className="px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 font-medium">{context.join(" · ") || "Wpis"}</span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold">{formatHours(entry.hours)}</span>
                  {params.value === "koszt" && (
                    <span className="ml-1.5 text-muted">{formatValue(entry.cost, "koszt")} zł</span>
                  )}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                <span
                  className={clsx(
                    "rounded-full px-1.5 py-px font-medium",
                    entry.approved ? "bg-success/12 text-success" : "bg-warning/14 text-warning"
                  )}
                >
                  {entry.approved ? "Zatwierdzony" : "Zgłoszony"}
                </span>
                <span>Dodał(a): {entry.createdLabel}</span>
              </div>
              {entry.editedLabel && (
                <p className="mt-0.5 text-xs text-warning">Zmodyfikowany: {entry.editedLabel}</p>
              )}
              {entry.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{entry.description}</p>}
            </li>
          );
        })}
      </ul>

      {(entries.length > visible.length || pendingHours > 0 || params.value === "koszt") && (
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 border-t border-border bg-subtle px-3 py-1.5 text-xs text-muted">
          {entries.length > visible.length && <span>+ jeszcze {entries.length - visible.length} wpisów</span>}
          {pendingHours > 0 && (
            <span className="font-medium text-warning">Do zatwierdzenia: {formatHours(pendingHours)}</span>
          )}
          {params.value === "koszt" && <span>Koszt: {formatValue(totalCost, "koszt")} zł</span>}
        </div>
      )}
    </div>
  );
}
