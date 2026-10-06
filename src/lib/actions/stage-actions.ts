"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { firstIssue } from "./helpers";

// Etapy prac (w bazie: tabela work_categories) — słownik zarządzany przez administratora.

const stageSchema = z.object({
  name: z.string().trim().min(1, "Podaj nazwę etapu."),
  sort_order: z
    .number("Kolejność musi być liczbą całkowitą.")
    .int("Kolejność musi być liczbą całkowitą.")
    .min(0, "Kolejność nie może być ujemna."),
});

function duplicateNameError(message: string): string {
  return message.includes("duplicate") || message.includes("unique")
    ? "Etap o takiej nazwie już istnieje."
    : message;
}

function revalidateStages() {
  revalidatePath("/etapy-prac");
  revalidatePath("/czas-pracy");
}

export async function saveStageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session?.isAdmin) return { ok: false, error: "Brak uprawnień." };

  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id") ?? "");

  // Nowy etap bez podanej kolejności trafia na koniec listy.
  const orderInput = String(formData.get("sort_order") ?? "").trim();
  let sortOrder = Number(orderInput);
  if (orderInput === "") {
    const { data: last } = await supabase
      .from("work_categories")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = (last?.sort_order ?? 0) + 10;
  }

  const parsed = stageSchema.safeParse({ name: formData.get("name") ?? "", sort_order: sortOrder });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  if (!id) {
    const { error } = await supabase.from("work_categories").insert(parsed.data);
    if (error) return { ok: false, error: duplicateNameError(error.message) };
    revalidateStages();
    return { ok: true };
  }

  const { error } = await supabase
    .from("work_categories")
    // Zaznaczone „Aktywny” = etap dostępny w nowych raportach.
    .update({ ...parsed.data, is_archived: formData.get("is_active") !== "on" })
    .eq("id", id);
  if (error) return { ok: false, error: duplicateNameError(error.message) };
  revalidateStages();
  redirect("/etapy-prac");
}

// Etapu z zaraportowanymi godzinami usunąć się nie da — raporty straciłyby podział na etapy.
export async function deleteStageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session?.isAdmin) return { ok: false, error: "Brak uprawnień." };

  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Nie znaleziono etapu." };

  const supabase = await createSupabaseServerClient();
  const { count, error: countError } = await supabase
    .from("time_entries")
    .select("id", { count: "exact", head: true })
    .eq("work_category_id", id.data);
  if (countError) return { ok: false, error: countError.message };
  if (count) {
    return {
      ok: false,
      error: `Na ten etap są już wpisy czasu pracy (${count}), więc nie można go usunąć. Możesz go wyłączyć w edycji — zniknie z listy przy nowych raportach.`,
    };
  }

  const { error } = await supabase.from("work_categories").delete().eq("id", id.data);
  if (error) return { ok: false, error: error.message };
  revalidateStages();
  return { ok: true };
}
