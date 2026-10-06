"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id") ?? "");
  const { error } = id
    ? await supabase.from("projects").update(parsed.data).eq("id", id)
    : await supabase.from("projects").insert(parsed.data);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/budowy");
  redirect("/budowy");
}
