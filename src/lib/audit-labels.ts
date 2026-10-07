// Słowniki dziennika zdarzeń — wspólne dla zapisu (serwer) i ekranu Logi.

export const AUDIT_ACTIONS = {
  logowanie: "Logowanie",
  blad_logowania: "Nieudane logowanie",
  blokada_logowania: "Zablokowane logowanie",
  wylogowanie: "Wylogowanie",
  reset_hasla: "Prośba o reset hasła",
  zmiana_hasla: "Zmiana hasła",
  dodanie: "Dodanie",
  zmiana: "Zmiana",
  usuniecie: "Usunięcie",
  zatwierdzenie: "Zatwierdzenie",
  odrzucenie: "Odrzucenie",
  cofniecie: "Cofnięcie decyzji",
  eksport: "Eksport danych",
} as const;

export const AUDIT_AREAS = {
  konto: "Logowanie i konto",
  czas_pracy: "Czas pracy",
  budowy: "Budowy",
  etapy: "Etapy prac",
  uzytkownicy: "Użytkownicy",
  raporty: "Raporty",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;
export type AuditArea = keyof typeof AUDIT_AREAS;

// Kolor plakietki zdarzenia na liście.
export const AUDIT_ACTION_TONES: Record<AuditAction, "neutral" | "success" | "warning" | "danger" | "accent"> = {
  logowanie: "success",
  blad_logowania: "danger",
  blokada_logowania: "danger",
  wylogowanie: "neutral",
  reset_hasla: "warning",
  zmiana_hasla: "warning",
  dodanie: "accent",
  zmiana: "warning",
  usuniecie: "danger",
  zatwierdzenie: "success",
  odrzucenie: "danger",
  cofniecie: "neutral",
  eksport: "neutral",
};

export interface AuditEntry {
  id: number;
  created_at: string;
  actor_id: string | null;
  actor_name: string;
  actor_email: string | null;
  action: string;
  area: string;
  target: string | null;
  details: string | null;
  ip: string | null;
  user_agent: string | null;
}

// „Chrome · Windows” z nagłówka User-Agent — wystarczy, żeby rozpoznać urządzenie.
export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "—";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\/|Opera/.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Inna przeglądarka";
  const system = /Android/.test(userAgent)
    ? "Android"
    : /iPhone|iPad|iPod/.test(userAgent)
      ? "iOS"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS X/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "inny system";
  return `${browser} · ${system}`;
}
