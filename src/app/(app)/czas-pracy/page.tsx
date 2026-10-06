import clsx from "clsx";
import Link from "next/link";
import { Check, Pencil, Trash2, Undo2, X } from "lucide-react";
import { ActionForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { CollapsibleFilters } from "@/components/ui/CollapsibleFilters";
import { FormField, inputClass, textareaClass } from "@/components/ui/Form";
import { HoursInput } from "@/components/ui/HoursInput";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { SortableTable } from "@/components/ui/SortableTable";
import { cells } from "@/components/ui/table-cells";
import { Dash } from "@/components/ui/Table";
import {
  addTimeEntryAction,
  deleteTimeEntryAction,
  setTimeEntryStatusAction,
} from "@/lib/actions/time-entry-actions";
import { requireSession } from "@/lib/auth";
import {
  employeeName,
  formatDate,
  formatDateTime,
  formatHours,
  isIsoDate,
  monthRange,
  todayIso,
} from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_REPORT_DAYS_BACK, daysBackLabel, earliestReportDate } from "@/lib/workdays";
import {
  TIME_ENTRY_STATUS_LABELS,
  type Employee,
  type Project,
  type TimeEntry,
  type TimeEntryStatus,
  type WorkCategory,
} from "@/lib/types";

const STATUS_TONES = {
  zgloszony: "warning",
  zatwierdzony: "success",
  odrzucony: "danger",
} as const;

const filterLabelClass = "flex flex-col gap-1 text-xs font-medium text-muted";

function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default async function CzasPracyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const today = todayIso();
  const currentMonth = monthRange(today.slice(0, 7));
  const from = isIsoDate(params.od) ? params.od : currentMonth.from;
  const to = isIsoDate(params.do) ? params.do : currentMonth.to;
  const projectFilter = single(params.budowa);
  const employeeFilter = single(params.pracownik);
  const statusFilter = single(params.status);
  const stageFilter = single(params.etap);

  const supabase = await createSupabaseServerClient();
  let entriesQuery = supabase
    .from("time_entries")
    .select("*, projects(name), employees(first_name, last_name), work_categories(name)")
    .gte("work_date", from)
    .lte("work_date", to)
    .order("work_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (projectFilter) entriesQuery = entriesQuery.eq("project_id", projectFilter);
  if (employeeFilter && session.isAdmin) entriesQuery = entriesQuery.eq("employee_id", employeeFilter);
  if (stageFilter) entriesQuery = entriesQuery.eq("work_category_id", stageFilter);
  if (statusFilter in TIME_ENTRY_STATUS_LABELS) entriesQuery = entriesQuery.eq("status", statusFilter);

  const [entriesResult, projectsResult, categoriesResult, employeesResult] = await Promise.all([
    entriesQuery,
    supabase.from("projects").select("*").order("name"),
    supabase.from("work_categories").select("*").order("sort_order").order("name"),
    session.isAdmin
      ? supabase.from("employees").select("*").order("last_name").order("first_name")
      : Promise.resolve({ data: [], error: null }),
  ]);
  const loadError =
    entriesResult.error ?? projectsResult.error ?? categoriesResult.error ?? employeesResult.error;
  if (loadError) throw new Error(loadError.message);

  const entries = (entriesResult.data ?? []) as TimeEntry[];
  const projects = (projectsResult.data ?? []) as Project[];
  const categories = (categoriesResult.data ?? []) as WorkCategory[];
  const employees = (employeesResult.data ?? []) as Employee[];
  // Do nowych wpisów tylko budowy, na których coś się dzieje; filtr pokazuje wszystkie.
  // Raportujący wpisuje czas tylko na budowach, do których jest przydzielony (błąd odczytu
  // przydziałów, np. brak migracji 0003, = bez zawężenia; i tak pilnuje tego baza).
  let assignedIds: Set<string> | null = null;
  if (!session.isAdmin && session.employeeId) {
    const { data: memberships } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("employee_id", session.employeeId);
    if (memberships) assignedIds = new Set(memberships.map((m) => m.project_id as string));
  }
  // Okno raportowania raportującego: najwcześniejsza dozwolona data (administrator bez limitu).
  let earliestDate: string | null = null;
  let daysBack = DEFAULT_REPORT_DAYS_BACK;
  if (!session.isAdmin && session.employeeId) {
    const { data: settings } = await supabase
      .from("employees")
      .select("report_days_back")
      .eq("id", session.employeeId)
      .maybeSingle();
    daysBack = settings?.report_days_back ?? DEFAULT_REPORT_DAYS_BACK;
    earliestDate = earliestReportDate(today, daysBack);
  }
  const openProjects = projects.filter(
    (p) => (p.status === "w_toku" || p.status === "planowana") && (!assignedIds || assignedIds.has(p.id))
  );
  const activeEmployees = employees.filter((e) => e.is_active);

  const totalHours = entries
    .filter((e) => e.status !== "odrzucony")
    .reduce((sum, e) => sum + Number(e.hours), 0);
  const approvedHours = entries
    .filter((e) => e.status === "zatwierdzony")
    .reduce((sum, e) => sum + Number(e.hours), 0);
  const canReport = session.isAdmin || session.employeeId !== null;
  // Ile filtrów odbiega od domyślnych (zakres dat liczony jako jeden) — pokazywane przy
  // zwiniętym panelu, żeby było widać, że lista jest zawężona.
  const activeFilters =
    Number(from !== currentMonth.from || to !== currentMonth.to) +
    Number(Boolean(projectFilter)) +
    Number(Boolean(employeeFilter && session.isAdmin)) +
    Number(Boolean(stageFilter)) +
    Number(statusFilter in TIME_ENTRY_STATUS_LABELS);

  return (
    <>
      <PageHeader
        title="Czas pracy"
        description={
          session.isAdmin
            ? "Wpisy wszystkich użytkowników — dodawanie, zatwierdzanie i odrzucanie."
            : "Twoje raporty czasu pracy na budowach."
        }
      />

      <div className="flex flex-col gap-5">
        <Card title="Nowy wpis">
          {!canReport ? (
            <p className="text-warning">
              Twoje konto nie jest jeszcze powiązane z pracownikiem — poproś administratora o
              przypisanie, żeby móc raportować godziny.
            </p>
          ) : openProjects.length === 0 ? (
            <p className="text-muted">
              {session.isAdmin && "Brak aktywnych budów. "}
              {session.isAdmin
                ? "Dodaj budowę w zakładce Budowy."
                : "Nie jesteś przydzielony do żadnej aktywnej budowy — zgłoś to administratorowi."}
            </p>
          ) : (
            <ActionForm
              action={addTimeEntryAction}
              submitLabel="Dodaj wpis"
              successMessage="Dodano wpis."
              className={clsx(
                "grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2",
                // Wszystkie krótkie pola w jednym rzędzie: 4 u raportującego, 5 u administratora.
                session.isAdmin ? "xl:grid-cols-5" : "lg:grid-cols-4"
              )}
            >
              {session.isAdmin && (
                <FormField label="Pracownik" htmlFor="employee_id" required>
                  <select
                    id="employee_id"
                    name="employee_id"
                    required
                    defaultValue={session.employeeId ?? ""}
                    className={inputClass}
                  >
                    <option value="">— wybierz —</option>
                    {activeEmployees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {employeeName(e)}
                      </option>
                    ))}
                  </select>
                </FormField>
              )}
              <FormField label="Budowa" htmlFor="project_id" required>
                <select id="project_id" name="project_id" required defaultValue="" className={inputClass}>
                  <option value="">— wybierz —</option>
                  {openProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Etap prac" htmlFor="work_category_id" required>
                <SearchSelect
                  id="work_category_id"
                  name="work_category_id"
                  options={categories.filter((c) => !c.is_archived).map((c) => ({ id: c.id, label: c.name }))}
                  placeholder="Wybierz lub wpisz, aby wyszukać…"
                />
              </FormField>
              <FormField label="Data" htmlFor="work_date" required>
                <input
                  id="work_date"
                  name="work_date"
                  type="date"
                  required
                  min={earliestDate ?? undefined}
                  max={today}
                  defaultValue={today}
                  className={inputClass}
                />
                {earliestDate && (
                  <p className="mt-1 text-xs text-muted">
                    {earliestDate === today
                      ? "Możesz raportować tylko za dzisiejszy dzień."
                      : `Najwcześniej za ${formatDate(earliestDate)} (${daysBackLabel(daysBack)}).`}
                  </p>
                )}
              </FormField>
              <FormField label="Liczba godzin" htmlFor="hours" required>
                <HoursInput id="hours" name="hours" required />
              </FormField>
              <div className="col-span-full">
                <FormField label="Opis wykonanych prac" htmlFor="description">
                  <textarea id="description" name="description" rows={2} className={textareaClass} />
                </FormField>
              </div>
            </ActionForm>
          )}
        </Card>

        <Card
          title={session.isAdmin ? "Wpisy czasu pracy" : "Moje wpisy"}
          actions={
            <p className="text-xs text-muted">
              Razem <span className="font-semibold text-foreground">{formatHours(totalHours)}</span>
              <span className="mx-2 text-border">|</span>
              zatwierdzone{" "}
              <span className="font-semibold text-foreground">{formatHours(approvedHours)}</span>
            </p>
          }
          flush
        >
          <CollapsibleFilters storageKey="czas-pracy-filtry" activeCount={activeFilters} clearHref="/czas-pracy">
          <form
            method="get"
            className="grid grid-cols-1 gap-3 px-4 py-3 min-[26rem]:grid-cols-2 sm:grid-cols-3 sm:px-5 xl:grid-cols-7"
          >
            <label className={filterLabelClass}>
              Od
              <input type="date" name="od" defaultValue={from} className={inputClass} />
            </label>
            <label className={filterLabelClass}>
              Do
              <input type="date" name="do" defaultValue={to} className={inputClass} />
            </label>
            <label className={filterLabelClass}>
              Budowa
              <select name="budowa" defaultValue={projectFilter} className={inputClass}>
                <option value="">Wszystkie</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {session.isAdmin && (
              <label className={filterLabelClass}>
                Pracownik
                <select name="pracownik" defaultValue={employeeFilter} className={inputClass}>
                  <option value="">Wszyscy</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {employeeName(e)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className={filterLabelClass}>
              Etap prac
              <select name="etap" defaultValue={stageFilter} className={inputClass}>
                <option value="">Wszystkie</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={filterLabelClass}>
              Status
              <select name="status" defaultValue={statusFilter} className={inputClass}>
                <option value="">Wszystkie</option>
                {Object.entries(TIME_ENTRY_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <Button type="submit" variant="secondary" className="w-full">
                Filtruj
              </Button>
            </div>
          </form>
          </CollapsibleFilters>

          {entries.length === 0 ? (
            <EmptyState>Brak wpisów w wybranym okresie.</EmptyState>
          ) : (
            <SortableTable
              columns={[
                { label: "Data", className: "tabular-nums" },
                { label: "Budowa", className: "font-medium" },
                ...(session.isAdmin ? [{ label: "Pracownik" }] : []),
                { label: "Etap prac" },
                { label: "Opis", className: "max-w-xs truncate text-muted" },
                { label: "Godziny", align: "right" as const, className: "font-semibold" },
                { label: "Status" },
                { label: "Akcje", align: "right" as const, sortable: false },
              ]}
              rows={entries.map((entry) => {
                const canDelete = session.isAdmin || entry.status === "zgloszony";
                return {
                  key: entry.id,
                  sort: [
                    entry.work_date,
                    entry.projects?.name ?? null,
                    ...(session.isAdmin
                      ? [entry.employees ? `${entry.employees.last_name} ${entry.employees.first_name}`.trim() : null]
                      : []),
                    entry.work_categories?.name ?? null,
                    entry.description,
                    Number(entry.hours),
                    TIME_ENTRY_STATUS_LABELS[entry.status],
                    null,
                  ],
                  cells: cells(
                    formatDate(entry.work_date),
                    entry.projects?.name ?? <Dash />,
                    ...(session.isAdmin ? [employeeName(entry.employees)] : []),
                    entry.work_categories?.name ?? <Dash />,
                    entry.description ? <span title={entry.description}>{entry.description}</span> : <Dash />,
                    formatHours(Number(entry.hours)),
                    <>
                      <Badge tone={STATUS_TONES[entry.status]}>{TIME_ENTRY_STATUS_LABELS[entry.status]}</Badge>
                      {entry.edited_at && (
                        <span className="mt-1 flex items-center gap-1 text-xs text-warning">
                          <Pencil size={11} />
                          Zmodyfikowany: {entry.edited_by_name ?? "administrator"},{" "}
                          {formatDateTime(entry.edited_at)}
                        </span>
                      )}
                    </>,
                    <div className="flex items-center justify-end">
                      {session.isAdmin && (
                        <Link
                          href={`/czas-pracy/${entry.id}`}
                          title="Edytuj raport"
                          aria-label="Edytuj raport"
                          className="rounded-md p-1.5 text-primary transition-colors hover:bg-accent/10"
                        >
                          <Pencil size={15} />
                        </Link>
                      )}
                      {session.isAdmin && entry.status !== "zatwierdzony" && (
                        <EntryButton
                          action={setTimeEntryStatusAction}
                          id={entry.id}
                          status="zatwierdzony"
                          label="Zatwierdź"
                          className="text-success hover:bg-success/10"
                        >
                          <Check size={15} />
                        </EntryButton>
                      )}
                      {session.isAdmin && entry.status === "zgloszony" && (
                        <EntryButton
                          action={setTimeEntryStatusAction}
                          id={entry.id}
                          status="odrzucony"
                          label="Odrzuć"
                          className="text-danger hover:bg-danger/10"
                        >
                          <X size={15} />
                        </EntryButton>
                      )}
                      {session.isAdmin && entry.status !== "zgloszony" && (
                        <EntryButton
                          action={setTimeEntryStatusAction}
                          id={entry.id}
                          status="zgloszony"
                          label="Cofnij do zgłoszonych"
                          className="text-muted hover:bg-foreground/5 hover:text-foreground"
                        >
                          <Undo2 size={15} />
                        </EntryButton>
                      )}
                      {canDelete && (
                        <EntryButton
                          action={deleteTimeEntryAction}
                          id={entry.id}
                          label="Usuń wpis"
                          className="text-muted hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 size={15} />
                        </EntryButton>
                      )}
                    </div>,
                  ),
                };
              })}
            />
          )}
        </Card>
      </div>
    </>
  );
}

function EntryButton({
  action,
  id,
  status,
  label,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  status?: TimeEntryStatus;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {status && <input type="hidden" name="status" value={status} />}
      <button
        type="submit"
        title={label}
        aria-label={label}
        className={clsx("rounded-md p-1.5 transition-colors", className)}
      >
        {children}
      </button>
    </form>
  );
}
