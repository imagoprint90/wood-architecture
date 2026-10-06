import type { SupabaseClient } from "@supabase/supabase-js";
import { isIsoMonth, monthRange, todayIso } from "@/lib/format";
import { polishHolidays } from "@/lib/holidays";
import type { Employee, Project, TimeEntry, WorkCategory } from "@/lib/types";

// Raporty czasu pracy jako tabela przestawna: wybrany wymiar w wierszach, inny w kolumnach,
// w komórkach suma godzin albo koszt robocizny. Ta sama logika zasila ekran i eksport CSV.

export const ROW_DIMS = {
  pracownik: "Pracownicy",
  budowa: "Budowy",
  rodzaj: "Rodzaje prac",
} as const;

export const COL_DIMS = {
  dzien: "Dni miesiąca",
  tydzien: "Tygodnie",
  budowa: "Budowy",
  pracownik: "Pracownicy",
  rodzaj: "Rodzaje prac",
} as const;

export const VALUE_KINDS = { godziny: "Godziny", koszt: "Koszt robocizny (zł)" } as const;

export const STATUS_FILTERS = {
  wszystkie: "Zgłoszone i zatwierdzone",
  zatwierdzone: "Tylko zatwierdzone",
  zgloszone: "Tylko oczekujące",
} as const;

export type RowDim = keyof typeof ROW_DIMS;
export type ColDim = keyof typeof COL_DIMS;
export type ValueKind = keyof typeof VALUE_KINDS;
export type StatusFilter = keyof typeof STATUS_FILTERS;

export interface ReportParams {
  month: string;
  rowDim: RowDim;
  colDim: ColDim;
  value: ValueKind;
  status: StatusFilter;
  projectId: string;
  employeeId: string;
  categoryId: string;
  // Ciągłość raportów: pracownicy × dni ze wszystkich budów naraz, z oznaczeniem dni
  // roboczych bez żadnego wpisu.
  continuity: boolean;
}

export interface PivotColumn {
  key: string;
  label: string;
  sublabel?: string;
  title?: string;
  tone?: "saturday" | "holiday";
}

export interface PivotRow {
  key: string;
  label: string;
  values: number[];
  total: number;
  // Tylko w trybie ciągłości: które kolumny to dni robocze bez wpisu.
  missing?: boolean[];
  reportedDays?: number;
  missingDays?: number;
}

export interface Pivot {
  columns: PivotColumn[];
  rows: PivotRow[];
  columnTotals: number[];
  grandTotal: number;
}

export interface Report {
  params: ReportParams;
  pivot: Pivot;
  totals: { hours: number; approvedHours: number; cost: number; entries: number };
  missingRate: boolean;
  employees: Employee[];
  projects: Project[];
  categories: WorkCategory[];
}

const UUID = /^[0-9a-f-]{36}$/i;
const WEEKDAYS = ["ND", "PN", "WT", "ŚR", "CZ", "PT", "SO"];
const NO_CATEGORY = "brak";

function pick<T extends string>(value: unknown, allowed: Record<T, string>, fallback: T): T {
  return typeof value === "string" && value in allowed ? (value as T) : fallback;
}

function uuidOrEmpty(value: unknown): string {
  return typeof value === "string" && UUID.test(value) ? value : "";
}

export function parseReportParams(raw: Record<string, string | string[] | undefined>): ReportParams {
  const continuity = raw.ciaglosc === "1";
  const rowDim: RowDim = continuity ? "pracownik" : pick<RowDim>(raw.wiersze, ROW_DIMS, "pracownik");
  let colDim: ColDim = continuity ? "dzien" : pick<ColDim>(raw.kolumny, COL_DIMS, "dzien");
  // Ten sam wymiar w wierszach i kolumnach nic nie pokazuje — wracamy do dni.
  if (colDim === rowDim) colDim = "dzien";
  return {
    month: isIsoMonth(raw.miesiac) ? raw.miesiac : todayIso().slice(0, 7),
    rowDim,
    colDim,
    value: pick<ValueKind>(raw.wartosc, VALUE_KINDS, "godziny"),
    status: pick<StatusFilter>(raw.status, STATUS_FILTERS, "wszystkie"),
    projectId: continuity ? "" : uuidOrEmpty(raw.budowa),
    employeeId: uuidOrEmpty(raw.pracownik),
    categoryId: continuity ? "" : uuidOrEmpty(raw.rodzaj),
    continuity,
  };
}

// Parametry jako adres — do linków (presety, zmiana miesiąca, eksport) z zachowaniem filtrów.
export function reportQuery(params: ReportParams, overrides: Partial<ReportParams> = {}): string {
  const p = { ...params, ...overrides };
  const query = new URLSearchParams({ miesiac: p.month });
  if (p.continuity) {
    query.set("ciaglosc", "1");
  } else {
    query.set("wiersze", p.rowDim);
    query.set("kolumny", p.colDim);
    if (p.projectId) query.set("budowa", p.projectId);
    if (p.categoryId) query.set("rodzaj", p.categoryId);
  }
  if (p.value !== "godziny") query.set("wartosc", p.value);
  if (p.status !== "wszystkie") query.set("status", p.status);
  if (p.employeeId) query.set("pracownik", p.employeeId);
  return query.toString();
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1))
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// W raportach nazwisko idzie pierwsze — tak sortuje się listy płacowe.
function reportName(e: { first_name: string; last_name: string } | null | undefined): string {
  if (!e) return "—";
  return `${e.last_name} ${e.first_name}`.trim();
}

function utcDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Poniedziałek tygodnia, w którym leży dana data.
function weekStart(isoDate: string): string {
  const date = utcDate(isoDate);
  const offset = (date.getUTCDay() + 6) % 7;
  return toIso(new Date(date.getTime() - offset * 86_400_000));
}

function shortDate(isoDate: string): string {
  return `${isoDate.slice(8, 10)}.${isoDate.slice(5, 7)}`;
}

function daysOfMonth(month: string): string[] {
  const { from, to } = monthRange(month);
  const last = Number(to.slice(8, 10));
  return Array.from({ length: last }, (_, i) => `${from.slice(0, 8)}${String(i + 1).padStart(2, "0")}`);
}

function dayColumns(month: string): PivotColumn[] {
  const holidays = polishHolidays(Number(month.slice(0, 4)));
  return daysOfMonth(month).map((day) => {
    const weekday = utcDate(day).getUTCDay();
    const holiday = holidays.get(day);
    return {
      key: day,
      label: String(Number(day.slice(8, 10))),
      sublabel: WEEKDAYS[weekday],
      title: holiday,
      tone: holiday || weekday === 0 ? "holiday" : weekday === 6 ? "saturday" : undefined,
    };
  });
}

function weekColumns(month: string): PivotColumn[] {
  const { from, to } = monthRange(month);
  const starts = [...new Set(daysOfMonth(month).map(weekStart))];
  return starts.map((start, index) => {
    const end = toIso(new Date(utcDate(start).getTime() + 6 * 86_400_000));
    // Tydzień przycięty do granic miesiąca — raport obejmuje tylko wpisy z tego miesiąca.
    const first = start < from ? from : start;
    const last = end > to ? to : end;
    return { key: start, label: `Tydz. ${index + 1}`, sublabel: `${shortDate(first)}–${shortDate(last)}` };
  });
}

function entryKey(entry: TimeEntry, dim: RowDim | ColDim): string {
  switch (dim) {
    case "pracownik":
      return entry.employee_id;
    case "budowa":
      return entry.project_id;
    case "rodzaj":
      return entry.work_category_id ?? NO_CATEGORY;
    case "dzien":
      return entry.work_date;
    case "tydzien":
      return weekStart(entry.work_date);
  }
}

function sortByLabel<T extends { label: string }>(items: T[]): T[] {
  return items.sort((a, b) => a.label.localeCompare(b.label, "pl"));
}

export async function loadReport(supabase: SupabaseClient, params: ReportParams): Promise<Report> {
  const { from, to } = monthRange(params.month);

  let entriesQuery = supabase
    .from("time_entries")
    .select("*, projects(name), employees(first_name, last_name), work_categories(name)")
    .gte("work_date", from)
    .lte("work_date", to);
  if (params.status === "zatwierdzone") entriesQuery = entriesQuery.eq("status", "zatwierdzony");
  else if (params.status === "zgloszone") entriesQuery = entriesQuery.eq("status", "zgloszony");
  else entriesQuery = entriesQuery.neq("status", "odrzucony");
  if (params.projectId) entriesQuery = entriesQuery.eq("project_id", params.projectId);
  if (params.employeeId) entriesQuery = entriesQuery.eq("employee_id", params.employeeId);
  if (params.categoryId) entriesQuery = entriesQuery.eq("work_category_id", params.categoryId);

  const [entriesResult, employeesResult, projectsResult, categoriesResult, membersResult] = await Promise.all([
    entriesQuery,
    supabase.from("employees").select("*").order("last_name").order("first_name"),
    supabase.from("projects").select("*").order("name"),
    supabase.from("work_categories").select("id, name").order("sort_order"),
    params.projectId
      ? supabase.from("project_members").select("employee_id").eq("project_id", params.projectId)
      : Promise.resolve({ data: null, error: null }),
  ]);
  const loadError =
    entriesResult.error ?? employeesResult.error ?? projectsResult.error ?? categoriesResult.error;
  if (loadError) throw new Error(loadError.message);

  const entries = (entriesResult.data ?? []) as TimeEntry[];
  const employees = (employeesResult.data ?? []) as Employee[];
  const projects = (projectsResult.data ?? []) as Project[];
  const categories = (categoriesResult.data ?? []) as WorkCategory[];
  // Brak tabeli przydziałów (migracja 0003 jeszcze nie uruchomiona) = brak zawężenia.
  const memberIds = membersResult.data
    ? new Set(membersResult.data.map((m) => m.employee_id as string))
    : null;

  const labels: Record<"pracownik" | "budowa" | "rodzaj", Map<string, string>> = {
    pracownik: new Map(employees.map((e) => [e.id, reportName(e)])),
    budowa: new Map(projects.map((p) => [p.id, p.name])),
    rodzaj: new Map([...categories.map((c) => [c.id, c.name] as const), [NO_CATEGORY, "Bez rodzaju prac"]]),
  };

  // Wiersze, które mają być widoczne także bez żadnego wpisu (z zerami) — tak jak na
  // liście obecności: aktywni pracownicy (przy filtrze budowy: tylko do niej przydzieleni)
  // albo budowy w toku. Rodzaje prac pokazujemy tylko te, które wystąpiły.
  const baseRowKeys = new Set<string>();
  if (params.rowDim === "pracownik") {
    for (const e of employees) {
      if (!e.is_active) continue;
      if (params.employeeId && e.id !== params.employeeId) continue;
      if (memberIds && !memberIds.has(e.id)) continue;
      baseRowKeys.add(e.id);
    }
  } else if (params.rowDim === "budowa") {
    for (const p of projects) {
      if (p.status !== "w_toku") continue;
      if (params.projectId && p.id !== params.projectId) continue;
      baseRowKeys.add(p.id);
    }
  }
  for (const entry of entries) baseRowKeys.add(entryKey(entry, params.rowDim));

  let columns: PivotColumn[];
  if (params.colDim === "dzien") columns = dayColumns(params.month);
  else if (params.colDim === "tydzien") columns = weekColumns(params.month);
  else {
    const dim = params.colDim;
    const keys = new Set(entries.map((e) => entryKey(e, dim)));
    columns = sortByLabel([...keys].map((key) => ({ key, label: labels[dim].get(key) ?? "—" })));
  }
  const columnIndex = new Map(columns.map((c, i) => [c.key, i]));

  const rowDim = params.rowDim;
  const rows = sortByLabel(
    [...baseRowKeys].map<PivotRow>((key) => ({
      key,
      label: labels[rowDim].get(key) ?? "—",
      values: columns.map(() => 0),
      total: 0,
    }))
  );
  const rowIndex = new Map(rows.map((r, i) => [r.key, i]));

  const totals = { hours: 0, approvedHours: 0, cost: 0, entries: entries.length };
  let missingRate = false;
  for (const entry of entries) {
    const hours = Number(entry.hours);
    const cost = hours * Number(entry.hourly_rate_snapshot ?? 0);
    totals.hours += hours;
    totals.cost += cost;
    if (entry.status === "zatwierdzony") totals.approvedHours += hours;
    if (entry.hourly_rate_snapshot === null) missingRate = true;

    const row = rows[rowIndex.get(entryKey(entry, rowDim))!];
    const column = columnIndex.get(entryKey(entry, params.colDim));
    const amount = params.value === "koszt" ? cost : hours;
    row.total += amount;
    if (column !== undefined) row.values[column] += amount;
  }

  if (params.continuity) {
    const today = todayIso();
    for (const row of rows) {
      // Dzień roboczy = poniedziałek–piątek, niebędący świętem, nie w przyszłości.
      row.missing = columns.map((c, i) => !c.tone && c.key <= today && row.values[i] === 0);
      row.reportedDays = row.values.filter((v) => v > 0).length;
      row.missingDays = row.missing.filter(Boolean).length;
    }
  }

  const columnTotals = columns.map((_, i) => rows.reduce((sum, r) => sum + r.values[i], 0));
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

  return {
    params,
    pivot: { columns, rows, columnTotals, grandTotal },
    totals,
    missingRate,
    employees,
    projects,
    categories,
  };
}
