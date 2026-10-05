import clsx from "clsx";
import { Check, Trash2, Undo2, X } from "lucide-react";
import { ActionForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";
import { FormField, inputClass } from "@/components/ui/Form";
import {
  addTimeEntryAction,
  deleteTimeEntryAction,
  setTimeEntryStatusAction,
} from "@/lib/actions/time-entry-actions";
import { requireSession } from "@/lib/auth";
import {
  employeeName,
  formatDate,
  formatHours,
  isIsoDate,
  monthRange,
  todayIso,
} from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  TIME_ENTRY_STATUS_LABELS,
  type Employee,
  type Project,
  type TimeEntry,
  type TimeEntryStatus,
  type WorkCategory,
} from "@/lib/types";

const STATUS_CLASSES: Record<TimeEntryStatus, string> = {
  zgloszony: "bg-amber-100 text-amber-800",
  zatwierdzony: "bg-green-100 text-green-800",
  odrzucony: "bg-red-100 text-red-700",
};

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

  const supabase = await createSupabaseServerClient();
  let entriesQuery = supabase
    .from("time_entries")
    .select("*, projects(name), employees(first_name, last_name), work_categories(name)")
    .gte("work_date", from)
    .lte("work_date", to)
    .order("work_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (projectFilter) entriesQuery = entriesQuery.eq("project_id", projectFilter);
  if (employeeFilter && session.isManager) entriesQuery = entriesQuery.eq("employee_id", employeeFilter);
  if (statusFilter in TIME_ENTRY_STATUS_LABELS) entriesQuery = entriesQuery.eq("status", statusFilter);

  const [entriesResult, projectsResult, categoriesResult, employeesResult] = await Promise.all([
    entriesQuery,
    supabase.from("projects").select("*").order("name"),
    supabase.from("work_categories").select("id, name").eq("is_archived", false).order("sort_order"),
    session.isManager
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
  const openProjects = projects.filter((p) => p.status === "w_toku" || p.status === "planowana");
  const activeEmployees = employees.filter((e) => e.is_active);

  const countedEntries = entries.filter((e) => e.status !== "odrzucony");
  const totalHours = countedEntries.reduce((sum, e) => sum + Number(e.hours), 0);
  const approvedHours = entries
    .filter((e) => e.status === "zatwierdzony")
    .reduce((sum, e) => sum + Number(e.hours), 0);
  const canReport = session.isManager || session.employeeId !== null;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-border bg-surface p-5">
        <h1 className="text-base font-semibold">Dodaj czas pracy</h1>
        {!canReport ? (
          <p className="mt-2 text-sm text-warning">
            Twoje konto nie jest jeszcze powiązane z pracownikiem — poproś kierownika o
            przypisanie, żeby móc raportować godziny.
          </p>
        ) : openProjects.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Brak aktywnych budów.{" "}
            {session.isManager ? "Dodaj budowę w zakładce Budowy." : "Zgłoś to kierownikowi."}
          </p>
        ) : (
          <ActionForm
            action={addTimeEntryAction}
            submitLabel="Dodaj wpis"
            successMessage="Dodano wpis."
            className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            {session.isManager && (
              <FormField label="Pracownik" htmlFor="employee_id" required full>
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
            <FormField label="Rodzaj prac" htmlFor="work_category_id">
              <select id="work_category_id" name="work_category_id" defaultValue="" className={inputClass}>
                <option value="">— nie wybrano —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Data" htmlFor="work_date" required>
              <input
                id="work_date"
                name="work_date"
                type="date"
                required
                max={today}
                defaultValue={today}
                className={inputClass}
              />
            </FormField>
            <FormField label="Liczba godzin" htmlFor="hours" required>
              <input
                id="hours"
                name="hours"
                type="text"
                inputMode="decimal"
                required
                placeholder="np. 8 lub 7,5"
                className={inputClass}
              />
            </FormField>
            <FormField label="Opis wykonanych prac" htmlFor="description" full>
              <textarea id="description" name="description" rows={2} className={inputClass} />
            </FormField>
          </ActionForm>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">
            {session.isManager ? "Wpisy czasu pracy" : "Moje wpisy"}
          </h2>
          <p className="text-sm text-muted">
            Razem: <span className="font-semibold text-foreground">{formatHours(totalHours)}</span>
            {" · "}zatwierdzone: {formatHours(approvedHours)}
          </p>
        </div>

        <form method="get" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-6">
          <label className="text-xs text-muted">
            Od
            <input type="date" name="od" defaultValue={from} className={clsx(inputClass, "mt-1")} />
          </label>
          <label className="text-xs text-muted">
            Do
            <input type="date" name="do" defaultValue={to} className={clsx(inputClass, "mt-1")} />
          </label>
          <label className="text-xs text-muted">
            Budowa
            <select name="budowa" defaultValue={projectFilter} className={clsx(inputClass, "mt-1")}>
              <option value="">Wszystkie</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {session.isManager && (
            <label className="text-xs text-muted">
              Pracownik
              <select
                name="pracownik"
                defaultValue={employeeFilter}
                className={clsx(inputClass, "mt-1")}
              >
                <option value="">Wszyscy</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {employeeName(e)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-xs text-muted">
            Status
            <select name="status" defaultValue={statusFilter} className={clsx(inputClass, "mt-1")}>
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

        {entries.length === 0 ? (
          <p className="mt-6 text-sm text-muted">Brak wpisów w wybranym okresie.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {entries.map((entry) => {
              const canDelete = session.isManager || entry.status === "zgloszony";
              return (
                <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <div className="min-w-0 flex-1 basis-56">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span>{formatDate(entry.work_date)}</span>
                      <span className="text-muted">·</span>
                      <span>{entry.projects?.name ?? "—"}</span>
                      <span
                        className={clsx(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          STATUS_CLASSES[entry.status]
                        )}
                      >
                        {TIME_ENTRY_STATUS_LABELS[entry.status]}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {[
                        session.isManager ? employeeName(entry.employees) : null,
                        entry.work_categories?.name,
                        entry.description,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">
                    {formatHours(Number(entry.hours))}
                  </div>
                  <div className="flex items-center gap-1">
                    {session.isManager && entry.status !== "zatwierdzony" && (
                      <EntryButton
                        action={setTimeEntryStatusAction}
                        id={entry.id}
                        status="zatwierdzony"
                        label="Zatwierdź"
                        className="text-success hover:bg-green-50"
                      >
                        <Check size={16} />
                      </EntryButton>
                    )}
                    {session.isManager && entry.status === "zgloszony" && (
                      <EntryButton
                        action={setTimeEntryStatusAction}
                        id={entry.id}
                        status="odrzucony"
                        label="Odrzuć"
                        className="text-danger hover:bg-red-50"
                      >
                        <X size={16} />
                      </EntryButton>
                    )}
                    {session.isManager && entry.status !== "zgloszony" && (
                      <EntryButton
                        action={setTimeEntryStatusAction}
                        id={entry.id}
                        status="zgloszony"
                        label="Cofnij do zgłoszonych"
                        className="text-muted hover:bg-black/5"
                      >
                        <Undo2 size={16} />
                      </EntryButton>
                    )}
                    {canDelete && (
                      <EntryButton
                        action={deleteTimeEntryAction}
                        id={entry.id}
                        label="Usuń wpis"
                        className="text-muted hover:bg-red-50 hover:text-danger"
                      >
                        <Trash2 size={16} />
                      </EntryButton>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
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
        className={clsx("rounded-lg p-2 transition-colors", className)}
      >
        {children}
      </button>
    </form>
  );
}
