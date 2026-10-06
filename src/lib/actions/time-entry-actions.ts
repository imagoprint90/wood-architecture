"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { firstIssue, isoDate, parseDecimal, textOrNull } from "./helpers";

const entrySchema = z.object({
  project_id: z.uuid("Wybierz budowę."),
  employee_id: z.uuid("Wybierz pracownika."),
  work_category_id: z.uuid().nullable(),
  work_date: isoDate,
  hours: z
    .number("Podaj liczbę godzin.")
    .gt(0, "Liczba godzin musi być większa od zera.")
    .max(24, "Doba ma tylko 24 godziny."),
  description: z.string().nullable(),
});

export async function addTimeEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesja wygasła. Zaloguj się ponownie." };

  // Raportujący wpisuje wyłącznie za siebie; administrator wybiera osobę z listy.
  const employeeId = session.isAdmin ? formData.get("employee_id") : session.employeeId;
  if (!employeeId) {
    return {
      ok: false,
      error: session.isAdmin
        ? "Wybierz pracownika."
        : "Twoje konto nie jest powiązane z pracownikiem. Zgłoś to administratorowi.",
    };
  }

  const parsed = entrySchema.safeParse({
    project_id: formData.get("project_id"),
    employee_id: employeeId,
    work_category_id: textOrNull(formData.get("work_category_id")),
    work_date: formData.get("work_date"),
    hours: parseDecimal(formData.get("hours")),
    description: textOrNull(formData.get("description")),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("time_entries").insert({
    ...parsed.data,
    // Wpis wprowadzony przez administratora nie wymaga osobnego zatwierdzenia.
    status: session.isAdmin ? "zatwierdzony" : "zgloszony",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/czas-pracy");
  return { ok: true };
}

// Poniższe akcje są podpinane bezpośrednio pod <form action>, dlatego nic nie zwracają;
// uprawnienia egzekwuje RLS (pracownik: tylko własne, niezatwierdzone wpisy).
export async function deleteTimeEntryAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from("time_entries").delete().eq("id", String(formData.get("id")));
  revalidatePath("/czas-pracy");
}

export async function setTimeEntryStatusAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session?.isAdmin) return;
  const status = z.enum(["zgloszony", "zatwierdzony", "odrzucony"]).safeParse(formData.get("status"));
  if (!status.success) return;
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("time_entries")
    .update({ status: status.data })
    .eq("id", String(formData.get("id")));
  revalidatePath("/czas-pracy");
}
