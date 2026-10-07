"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { describeChanges, logEvent } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { formatDate, formatHours, todayIso } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { DEFAULT_REPORT_DAYS_BACK, daysBackLabel, earliestReportDate } from "@/lib/workdays";
import { firstIssue, isoDate, textOrNull } from "./helpers";

const MAX_HOURS_PER_DAY = 24;

const entrySchema = z.object({
  project_id: z.uuid("Wybierz budowę."),
  employee_id: z.uuid("Wybierz pracownika."),
  work_category_id: z.uuid("Wybierz etap prac."),
  work_date: isoDate,
  hours: z
    .number("Podaj liczbę godzin.")
    .gt(0, "Liczba godzin musi być większa od zera.")
    .max(MAX_HOURS_PER_DAY, "W jednym raporcie można wpisać najwyżej 24 godziny."),
  description: z.string().nullable(),
});

type EntryInput = z.infer<typeof entrySchema>;

// Liczba godzin z formularza: wyłącznie cyfry i przecinek (np. „8” albo „7,5”). Wszystko inne
// daje NaN, które odrzuci walidacja — pole w przeglądarce i tak nie przyjmuje innych znaków.
function parseHours(value: FormDataEntryValue | null): number {
  const text = String(value ?? "").trim();
  return /^\d{1,2}(,\d{1,2})?$/.test(text) ? Number(text.replace(",", ".")) : NaN;
}

function readEntry(formData: FormData, employeeId: FormDataEntryValue | null) {
  return entrySchema.safeParse({
    project_id: formData.get("project_id"),
    employee_id: employeeId,
    work_category_id: formData.get("work_category_id"),
    work_date: formData.get("work_date"),
    hours: parseHours(formData.get("hours")),
    description: textOrNull(formData.get("description")),
  });
}

// Reguły wspólne dla dodawania i edycji; zwraca komunikat błędu albo null.
//  - jeden raport na dzień na danej budowie i etapie (odrzucone się nie liczą),
//  - łącznie nie więcej niż 24 h jednego dnia na wszystkich budowach.
// `ignoreId` — edytowany wpis, którego nie porównujemy z samym sobą.
async function checkDayRules(
  supabase: SupabaseClient,
  entry: EntryInput,
  ownReport: boolean,
  ignoreId?: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("time_entries")
    .select("id, project_id, work_category_id, hours, projects(name), work_categories(name)")
    .eq("employee_id", entry.employee_id)
    .eq("work_date", entry.work_date)
    .neq("status", "odrzucony");
  if (error) return error.message;

  const sameDay = (data ?? []).filter((row) => row.id !== ignoreId);
  const day = formatDate(entry.work_date);
  const who = ownReport ? "Masz już" : "Ten pracownik ma już";

  const duplicate = sameDay.find(
    (row) => row.project_id === entry.project_id && row.work_category_id === entry.work_category_id
  );
  if (duplicate) {
    const project = (duplicate.projects as unknown as { name: string } | null)?.name ?? "—";
    const stage = (duplicate.work_categories as unknown as { name: string } | null)?.name ?? "—";
    return `${who} raport z dnia ${day} na budowie „${project}” dla etapu „${stage}” (${formatHours(
      Number(duplicate.hours)
    )}). Ten sam etap na tej samej budowie można zaraportować tylko raz dziennie${
      ownReport ? " — jeśli godziny wymagają poprawy, zgłoś to administratorowi." : " — popraw istniejący raport."
    }`;
  }

  const otherHours = sameDay.reduce((sum, row) => sum + Number(row.hours), 0);
  if (otherHours + entry.hours > MAX_HOURS_PER_DAY) {
    return `${who} ${formatHours(otherHours)} zaraportowane w dniu ${day}. Razem z tym raportem byłoby ${formatHours(
      otherHours + entry.hours
    )}, a doba ma 24 godziny.`;
  }
  return null;
}

// Naruszenie unikalności w bazie (dwa zapisy w tej samej chwili) — ten sam komunikat co wyżej.
function databaseError(error: { code?: string; message: string }): string {
  return error.code === "23505"
    ? "Raport dla tego etapu na tej budowie z tego dnia już istnieje. Ten sam etap na tej samej budowie można zaraportować tylko raz dziennie."
    : error.message;
}

// Wpis z nazwami zamiast identyfikatorów — do opisów w dzienniku zdarzeń.
const ENTRY_SELECT =
  "id, work_date, hours, description, status, projects(name), employees(first_name, last_name), work_categories(name)";

interface EntryRow {
  work_date: string;
  hours: number;
  description: string | null;
  status: string;
  projects: { name: string } | null;
  employees: { first_name: string; last_name: string } | null;
  work_categories: { name: string } | null;
}

// „Nowak Jan, 06.10.2026, Dom Kowalskich” — czego dotyczy zdarzenie.
function entryTarget(row: EntryRow): string {
  const who = row.employees ? `${row.employees.last_name} ${row.employees.first_name}`.trim() : "—";
  return `${who}, ${formatDate(row.work_date)}, ${row.projects?.name ?? "—"}`;
}

function entryFields(row: EntryRow): Record<string, unknown> {
  return {
    project: row.projects?.name ?? null,
    stage: row.work_categories?.name ?? null,
    date: formatDate(row.work_date),
    hours: Number(row.hours),
    description: row.description,
  };
}

const ENTRY_FIELD_LABELS = {
  project: "Budowa",
  stage: "Etap prac",
  date: "Data",
  hours: "Godziny",
  description: "Opis",
};

function entrySummary(row: EntryRow): string {
  return `${row.work_categories?.name ?? "bez etapu"}, ${formatHours(Number(row.hours))}`;
}

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

  const parsed = readEntry(formData, employeeId);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createSupabaseServerClient();
  if (!session.isAdmin) {
    // Regułę egzekwuje baza (RLS); tu tylko czytelny komunikat zamiast błędu uprawnień.
    const { data: membership, error: membershipError } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("project_id", parsed.data.project_id)
      .eq("employee_id", parsed.data.employee_id)
      .maybeSingle();
    if (!membershipError && !membership) {
      return { ok: false, error: "Nie jesteś przydzielony do tej budowy. Zgłoś to administratorowi." };
    }

    // Okno raportowania: ile dni roboczych wstecz wolno temu pracownikowi raportować.
    // Błąd odczytu (np. brak migracji 0006) = wartość domyślna.
    const { data: settings } = await supabase
      .from("employees")
      .select("report_days_back")
      .eq("id", parsed.data.employee_id)
      .maybeSingle();
    const daysBack = settings?.report_days_back ?? DEFAULT_REPORT_DAYS_BACK;
    const today = todayIso();
    const earliest = earliestReportDate(today, daysBack);
    if (parsed.data.work_date > today) {
      return { ok: false, error: "Nie można raportować czasu pracy z przyszłą datą." };
    }
    if (parsed.data.work_date < earliest) {
      return {
        ok: false,
        error: `Termin na raport z dnia ${formatDate(parsed.data.work_date)} już minął. Możesz raportować najwcześniej za ${formatDate(
          earliest
        )} (${daysBackLabel(daysBack)}). Jeśli raport jest potrzebny, zgłoś to administratorowi.`,
      };
    }
  }

  const ruleError = await checkDayRules(supabase, parsed.data, parsed.data.employee_id === session.employeeId);
  if (ruleError) return { ok: false, error: ruleError };

  const { data: created, error } = await supabase
    .from("time_entries")
    .insert({
      ...parsed.data,
      // Wpis wprowadzony przez administratora nie wymaga osobnego zatwierdzenia.
      status: session.isAdmin ? "zatwierdzony" : "zgloszony",
    })
    .select(ENTRY_SELECT)
    .single();
  if (error) return { ok: false, error: databaseError(error) };
  const createdRow = created as unknown as EntryRow;
  await logEvent({
    action: "dodanie",
    area: "czas_pracy",
    target: entryTarget(createdRow),
    details: entrySummary(createdRow),
  });

  revalidatePath("/czas-pracy");
  return { ok: true };
}

// Edycja raportu przez administratora. Zapisuje, kto i kiedy go zmienił — raportujący widzi
// tę informację na swojej liście.
export async function updateTimeEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session?.isAdmin) return { ok: false, error: "Raporty może edytować tylko administrator." };

  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Nie znaleziono raportu." };

  const supabase = await createSupabaseServerClient();
  const { data: current, error: currentError } = await supabase
    .from("time_entries")
    .select(`employee_id, ${ENTRY_SELECT}`)
    .eq("id", id.data)
    .maybeSingle<EntryRow & { employee_id: string }>();
  if (currentError) return { ok: false, error: currentError.message };
  if (!current) return { ok: false, error: "Nie znaleziono raportu." };

  // Pracownika nie zmieniamy — raport zostaje przy osobie, która go złożyła.
  const parsed = readEntry(formData, current.employee_id);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  if (current.status !== "odrzucony") {
    const ruleError = await checkDayRules(
      supabase,
      parsed.data,
      parsed.data.employee_id === session.employeeId,
      id.data
    );
    if (ruleError) return { ok: false, error: ruleError };
  }

  const { data: updated, error } = await supabase
    .from("time_entries")
    .update({
      ...parsed.data,
      edited_by: session.userId,
      edited_by_name: session.fullName,
      edited_at: new Date().toISOString(),
    })
    .eq("id", id.data)
    .select(ENTRY_SELECT)
    .single();
  if (error) return { ok: false, error: databaseError(error) };
  const updatedRow = updated as unknown as EntryRow;
  await logEvent({
    action: "zmiana",
    area: "czas_pracy",
    target: entryTarget(updatedRow),
    details: describeChanges(entryFields(current), entryFields(updatedRow), ENTRY_FIELD_LABELS) || "Zapis bez zmian.",
  });

  revalidatePath("/czas-pracy");
  redirect("/czas-pracy");
}

// Poniższe akcje są podpinane bezpośrednio pod <form action>, dlatego nic nie zwracają;
// uprawnienia egzekwuje RLS (pracownik: tylko własne, niezatwierdzone wpisy).
export async function deleteTimeEntryAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const supabase = await createSupabaseServerClient();
  // RLS zwraca usunięty wiersz tylko wtedy, gdy usunięcie było dozwolone i faktycznie nastąpiło.
  const { data: removed } = await supabase
    .from("time_entries")
    .delete()
    .eq("id", String(formData.get("id")))
    .select(ENTRY_SELECT)
    .maybeSingle();
  if (removed) {
    const removedRow = removed as unknown as EntryRow;
    await logEvent({
      action: "usuniecie",
      area: "czas_pracy",
      target: entryTarget(removedRow),
      details: entrySummary(removedRow),
    });
  }
  revalidatePath("/czas-pracy");
}

export async function setTimeEntryStatusAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session?.isAdmin) return;
  const status = z.enum(["zgloszony", "zatwierdzony", "odrzucony"]).safeParse(formData.get("status"));
  if (!status.success) return;
  const supabase = await createSupabaseServerClient();
  const { data: changed } = await supabase
    .from("time_entries")
    .update({ status: status.data })
    .eq("id", String(formData.get("id")))
    .select(ENTRY_SELECT)
    .maybeSingle();
  if (changed) {
    const changedRow = changed as unknown as EntryRow;
    await logEvent({
      action:
        status.data === "zatwierdzony" ? "zatwierdzenie" : status.data === "odrzucony" ? "odrzucenie" : "cofniecie",
      area: "czas_pracy",
      target: entryTarget(changedRow),
      details: entrySummary(changedRow),
    });
  }
  revalidatePath("/czas-pracy");
}
