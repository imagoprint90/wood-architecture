import "server-only";
import { headers } from "next/headers";
import type { AuditAction, AuditArea } from "@/lib/audit-labels";
import { getSession } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

interface Actor {
  id: string | null;
  name: string;
  email: string | null;
}

// Zapisuje zdarzenie w dzienniku (tabela audit_log, migracja 0008). Sprawcą jest zalogowany
// użytkownik, chyba że podano `actor` — np. przy logowaniu, gdy sesji jeszcze nie ma.
// Błąd zapisu nigdy nie przerywa właściwej operacji: dziennik jest dodatkiem, nie warunkiem.
export async function logEvent(event: {
  action: AuditAction;
  area: AuditArea;
  target?: string | null;
  details?: string | null;
  actor?: Actor;
}): Promise<void> {
  try {
    let actor = event.actor;
    if (!actor) {
      const session = await getSession();
      actor = session
        ? { id: session.userId, name: session.fullName, email: session.email }
        : { id: null, name: "—", email: null };
    }
    const headerList = await headers();
    // Vercel wpisuje prawdziwy adres klienta jako pierwszy na liście.
    const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || headerList.get("x-real-ip");

    const { error } = await createSupabaseServiceClient()
      .from("audit_log")
      .insert({
        actor_id: actor.id,
        actor_name: actor.name,
        actor_email: actor.email,
        action: event.action,
        area: event.area,
        target: event.target ?? null,
        details: event.details || null,
        ip: ip ?? null,
        user_agent: headerList.get("user-agent")?.slice(0, 400) ?? null,
      });
    if (error) console.error("Dziennik zdarzeń: zapis nieudany —", error.message);
  } catch (error) {
    // redirect() z getSession (konto dezaktywowane) musi przejść dalej; resztę tylko notujemy.
    if (error && typeof error === "object" && "digest" in error) throw error;
    console.error("Dziennik zdarzeń: zapis nieudany —", error);
  }
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "tak" : "nie";
  if (typeof value === "number") return value.toLocaleString("pl-PL", { maximumFractionDigits: 2 });
  return String(value);
}

// Opis zmian do dziennika: „Godziny: 8 → 7,5; Etap prac: Dach → Rynny”. Porównuje tylko pola
// wymienione w `labels`; zwraca pusty napis, gdy nic się nie zmieniło.
export function describeChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  labels: Record<string, string>
): string {
  return Object.entries(labels)
    .filter(([field]) => show(before[field]) !== show(after[field]))
    .map(([field, label]) => `${label}: ${show(before[field])} → ${show(after[field])}`)
    .join("; ");
}
