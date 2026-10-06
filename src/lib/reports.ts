import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDate, formatDateTime, isIsoMonth, monthRange, todayIso } from "@/lib/format";
import { polishHolidays } from "@/lib/holidays";
import type { Employee, Project, TimeEntry, WorkCategory } from "@/lib/types";

// Raporty czasu pracy jako tabela przestawna: wybrany wymiar w wierszach, inny w kolumnach,
// w komórkach suma godzin albo koszt robocizny. Ta sama logika zasila ekran i eksport CSV.

export const ROW_DIMS = {
  pracownik: "Pracownicy",
  budowa: "Budowy",
  rodzaj: "Etapy prac",
} as const;

export const COL_DIMS = {
  dzien: "Dni miesiąca",
  tydzien: "Tygodnie",
  miesiac: "Miesiące (cały rok)",
  budowa: "Budowy",
  pracownik: "Pracownicy",
  rodzaj: "Etapy prac",
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
  // Sumy wiersza liczone zawsze w obu jednostkach, niezależnie od tego, co pokazują komórki.
  totalHours: number;
  // Koszt robocizny: godziny × stawka zapamiętana przy wpisie.
  totalCost: number;
  // Czy w wierszu są wpisy bez żadnej stawki (ich koszt liczony jest jako 0 zł).
  missingRate: boolean;
  // Dla każdej kolumny: indeksy wpisów (w Pivot.details), z których powstała komórka.
  entries: number[][];
  // Dla każdej kolumny: czy komórka zawiera choć jeden wpis czekający na zatwierdzenie.
  pending: boolean[];
  // Tylko w trybie ciągłości: które kolumny to dni robocze bez wpisu.
  missing?: boolean[];
  reportedDays?: number;
  missingDays?: number;
}

// Pojedynczy wpis czasu pracy w postaci gotowej do pokazania w dymku nad komórką.
export interface EntryDetail {
  date: string;
  employee: string;
  project: string;
  stage: string;
  hours: number;
  cost: number;
  approved: boolean;
  description: string | null;
  // „Jan Kowalski, 06.10.2026, 14:32” — kto i kiedy dodał wpis.
  createdLabel: string;
  // To samo dla modyfikacji przez administratora (null = wpis niezmieniany).
  editedLabel: string | null;
}

export interface Pivot {
  columns: PivotColumn[];
  rows: PivotRow[];
  details: EntryDetail[];
  columnTotals: number[];
  grandHours: number;
  grandCost: number;
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

const MONTH_SHORT = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

function monthColumns(year: string): PivotColumn[] {
  return MONTH_SHORT.map((label, index) => {
    const key = `${year}-${String(index + 1).padStart(2, "0")}`;
    // `title` = pełna nazwa do dymka i podpowiedzi nad nagłówkiem.
    return { key, label, title: monthLabel(key) };
  });
}

// Raport roczny = kolumny to miesiące; wtedy zakres danych to cały rok, nie jeden miesiąc.
export function isYearly(params: Pick<ReportParams, "colDim">): boolean {
  return params.colDim === "miesiac";
}

export function reportRange(params: Pick<ReportParams, "colDim" | "month">): { from: string; to: string } {
  if (!isYearly(params)) return monthRange(params.month);
  const year = params.month.slice(0, 4);
  return { from: `${year}-01-01`, to: `${year}-12-31` };
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
    case "miesiac":
      return entry.work_date.slice(0, 7);
  }
}

function sortByLabel<T extends { label: string }>(items: T[]): T[] {
  return items.sort((a, b) => a.label.localeCompare(b.label, "pl"));
}

export async function loadReport(supabase: SupabaseClient, params: ReportParams): Promise<Report> {
  const { from, to } = reportRange(params);

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

  const [entriesResult, employeesResult, projectsResult, categoriesResult, membersResult, profilesResult] =
    await Promise.all([
    entriesQuery,
    supabase.from("employees").select("*").order("last_name").order("first_name"),
    supabase.from("projects").select("*").order("name"),
    supabase.from("work_categories").select("*").order("sort_order").order("name"),
    params.projectId
      ? supabase.from("project_members").select("employee_id").eq("project_id", params.projectId)
      : Promise.resolve({ data: null, error: null }),
    // Nazwy kont — do informacji „kto dodał wpis”.
    supabase.from("profiles").select("id, full_name, email"),
  ]);
  const accountNames = new Map(
    (profilesResult.data ?? []).map((p) => [p.id as string, (p.full_name || p.email || "—") as string])
  );
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
    rodzaj: new Map([...categories.map((c) => [c.id, c.name] as const), [NO_CATEGORY, "Bez etapu"]]),
  };

  // Wiersze, które mają być widoczne także bez żadnego wpisu (z zerami) — tak jak na
  // liście obecności: aktywni pracownicy (przy filtrze budowy: tylko do niej przydzieleni)
  // budowy w toku albo aktywne etapy prac.
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
  else {
    for (const c of categories) {
      if (c.is_archived) continue;
      if (params.categoryId && c.id !== params.categoryId) continue;
      baseRowKeys.add(c.id);
    }
  }
  for (const entry of entries) baseRowKeys.add(entryKey(entry, params.rowDim));

  // Etapy prac idą w kolejności ustawionej w zakładce Etapy prac (wpisy bez etapu na końcu),
  // pozostałe wymiary — alfabetycznie.
  const stageOrder = new Map(categories.map((c, i) => [c.id, i]));
  function sortDim<T extends { key: string; label: string }>(items: T[], dim: RowDim | ColDim): T[] {
    if (dim !== "rodzaj") return sortByLabel(items);
    const rank = (key: string) => stageOrder.get(key) ?? Number.MAX_SAFE_INTEGER;
    return items.sort((a, b) => rank(a.key) - rank(b.key));
  }

  let columns: PivotColumn[];
  if (params.colDim === "dzien") columns = dayColumns(params.month);
  else if (params.colDim === "tydzien") columns = weekColumns(params.month);
  else if (params.colDim === "miesiac") columns = monthColumns(params.month.slice(0, 4));
  else {
    const dim = params.colDim;
    const keys = new Set(entries.map((e) => entryKey(e, dim)));
    columns = sortDim(
      [...keys].map((key) => ({ key, label: labels[dim].get(key) ?? "—" })),
      dim
    );
  }
  const columnIndex = new Map(columns.map((c, i) => [c.key, i]));

  const rowDim = params.rowDim;
  const rows = sortDim(
    [...baseRowKeys].map<PivotRow>((key) => ({
      key,
      label: labels[rowDim].get(key) ?? "—",
      values: columns.map(() => 0),
      totalHours: 0,
      totalCost: 0,
      missingRate: false,
      entries: columns.map(() => []),
      pending: columns.map(() => false),
    })),
    rowDim
  );
  const rowIndex = new Map(rows.map((r, i) => [r.key, i]));

  const totals = { hours: 0, approvedHours: 0, cost: 0, entries: entries.length };
  let missingRate = false;
  const currentRates = new Map(employees.map((e) => [e.id, e.hourly_rate]));
  const details: EntryDetail[] = [];
  // Wpisy w kolejności dat — w tej kolejności pokażą się w dymku nad komórką.
  entries.sort((a, b) => a.work_date.localeCompare(b.work_date));
  for (const entry of entries) {
    const hours = Number(entry.hours);
    // Stawka zapamiętana przy wpisie; jeśli jej nie było (pracownik nie miał wtedy ustawionej
    // stawki) — obecna stawka pracownika. Dopiero brak obu oznacza koszt 0 zł.
    const rate = entry.hourly_rate_snapshot ?? currentRates.get(entry.employee_id) ?? null;
    const cost = hours * Number(rate ?? 0);
    totals.hours += hours;
    totals.cost += cost;
    if (entry.status === "zatwierdzony") totals.approvedHours += hours;
    if (rate === null) missingRate = true;

    const row = rows[rowIndex.get(entryKey(entry, rowDim))!];
    const column = columnIndex.get(entryKey(entry, params.colDim));
    const amount = params.value === "koszt" ? cost : hours;
    row.totalHours += hours;
    row.totalCost += cost;
    if (rate === null) row.missingRate = true;
    if (column === undefined) continue;
    row.values[column] += amount;
    row.entries[column].push(details.length);
    if (entry.status !== "zatwierdzony") row.pending[column] = true;

    const author = entry.created_by ? accountNames.get(entry.created_by) : undefined;
    details.push({
      date: formatDate(entry.work_date),
      employee: reportName(entry.employees),
      project: entry.projects?.name ?? "—",
      stage: entry.work_categories?.name ?? "Bez etapu",
      hours,
      cost,
      approved: entry.status === "zatwierdzony",
      description: entry.description,
      createdLabel: [author ?? "—", entry.created_at ? formatDateTime(entry.created_at) : null]
        .filter(Boolean)
        .join(", "),
      editedLabel: entry.edited_at
        ? `${entry.edited_by_name ?? "administrator"}, ${formatDateTime(entry.edited_at)}`
        : null,
    });
  }

  if (params.continuity) {
    const today = todayIso();
    for (const row of rows) {
      // Dzień roboczy = poniedziałek–piątek, niebędący świętem, nie w przyszłości.
      row.missing = columns.map((c, i) => !c.tone && c.key <= today && row.entries[i].length === 0);
      row.reportedDays = row.entries.filter((cell) => cell.length > 0).length;
      row.missingDays = row.missing.filter(Boolean).length;
    }
  }

  const columnTotals = columns.map((_, i) => rows.reduce((sum, r) => sum + r.values[i], 0));
  const grandHours = rows.reduce((sum, r) => sum + r.totalHours, 0);
  const grandCost = rows.reduce((sum, r) => sum + r.totalCost, 0);

  return {
    params,
    pivot: { columns, rows, details, columnTotals, grandHours, grandCost },
    totals,
    missingRate,
    employees,
    projects,
    categories,
  };
}
