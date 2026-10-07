"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { describeChanges, logEvent } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/supabase/auth-errors";
import { ROLE_LABELS, type ActionState, type AppRole } from "@/lib/types";
import { DEFAULT_REPORT_DAYS_BACK } from "@/lib/workdays";
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
  report_days_back: z
    .number("Liczba dni wstecz musi być liczbą całkowitą.")
    .int("Liczba dni wstecz musi być liczbą całkowitą.")
    .min(0, "Liczba dni wstecz nie może być ujemna.")
    .max(365, "Liczba dni wstecz może wynosić najwyżej 365."),
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
    // Puste pole = wartość domyślna (raport do końca następnego dnia roboczego).
    report_days_back: Number(String(formData.get("report_days_back") ?? "").trim() || DEFAULT_REPORT_DAYS_BACK),
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

  await logEvent({
    action: "dodanie",
    area: "uzytkownicy",
    target: fullName,
    details: `Konto: ${credentials.data.email}; rola: ${ROLE_LABELS[credentials.data.role]}`,
  });
  revalidatePath("/uzytkownicy");
  redirect("/uzytkownicy");
}

// Edycja danych osoby oraz (jeśli ma konto) jej roli i możliwości logowania.
export async function updateUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session?.isAdmin) return { ok: false, error: "Brak uprawnień." };

  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Nie znaleziono użytkownika." };
  const person = readPerson(formData, formData.get("is_active") === "on");
  if (!person.success) return { ok: false, error: firstIssue(person.error) };
  const roleInput = z.enum(["admin", "pracownik"]).safeParse(formData.get("role"));

  const supabase = await createSupabaseServerClient();
  const { data: current, error: currentError } = await supabase
    .from("employees")
    .select("*")
    .eq("id", id.data)
    .maybeSingle();
  if (currentError) return { ok: false, error: currentError.message };
  if (!current) return { ok: false, error: "Nie znaleziono użytkownika." };
  const { data: profileBefore } = current.user_id
    ? await supabase.from("profiles").select("role").eq("id", current.user_id).maybeSingle()
    : { data: null };

  // Administrator nie odbiera dostępu sam sobie — inaczej mógłby zostać system bez admina.
  if (current.user_id === session.userId) {
    if (roleInput.success && roleInput.data !== "admin") {
      return { ok: false, error: "Nie możesz odebrać roli administratora własnemu kontu." };
    }
    if (!person.data.is_active) {
      return { ok: false, error: "Nie możesz dezaktywować własnego konta." };
    }
  }

  const { error: updateError } = await supabase.from("employees").update(person.data).eq("id", id.data);
  if (updateError) return { ok: false, error: updateError.message };

  if (current.user_id) {
    const service = createSupabaseServiceClient();
    // Nieaktywny użytkownik nie może się logować (blokada konta); aktywny — blokada zdjęta.
    const { error: banError } = await service.auth.admin.updateUserById(current.user_id, {
      ban_duration: person.data.is_active ? "none" : "876000h",
    });
    if (banError) return { ok: false, error: banError.message };

    if (roleInput.success) {
      const role: AppRole = roleInput.data;
      const fullName = `${person.data.first_name} ${person.data.last_name}`.trim();
      const { error: roleError } = await supabase
        .from("profiles")
        .update({ role, full_name: fullName })
        .eq("id", current.user_id);
      if (roleError) return { ok: false, error: roleError.message };
    }
  }

  const roleLabel = (role: unknown) => (role === "admin" ? ROLE_LABELS.admin : ROLE_LABELS.pracownik);
  const changes = describeChanges(
    { ...current, role: profileBefore ? roleLabel(profileBefore.role) : null },
    {
      ...person.data,
      role: current.user_id && roleInput.success ? roleLabel(roleInput.data) : profileBefore ? roleLabel(profileBefore.role) : null,
    },
    {
      first_name: "Imię",
      last_name: "Nazwisko",
      position: "Stanowisko",
      phone: "Telefon",
      hourly_rate: "Stawka",
      report_days_back: "Dni wstecz",
      is_active: "Aktywny",
      role: "Rola",
    }
  );
  if (changes) {
    await logEvent({
      action: "zmiana",
      area: "uzytkownicy",
      target: `${person.data.first_name} ${person.data.last_name}`.trim(),
      details: changes,
    });
  }

  revalidatePath("/uzytkownicy");
  redirect("/uzytkownicy");
}

// Usuwa użytkownika razem z kontem logowania. Osoby, która ma już wpisy czasu pracy, usunąć
// się nie da (historia godzin i kosztów musi zostać) — takie konto należy dezaktywować.
export async function deleteUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session?.isAdmin) return { ok: false, error: "Brak uprawnień." };

  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Nie znaleziono użytkownika." };

  const service = createSupabaseServiceClient();
  const { data: employee, error: employeeError } = await service
    .from("employees")
    .select("user_id, first_name, last_name")
    .eq("id", id.data)
    .maybeSingle();
  if (employeeError) return { ok: false, error: employeeError.message };
  if (!employee) return { ok: false, error: "Nie znaleziono użytkownika." };
  if (employee.user_id === session.userId) {
    return { ok: false, error: "Nie możesz usunąć własnego konta." };
  }

  const { count, error: countError } = await service
    .from("time_entries")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", id.data);
  if (countError) return { ok: false, error: countError.message };
  if (count) {
    return {
      ok: false,
      error: `Ten użytkownik ma wpisy czasu pracy (${count}), więc nie można go usunąć. Zamiast tego odznacz „Aktywny” w edycji — straci możliwość logowania, a historia zostanie.`,
    };
  }

  const { error: deleteError } = await service.from("employees").delete().eq("id", id.data);
  if (deleteError) return { ok: false, error: deleteError.message };
  await logEvent({
    action: "usuniecie",
    area: "uzytkownicy",
    target: `${employee.first_name} ${employee.last_name}`.trim(),
    details: employee.user_id ? "Usunięto razem z kontem logowania." : "Osoba bez konta logowania.",
  });
  if (employee.user_id) {
    const { error: accountError } = await service.auth.admin.deleteUser(employee.user_id);
    if (accountError) {
      return {
        ok: false,
        error: `Użytkownik został usunięty z listy, ale konta logowania nie udało się skasować: ${accountError.message}`,
      };
    }
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

  await logEvent({
    action: "dodanie",
    area: "uzytkownicy",
    target: fullName,
    details: `Założono konto logowania: ${credentials.data.email}; rola: ${ROLE_LABELS[credentials.data.role]}`,
  });
  revalidatePath("/uzytkownicy");
  return { ok: true };
}

// Administrator ustawia nowe hasło innemu użytkownikowi (np. gdy ten je zapomniał i nie ma
// dostępu do skrzynki). Nowe hasło przekazuje mu osobiście.
export async function setUserPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session?.isAdmin) return { ok: false, error: "Hasła innych osób zmienia tylko administrator." };

  const id = z.uuid().safeParse(formData.get("employee_id"));
  if (!id.success) return { ok: false, error: "Nie znaleziono użytkownika." };
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { ok: false, error: "Hasło musi mieć co najmniej 8 znaków." };
  if (password !== confirm) return { ok: false, error: "Hasła nie są identyczne." };

  const service = createSupabaseServiceClient();
  const { data: employee, error: employeeError } = await service
    .from("employees")
    .select("user_id, first_name, last_name")
    .eq("id", id.data)
    .maybeSingle();
  if (employeeError) return { ok: false, error: employeeError.message };
  if (!employee?.user_id) return { ok: false, error: "Ta osoba nie ma konta do logowania." };

  const { error } = await service.auth.admin.updateUserById(employee.user_id, { password });
  if (error) return { ok: false, error: translateAuthError(error.message) };
  await logEvent({
    action: "zmiana_hasla",
    area: "uzytkownicy",
    target: `${employee.first_name} ${employee.last_name}`.trim(),
    details: "Administrator ustawił nowe hasło.",
  });
  return { ok: true };
}
