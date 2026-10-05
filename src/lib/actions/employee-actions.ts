"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/supabase/auth-errors";
import type { ActionState } from "@/lib/types";
import { firstIssue, parseDecimal, textOrNull } from "./helpers";

const employeeSchema = z.object({
  first_name: z.string().trim().min(1, "Podaj imię."),
  last_name: z.string().trim(),
  phone: z.string().nullable(),
  position: z.string().nullable(),
  hourly_rate: z.number("Nieprawidłowa stawka.").min(0, "Stawka nie może być ujemna.").nullable(),
  is_active: z.boolean(),
});

export async function saveEmployeeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session?.isManager) return { ok: false, error: "Brak uprawnień." };

  const parsed = employeeSchema.safeParse({
    first_name: formData.get("first_name") ?? "",
    last_name: formData.get("last_name") ?? "",
    phone: textOrNull(formData.get("phone")),
    position: textOrNull(formData.get("position")),
    hourly_rate: parseDecimal(formData.get("hourly_rate")),
    is_active: formData.get("is_active") === "on",
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id") ?? "");
  const { error } = id
    ? await supabase.from("employees").update(parsed.data).eq("id", id)
    : await supabase.from("employees").insert(parsed.data);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/pracownicy");
  return { ok: true };
}

const accountSchema = z.object({
  employee_id: z.uuid(),
  email: z.email("Podaj prawidłowy adres e-mail."),
  password: z.string().min(8, "Hasło musi mieć co najmniej 8 znaków."),
  role: z.enum(["pracownik", "kierownik", "admin"]),
});

// Zakłada konto logowania dla pracownika (tylko administrator). Hasło startowe podaje
// administrator i przekazuje je pracownikowi.
export async function createEmployeeAccountAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (session?.role !== "admin") return { ok: false, error: "Konta zakłada tylko administrator." };

  const parsed = accountSchema.safeParse({
    employee_id: formData.get("employee_id"),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: formData.get("password") ?? "",
    role: formData.get("role"),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { employee_id, email, password, role } = parsed.data;

  const service = createSupabaseServiceClient();
  const { data: employee, error: employeeError } = await service
    .from("employees")
    .select("id, user_id, first_name, last_name")
    .eq("id", employee_id)
    .maybeSingle();
  if (employeeError) return { ok: false, error: employeeError.message };
  if (!employee) return { ok: false, error: "Nie znaleziono pracownika." };
  if (employee.user_id) return { ok: false, error: "Ten pracownik ma już konto." };

  const fullName = `${employee.first_name} ${employee.last_name}`.trim();
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) {
    const message = createError?.message ?? "";
    if (message.toLowerCase().includes("already")) {
      return { ok: false, error: "Konto z tym adresem e-mail już istnieje." };
    }
    return { ok: false, error: translateAuthError(message) };
  }

  // Profil tworzy trigger handle_new_user — tu tylko rola i powiązanie z pracownikiem.
  const userId = created.user.id;
  const { error: roleError } = await service.from("profiles").update({ role }).eq("id", userId);
  const { error: linkError } = await service
    .from("employees")
    .update({ user_id: userId })
    .eq("id", employee_id);
  const failure = roleError ?? linkError;
  if (failure) {
    await service.auth.admin.deleteUser(userId);
    return { ok: false, error: failure.message };
  }

  revalidatePath("/pracownicy");
  return { ok: true };
}
