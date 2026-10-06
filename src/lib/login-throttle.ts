import "server-only";
import { headers } from "next/headers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

// Ochrona przed zgadywaniem haseł: po kilku nieudanych próbach logowanie na dane konto (albo
// z danego adresu IP) jest na chwilę wstrzymywane. Rejestr prób trzyma tabela login_attempts
// (migracja 0007), dostępna wyłącznie dla serwera.

const WINDOW_MINUTES = 15;
// Kolejne nieudane próby na jedno konto, po których logowanie jest wstrzymane.
const MAX_FAILURES_PER_EMAIL = 5;
// Nieudane próby z jednego adresu IP (na dowolne konta) — wyłapuje sprawdzanie wielu kont.
const MAX_FAILURES_PER_IP = 20;
const KEEP_DAYS = 30;

export const LOCKOUT_MESSAGE = `Zbyt wiele nieudanych prób logowania. Odczekaj ${WINDOW_MINUTES} minut i spróbuj ponownie albo poproś administratora o ustawienie nowego hasła.`;

async function clientIp(): Promise<string | null> {
  const headerList = await headers();
  // Vercel wpisuje prawdziwy adres klienta jako pierwszy na liście.
  return headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || headerList.get("x-real-ip");
}

export interface LoginThrottle {
  blocked: boolean;
  record: (succeeded: boolean) => Promise<void>;
}

export async function checkLoginThrottle(email: string): Promise<LoginThrottle> {
  const ip = await clientIp();
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();

  let service;
  try {
    service = createSupabaseServiceClient();
  } catch {
    // Brak klucza serwisowego — logowanie działa, ale bez licznika prób.
    return { blocked: false, record: async () => {} };
  }

  const [byEmail, byIp] = await Promise.all([
    service
      .from("login_attempts")
      .select("succeeded")
      .eq("email", email)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(MAX_FAILURES_PER_EMAIL),
    ip
      ? service
          .from("login_attempts")
          .select("id", { count: "exact", head: true })
          .eq("ip", ip)
          .eq("succeeded", false)
          .gte("created_at", since)
      : Promise.resolve({ count: 0, error: null }),
  ]);

  // Błąd odczytu (np. migracja 0007 jeszcze nie uruchomiona) = brak blokady, bez zapisywania.
  if (byEmail.error || byIp.error) return { blocked: false, record: async () => {} };

  // Liczą się nieudane próby od ostatniego udanego logowania.
  const recent = byEmail.data ?? [];
  const consecutiveFailures = recent.findIndex((attempt) => attempt.succeeded);
  const emailFailures = consecutiveFailures === -1 ? recent.length : consecutiveFailures;
  const blocked = emailFailures >= MAX_FAILURES_PER_EMAIL || (byIp.count ?? 0) >= MAX_FAILURES_PER_IP;

  return {
    blocked,
    record: async (succeeded) => {
      await service.from("login_attempts").insert({ email, ip, succeeded });
      if (succeeded) {
        // Przy okazji udanego logowania sprzątamy stare wpisy, żeby rejestr nie rósł bez końca.
        const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString();
        await service.from("login_attempts").delete().lt("created_at", cutoff);
      }
    },
  };
}
