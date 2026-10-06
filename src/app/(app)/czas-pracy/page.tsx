import clsx from "clsx";
import { Check, Trash2, Undo2, X } from "lucide-react";
import { ActionForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { FormField, inputClass, textareaClass } from "@/components/ui/Form";
import { Dash, Table, Td, Th, Tr } from "@/components/ui/Table";
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

const STATUS_TONES = {
  zgloszony: "warning",
  zatwierdzony: "success",
  odrzucony: "danger",
} as const;

const filterLabelClass = "flex flex-col gap-1 text-[11px] font-medium text-muted";

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
  if (employeeFilter && session.isAdmin) entriesQuery = entriesQuery.eq("employee_id", employeeFilter);
  if (statusFilter in TIME_ENTRY_STATUS_LABELS) entriesQuery = entriesQuery.eq("status", statusFilter);

  const [entriesResult, projectsResult, categoriesResult, employeesResult] = await Promise.all([
    entriesQuery,
    supabase.from("projects").select("*").order("name"),
    supabase.from("work_categories").select("id, name").eq("is_archived", false).order("sort_order"),
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
  const openProjects = projects.filter((p) => p.status === "w_toku" || p.status === "planowana");
  const activeEmployees = employees.filter((e) => e.is_active);

  const totalHours = entries
    .filter((e) => e.status !== "odrzucony")
    .reduce((sum, e) => sum + Number(e.hours), 0);
  const approvedHours = entries
    .filter((e) => e.status === "zatwierdzony")
    .reduce((sum, e) => sum + Number(e.hours), 0);
  const canReport = session.isAdmin || session.employeeId !== null;

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
              Brak aktywnych budów.{" "}
              {session.isAdmin ? "Dodaj budowę w zakładce Budowy." : "Zgłoś to administratorowi."}
            </p>
          ) : (
            <ActionForm
              action={addTimeEntryAction}
              submitLabel="Dodaj wpis"
              successMessage="Dodano wpis."
              className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4"
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
              <div className="sm:col-span-2 lg:col-span-4">
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
          <form
            method="get"
            className="grid grid-cols-2 gap-3 border-b border-border bg-subtle/60 px-5 py-3 sm:grid-cols-3 lg:grid-cols-6"
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

          {entries.length === 0 ? (
            <EmptyState>Brak wpisów w wybranym okresie.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Budowa</Th>
                  {session.isAdmin && <Th>Pracownik</Th>}
                  <Th>Rodzaj prac</Th>
                  <Th>Opis</Th>
                  <Th align="right">Godziny</Th>
                  <Th>Status</Th>
                  <Th align="right">Akcje</Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const canDelete = session.isAdmin || entry.status === "zgloszony";
                  return (
                    <Tr key={entry.id}>
                      <Td className="tabular-nums">{formatDate(entry.work_date)}</Td>
                      <Td className="font-medium">{entry.projects?.name ?? <Dash />}</Td>
                      {session.isAdmin && <Td>{employeeName(entry.employees)}</Td>}
                      <Td>{entry.work_categories?.name ?? <Dash />}</Td>
                      <Td className="max-w-xs truncate text-muted">
                        {entry.description ? (
                          <span title={entry.description}>{entry.description}</span>
                        ) : (
                          <Dash />
                        )}
                      </Td>
                      <Td align="right" className="font-semibold">
                        {formatHours(Number(entry.hours))}
                      </Td>
                      <Td>
                        <Badge tone={STATUS_TONES[entry.status]}>
                          {TIME_ENTRY_STATUS_LABELS[entry.status]}
                        </Badge>
                      </Td>
                      <Td>
                        <div className="flex items-center justify-end">
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
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
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
