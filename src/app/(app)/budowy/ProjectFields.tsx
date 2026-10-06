import type { SupabaseClient } from "@supabase/supabase-js";
import { FormField, inputClass, textareaClass } from "@/components/ui/Form";
import { MemberPicker, type PickerOption } from "@/components/ui/MemberPicker";
import { PROJECT_STATUS_LABELS, type Employee, type Project } from "@/lib/types";

export function ProjectFields({
  project,
  employees,
  memberIds,
}: {
  project?: Project;
  employees: PickerOption[];
  memberIds: string[];
}) {
  return (
    <>
      <FormField label="Nazwa budowy" htmlFor="name" required>
        <input id="name" name="name" required defaultValue={project?.name} className={inputClass} />
      </FormField>
      <FormField label="Status" htmlFor="status" required>
        <select id="status" name="status" defaultValue={project?.status ?? "w_toku"} className={inputClass}>
          {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Adres" htmlFor="address">
        <input id="address" name="address" defaultValue={project?.address ?? ""} className={inputClass} />
      </FormField>
      <FormField label="Inwestor / klient" htmlFor="client_name">
        <input
          id="client_name"
          name="client_name"
          defaultValue={project?.client_name ?? ""}
          className={inputClass}
        />
      </FormField>
      <FormField label="Data rozpoczęcia" htmlFor="start_date">
        <input
          id="start_date"
          name="start_date"
          type="date"
          defaultValue={project?.start_date ?? ""}
          className={inputClass}
        />
      </FormField>
      <FormField label="Data zakończenia" htmlFor="end_date">
        <input
          id="end_date"
          name="end_date"
          type="date"
          defaultValue={project?.end_date ?? ""}
          className={inputClass}
        />
      </FormField>
      <FormField label="Uwagi" htmlFor="notes" full>
        <textarea id="notes" name="notes" rows={3} defaultValue={project?.notes ?? ""} className={textareaClass} />
      </FormField>

      <div className="border-t border-border pt-4 col-span-full">
        <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">
          Przydzieleni pracownicy
        </h3>
        <p className="mt-0.5 mb-2 text-xs text-muted">
          Tylko przydzielone osoby mogą raportować czas pracy na tej budowie.
        </p>
        <MemberPicker
          name="member_ids"
          options={employees}
          defaultSelected={memberIds}
          placeholder="Szukaj pracownika…"
          emptyLabel="Nikt nie jest jeszcze przydzielony do tej budowy."
        />
      </div>
    </>
  );
}

// Dane do listy przydziału: aktywni pracownicy oraz — przy edycji — obecnie przydzieleni
// (także nieaktywni, żeby dało się ich zobaczyć i odpiąć).
export async function loadMemberOptions(
  supabase: SupabaseClient,
  projectId?: string
): Promise<{ employees: PickerOption[]; memberIds: string[] }> {
  const [employeesResult, membersResult] = await Promise.all([
    supabase.from("employees").select("*").order("last_name").order("first_name"),
    projectId
      ? supabase.from("project_members").select("employee_id").eq("project_id", projectId)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (employeesResult.error) throw new Error(employeesResult.error.message);
  // Błąd odczytu przydziałów (np. migracja 0003 jeszcze nie uruchomiona) nie blokuje edycji
  // samej budowy — lista przydzielonych jest wtedy pusta, a zapis zgłosi problem.

  const memberIds = (membersResult.data ?? []).map((m) => m.employee_id as string);
  const employees = ((employeesResult.data ?? []) as Employee[])
    .filter((e) => e.is_active || memberIds.includes(e.id))
    .map((e) => ({
      id: e.id,
      label: `${e.last_name} ${e.first_name}`.trim(),
      hint: e.is_active ? (e.position ?? undefined) : "nieaktywny",
    }));
  return { employees, memberIds };
}
