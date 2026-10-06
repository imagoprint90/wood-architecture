"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { firstIssue, isoDate, textOrNull } from "./helpers";

const projectSchema = z.object({
  name: z.string().trim().min(1, "Podaj nazwę budowy."),
  address: z.string().nullable(),
  client_name: z.string().nullable(),
  status: z.enum(["planowana", "w_toku", "wstrzymana", "zakonczona"]),
  start_date: isoDate.nullable(),
  end_date: isoDate.nullable(),
  notes: z.string().nullable(),
});

// Doprowadza przydział do stanu z formularza: odpina nieobecnych na liście, dopina nowych.
// Zwraca komunikat błędu albo null.
async function syncProjectMembers(
  supabase: SupabaseClient,
  projectId: string,
  employeeIds: string[]
): Promise<string | null> {
  let removal = supabase.from("project_members").delete().eq("project_id", projectId);
  if (employeeIds.length > 0) removal = removal.not("employee_id", "in", `(${employeeIds.join(",")})`);
  const { error: removeError } = await removal;
  if (removeError) return removeError.message;

  if (employeeIds.length === 0) return null;
  const { error: addError } = await supabase.from("project_members").upsert(
    employeeIds.map((employee_id) => ({ project_id: projectId, employee_id })),
    { onConflict: "project_id,employee_id", ignoreDuplicates: true }
  );
  return addError?.message ?? null;
}

export async function saveProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session?.isAdmin) return { ok: false, error: "Brak uprawnień." };

  const parsed = projectSchema.safeParse({
    name: formData.get("name") ?? "",
    address: textOrNull(formData.get("address")),
    client_name: textOrNull(formData.get("client_name")),
    status: formData.get("status"),
    start_date: textOrNull(formData.get("start_date")),
    end_date: textOrNull(formData.get("end_date")),
    notes: textOrNull(formData.get("notes")),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { start_date, end_date } = parsed.data;
  if (start_date && end_date && end_date < start_date) {
    return { ok: false, error: "Data zakończenia nie może być wcześniejsza niż data rozpoczęcia." };
  }
  const memberIds = z.array(z.uuid()).safeParse(formData.getAll("member_ids"));
  if (!memberIds.success) return { ok: false, error: "Nieprawidłowa lista przydzielonych pracowników." };

  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id") ?? "");
  const { data: saved, error } = id
    ? await supabase.from("projects").update(parsed.data).eq("id", id).select("id").maybeSingle()
    : await supabase.from("projects").insert(parsed.data).select("id").single();
  if (error) return { ok: false, error: error.message };
  if (!saved) return { ok: false, error: "Nie znaleziono budowy." };

  const memberError = await syncProjectMembers(supabase, saved.id, memberIds.data);
  if (memberError) {
    return { ok: false, error: `Budowa została zapisana, ale przydział pracowników nie: ${memberError}` };
  }

  revalidatePath("/budowy");
  revalidatePath("/czas-pracy");
  redirect("/budowy");
}
