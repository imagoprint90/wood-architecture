"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/supabase/auth-errors";
import type { ActionState, AppRole } from "@/lib/types";
import { firstIssue, parseDecimal, textOrNull } from "./helpers";

// Użytkownik = rekord w `employees` (dane osoby, stawka) + konto logowania z rolą w
// `profiles`. Wszystkim tu zarządza wyłącznie administrator.

const personSchema = z.object({
  first_name: z.string().trim().min(1, "Podaj imię."),
  last_name: z.string().trim(),
  phone: z.string().nullable(),
  position: z.string().nullable(),
  hourly_rate: z.number("Nieprawidłowa stawka.").min(0, "Stawka nie może być ujemna.").nullable(),
  is_active: z.boolean(),
});

const credentialsSchema = z.object({
  email: z.email("Podaj prawidłowy adres e-mail."),
  password: z.string().min(8, "Hasło musi mieć co najmniej 8 znaków."),
  role: z.enum(["admin", "pracownik"], "Wybierz rolę."),
});

function readPerson(formData: FormData, isActive: boolean) {
  return personSchema.safeParse({
    first_name: formData.get("first_name") ?? "",
    last_name: formData.get("last_name") ?? "",
    phone: textOrNull(formData.get("phone")),
    position: textOrNull(formData.get("position")),
    hourly_rate: parseDecimal(formData.get("hourly_rate")),
    is_active: isActive,
  });
}

function readCredentials(formData: FormData) {
  return credentialsSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: formData.get("password") ?? "",
    role: formData.get("role"),
  });
}

// Zakłada konto logowania i ustawia mu rolę. Profil tworzy trigger handle_new_user.
async function createAccount(
  credentials: z.infer<typeof credentialsSchema>,
  fullName: string
): Promise<{ userId: string } | { error: string }> {
  const service = createSupabaseServiceClient();
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email: credentials.email,
    password: credentials.password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) {
    const message = createError?.message ?? "";
    if (message.toLowerCase().includes("already")) {
      return { error: "Konto z tym adresem e-mail już istnieje." };
    }
    return { error: translateAuthError(message) };
  }

  const userId = created.user.id;
  const { error: roleError } = await service
    .from("profiles")
    .update({ role: credentials.role, full_name: fullName })
    .eq("id", userId);
  if (roleError) {
    await service.auth.admin.deleteUser(userId);
    return { error: roleError.message };
  }
  return { userId };
}

// Nowy użytkownik: dane osoby + konto z rolą w jednym kroku.
export async function createUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session?.isAdmin) return { ok: false, error: "Użytkowników dodaje tylko administrator." };

  const person = readPerson(formData, true);
  if (!person.success) return { ok: false, error: firstIssue(person.error) };
  const credentials = readCredentials(formData);
  if (!credentials.success) return { ok: false, error: firstIssue(credentials.error) };

  const fullName = `${person.data.first_name} ${person.data.last_name}`.trim();
  const account = await createAccount(credentials.data, fullName);
  if ("error" in account) return { ok: false, error: account.error };

  const service = createSupabaseServiceClient();
  const { error } = await service.from("employees").insert({ ...person.data, user_id: account.userId });
  if (error) {
    await service.auth.admin.deleteUser(account.userId);
    return { ok: false, error: error.message };
  }

  revalidatePath("/uzytkownicy");
  return { ok: true };
}

// Edycja danych osoby oraz (jeśli ma konto) jej roli.
export async function updateUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session?.isAdmin) return { ok: false, error: "Brak uprawnień." };

  const id = String(formData.get("id") ?? "");
  const person = readPerson(formData, formData.get("is_active") === "on");
  if (!person.success) return { ok: false, error: firstIssue(person.error) };

  const supabase = await createSupabaseServerClient();
  const { data: employee, error: updateError } = await supabase
    .from("employees")
    .update(person.data)
    .eq("id", id)
    .select("user_id")
    .maybeSingle();
  if (updateError) return { ok: false, error: updateError.message };
  if (!employee) return { ok: false, error: "Nie znaleziono użytkownika." };

  const roleInput = z.enum(["admin", "pracownik"]).safeParse(formData.get("role"));
  if (employee.user_id && roleInput.success) {
    const role: AppRole = roleInput.data;
    // Administrator nie odbiera uprawnień sam sobie — inaczej mógłby zostać system bez admina.
    if (employee.user_id === session.userId && role !== "admin") {
      return { ok: false, error: "Nie możesz odebrać roli administratora własnemu kontu." };
    }
    const fullName = `${person.data.first_name} ${person.data.last_name}`.trim();
    const { error: roleError } = await supabase
      .from("profiles")
      .update({ role, full_name: fullName })
      .eq("id", employee.user_id);
    if (roleError) return { ok: false, error: roleError.message };
  }

  revalidatePath("/uzytkownicy");
  return { ok: true };
}

// Dla osób dodanych wcześniej bez konta: dokłada konto logowania do istniejącego rekordu.
export async function createEmployeeAccountAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session?.isAdmin) return { ok: false, error: "Konta zakłada tylko administrator." };

  const employeeId = z.uuid().safeParse(formData.get("employee_id"));
  if (!employeeId.success) return { ok: false, error: "Nie znaleziono użytkownika." };
  const credentials = readCredentials(formData);
  if (!credentials.success) return { ok: false, error: firstIssue(credentials.error) };

  const service = createSupabaseServiceClient();
  const { data: employee, error: employeeError } = await service
    .from("employees")
    .select("id, user_id, first_name, last_name")
    .eq("id", employeeId.data)
    .maybeSingle();
  if (employeeError) return { ok: false, error: employeeError.message };
  if (!employee) return { ok: false, error: "Nie znaleziono użytkownika." };
  if (employee.user_id) return { ok: false, error: "Ta osoba ma już konto." };

  const fullName = `${employee.first_name} ${employee.last_name}`.trim();
  const account = await createAccount(credentials.data, fullName);
  if ("error" in account) return { ok: false, error: account.error };

  const { error } = await service
    .from("employees")
    .update({ user_id: account.userId })
    .eq("id", employee.id);
  if (error) {
    await service.auth.admin.deleteUser(account.userId);
    return { ok: false, error: error.message };
  }

  revalidatePath("/uzytkownicy");
  return { ok: true };
}
