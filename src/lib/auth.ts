import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types";

export interface SessionContext {
  userId: string;
  email: string | null;
  fullName: string;
  role: AppRole;
  isAdmin: boolean;
  // Rekord pracownika powiązany z kontem (null = konto bez przypisanego pracownika).
  employeeId: string | null;
}

// Zalogowany użytkownik z rolą — jedno zapytanie na żądanie, niezależnie od liczby wywołań.
export const getSession = cache(async (): Promise<SessionContext | null> => {
  // Sesja zależy od żądania — nie próbuj renderować stron statycznie podczas builda.
  await connection();
  // Bez kluczy Supabase traktujemy każdego jak niezalogowanego; /logowanie pokaże instrukcję.
  if (!isSupabaseConfigured()) return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle(),
    supabase
      .from("employees")
      .select("id, first_name, last_name, is_active")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  // Konto dezaktywowane przez administratora traci dostęp od razu, a nie dopiero gdy wygaśnie
  // jego sesja (blokada logowania w Supabase działa z opóźnieniem do godziny).
  if (employee && !employee.is_active) redirect("/auth/wyloguj");

  const role: AppRole = profile?.role === "admin" ? "admin" : "pracownik";
  const employeeFullName = employee ? `${employee.first_name} ${employee.last_name}`.trim() : "";
  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name || employeeFullName || user.email || "",
    role,
    isAdmin: role === "admin",
    employeeId: employee?.id ?? null,
  };
});

export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/logowanie");
  return session;
}

export async function requireAdmin(): Promise<SessionContext> {
  const session = await requireSession();
  if (!session.isAdmin) redirect("/czas-pracy");
  return session;
}
