import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ui/ActionForm";
import { BackLink } from "@/components/ui/BackLink";
import { buttonClass } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Card";
import { FormField, inputClass, textareaClass } from "@/components/ui/Form";
import { HoursInput } from "@/components/ui/HoursInput";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { updateTimeEntryAction } from "@/lib/actions/time-entry-actions";
import { requireAdmin } from "@/lib/auth";
import { employeeName, formatDate, formatDateTime, todayIso } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Project, TimeEntry, WorkCategory } from "@/lib/types";

// Edycja raportu czasu pracy — tylko administrator. Po zapisie raportujący widzi na swojej
// liście, że raport został zmodyfikowany, przez kogo i kiedy.
export default async function EdycjaRaportuPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createSupabaseServerClient();
  const [entryResult, projectsResult, stagesResult] = await Promise.all([
    supabase
      .from("time_entries")
      .select("*, projects(name), employees(first_name, last_name), work_categories(name)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("projects").select("*").order("name"),
    supabase.from("work_categories").select("*").order("sort_order").order("name"),
  ]);
  const loadError = entryResult.error ?? projectsResult.error ?? stagesResult.error;
  if (loadError) throw new Error(loadError.message);
  if (!entryResult.data) notFound();

  const entry = entryResult.data as TimeEntry;
  const projects = (projectsResult.data ?? []) as Project[];
  // Wyłączony etap zostaje na liście tylko wtedy, gdy raport już go używa.
  const stages = ((stagesResult.data ?? []) as WorkCategory[]).filter(
    (s) => !s.is_archived || s.id === entry.work_category_id
  );

  return (
    <>
      <PageHeader
        title={`Raport: ${employeeName(entry.employees)}, ${formatDate(entry.work_date)}`}
        description={
          entry.edited_at
            ? `Ostatnio zmodyfikowany: ${entry.edited_by_name ?? "administrator"}, ${formatDateTime(entry.edited_at)}`
            : "Edycja raportu czasu pracy"
        }
        back={<BackLink href="/czas-pracy">Czas pracy</BackLink>}
      />
      <Card className="max-w-[60rem]">
        <ActionForm
          action={updateTimeEntryAction}
          submitLabel="Zapisz zmiany"
          secondaryAction={
            <Link href="/czas-pracy" className={buttonClass("ghost")}>
              Anuluj
            </Link>
          }
          className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2"
        >
          <input type="hidden" name="id" value={entry.id} />
          <FormField label="Pracownik" htmlFor="employee">
            <input id="employee" value={employeeName(entry.employees)} disabled readOnly className={inputClass} />
          </FormField>
          <FormField label="Budowa" htmlFor="project_id" required>
            <select id="project_id" name="project_id" required defaultValue={entry.project_id} className={inputClass}>
              {projects.map((p) => (
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
              options={stages.map((s) => ({ id: s.id, label: s.name }))}
              defaultValue={entry.work_category_id ?? ""}
            />
          </FormField>
          <FormField label="Data" htmlFor="work_date" required>
            <input
              id="work_date"
              name="work_date"
              type="date"
              required
              max={todayIso()}
              defaultValue={entry.work_date}
              className={inputClass}
            />
          </FormField>
          <FormField label="Liczba godzin" htmlFor="hours" required>
            <HoursInput
              id="hours"
              name="hours"
              required
              defaultValue={String(Number(entry.hours)).replace(".", ",")}
            />
          </FormField>
          <FormField label="Opis wykonanych prac" htmlFor="description" full>
            <textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={entry.description ?? ""}
              className={textareaClass}
            />
          </FormField>
          <p className="text-xs text-muted sm:col-span-2">
            Po zapisaniu pracownik zobaczy przy tym raporcie informację, że został zmodyfikowany — z Twoim
            imieniem i nazwiskiem oraz datą zmiany.
          </p>
        </ActionForm>
      </Card>
    </>
  );
}
