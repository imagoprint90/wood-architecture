import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { inputClass } from "@/components/ui/Form";
import { requireAdmin } from "@/lib/auth";
import { formatHours, formatMoney } from "@/lib/format";
import {
  COL_DIMS,
  ROW_DIMS,
  STATUS_FILTERS,
  VALUE_KINDS,
  loadReport,
  monthLabel,
  parseReportParams,
  reportQuery,
  shiftMonth,
  type ColDim,
  type RowDim,
} from "@/lib/reports";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PivotTable } from "./PivotTable";

// Gotowe układy tabeli; własny układ ustawia się polami „Wiersze” i „Kolumny”.
const PRESETS: { label: string; hint: string; rowDim?: RowDim; colDim?: ColDim; continuity?: boolean }[] = [
  { label: "Karta miesięczna", hint: "Pracownicy i dni miesiąca", rowDim: "pracownik", colDim: "dzien" },
  { label: "Ciągłość raportów", hint: "Wszystkie budowy naraz, z brakami", continuity: true },
  { label: "Budowy dziennie", hint: "Budowy i dni miesiąca", rowDim: "budowa", colDim: "dzien" },
  { label: "Pracownicy × budowy", hint: "Kto ile na której budowie", rowDim: "pracownik", colDim: "budowa" },
  { label: "Rodzaje prac × budowy", hint: "Na co schodzi czas", rowDim: "rodzaj", colDim: "budowa" },
  { label: "Tygodniami", hint: "Pracownicy i tygodnie", rowDim: "pracownik", colDim: "tydzien" },
];

const filterLabelClass = "flex flex-col gap-1 text-[11px] font-medium text-muted";


export default async function RaportyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = parseReportParams(await searchParams);
  const supabase = await createSupabaseServerClient();
  const report = await loadReport(supabase, params);
  const { pivot, totals } = report;

  return (
    <>
      <PageHeader
        title="Raporty"
        description="Godziny i koszty robocizny w wybranym miesiącu — w układzie, który wybierzesz."
        actions={
          <>
            <div className="flex items-center rounded-md border border-border bg-surface shadow-xs">
              <Link
                href={`/raporty?${reportQuery(params, { month: shiftMonth(params.month, -1) })}`}
                title="Poprzedni miesiąc"
                aria-label="Poprzedni miesiąc"
                className="rounded-l-md p-2 text-muted hover:bg-subtle hover:text-foreground"
              >
                <ChevronLeft size={16} />
              </Link>
              <span className="min-w-36 border-x border-border px-3 text-center font-medium">
                {monthLabel(params.month)}
              </span>
              <Link
                href={`/raporty?${reportQuery(params, { month: shiftMonth(params.month, 1) })}`}
                title="Następny miesiąc"
                aria-label="Następny miesiąc"
                className="rounded-r-md p-2 text-muted hover:bg-subtle hover:text-foreground"
              >
                <ChevronRight size={16} />
              </Link>
            </div>
            <a href={`/raporty/eksport?${reportQuery(params)}`} className={buttonClass("secondary")}>
              <Download size={15} />
              Eksport CSV
            </a>
          </>
        }
      />

      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Godziny razem" value={formatHours(totals.hours)} />
          <StatTile label="W tym zatwierdzone" value={formatHours(totals.approvedHours)} />
          <StatTile
            label="Koszt robocizny"
            value={formatMoney(totals.cost)}
            hint={report.missingRate ? "Część wpisów bez stawki — liczone jako 0 zł." : undefined}
          />
          <StatTile label="Liczba wpisów" value={String(totals.entries)} />
        </div>

        <Card flush>
          <div className="flex gap-1 overflow-x-auto border-b border-border px-3 pt-2 [scrollbar-width:none]">
            {PRESETS.map((preset) => {
              const active = preset.continuity
                ? params.continuity
                : !params.continuity && params.rowDim === preset.rowDim && params.colDim === preset.colDim;
              return (
                <Link
                  key={preset.label}
                  href={`/raporty?${reportQuery(params, {
                    continuity: Boolean(preset.continuity),
                    rowDim: preset.rowDim ?? "pracownik",
                    colDim: preset.colDim ?? "dzien",
                  })}`}
                  title={preset.hint}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "shrink-0 border-b-2 px-3 py-2 font-medium transition-colors",
                    active
                      ? "border-accent text-primary"
                      : "border-transparent text-muted hover:text-foreground"
                  )}
                >
                  {preset.label}
                </Link>
              );
            })}
          </div>

          <form
            method="get"
            className="grid grid-cols-2 gap-3 border-b border-border bg-subtle/60 px-5 py-3 sm:grid-cols-4 xl:grid-cols-8"
          >
            <input type="hidden" name="miesiac" value={params.month} />
            {params.continuity ? (
              <input type="hidden" name="ciaglosc" value="1" />
            ) : (
              <>
                <label className={filterLabelClass}>
                  Wiersze
                  <Select name="wiersze" value={params.rowDim} options={ROW_DIMS} />
                </label>
                <label className={filterLabelClass}>
                  Kolumny
                  <Select name="kolumny" value={params.colDim} options={COL_DIMS} />
                </label>
                <label className={filterLabelClass}>
                  Budowa
                  <select name="budowa" defaultValue={params.projectId} className={inputClass}>
                    <option value="">Wszystkie</option>
                    {report.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={filterLabelClass}>
                  Rodzaj prac
                  <select name="rodzaj" defaultValue={params.categoryId} className={inputClass}>
                    <option value="">Wszystkie</option>
                    {report.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <label className={filterLabelClass}>
              Pracownik
              <select name="pracownik" defaultValue={params.employeeId} className={inputClass}>
                <option value="">Wszyscy</option>
                {report.employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {`${e.last_name} ${e.first_name}`.trim()}
                  </option>
                ))}
              </select>
            </label>
            <label className={filterLabelClass}>
              Status wpisów
              <Select name="status" value={params.status} options={STATUS_FILTERS} />
            </label>
            <label className={filterLabelClass}>
              Wartość
              <Select name="wartosc" value={params.value} options={VALUE_KINDS} />
            </label>
            <div className="flex items-end">
              <Button type="submit" variant="secondary" className="w-full">
                Pokaż
              </Button>
            </div>
          </form>

          {params.continuity && (
            <p className="border-b border-border px-5 py-2.5 text-xs text-muted">
              Suma godzin każdego pracownika ze wszystkich budów.{" "}
              <span className="rounded bg-warning/25 px-1.5 py-0.5 font-medium text-warning">Brak</span>{" "}
              oznacza dzień roboczy (pon.–pt., bez świąt, do dziś) bez żadnego wpisu.
            </p>
          )}

          {pivot.rows.length === 0 ? (
            <EmptyState>Brak danych dla wybranych filtrów.</EmptyState>
          ) : (
            <PivotTable pivot={pivot} params={params} />
          )}
        </Card>
      </div>
    </>
  );
}

function Select<T extends string>({
  name,
  value,
  options,
}: {
  name: string;
  value: T;
  options: Record<T, string>;
}) {
  return (
    <select name={name} defaultValue={value} className={inputClass}>
      {(Object.entries(options) as [T, string][]).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-5 py-4 shadow-xs">
      <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-warning">{hint}</p>}
    </div>
  );
}

