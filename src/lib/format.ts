export function employeeName(e: { first_name: string; last_name: string } | null | undefined): string {
  if (!e) return "—";
  return `${e.first_name} ${e.last_name}`.trim();
}

export function formatHours(hours: number): string {
  return `${hours.toLocaleString("pl-PL", { maximumFractionDigits: 2 })} h`;
}

export function formatMoney(amount: number): string {
  return amount.toLocaleString("pl-PL", { style: "currency", currency: "PLN" });
}

// "2026-10-05" -> "05.10.2026"
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

// Znacznik czasu z bazy -> "05.10.2026, 14:32" w czasie polskim.
export function formatDateTime(timestamp: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

// Dzisiejsza data w Polsce jako "RRRR-MM-DD" (serwer Vercela działa w UTC).
export function todayIso(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date());
}

// Pierwszy i ostatni dzień miesiąca "RRRR-MM".
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isIsoMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
