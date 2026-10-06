import { polishHolidays } from "@/lib/holidays";

export const DEFAULT_REPORT_DAYS_BACK = 1;

function isWorkday(date: Date, holidaysByYear: Map<number, Map<string, string>>): boolean {
  const weekday = date.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  const year = date.getUTCFullYear();
  if (!holidaysByYear.has(year)) holidaysByYear.set(year, polishHolidays(year));
  return !holidaysByYear.get(year)!.has(date.toISOString().slice(0, 10));
}

// Najwcześniejsza data, za którą wolno dziś złożyć raport, gdy limit to `daysBack` dni
// roboczych wstecz (pon.–pt. bez świąt). Przykład: dziś wtorek 6.10, limit 3 → czwartek 1.10
// (liczone: pon. 5.10, pt. 2.10, czw. 1.10). Limit 0 → tylko dziś. Weekend i święta leżące
// po tej dacie też są dozwolone — liczy się tylko, jak daleko wstecz sięga okno.
export function earliestReportDate(today: string, daysBack: number): string {
  const [y, m, d] = today.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const holidaysByYear = new Map<number, Map<string, string>>();
  let remaining = Math.max(0, Math.floor(daysBack));
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() - 1);
    if (isWorkday(date, holidaysByYear)) remaining--;
  }
  return date.toISOString().slice(0, 10);
}

export function daysBackLabel(daysBack: number): string {
  if (daysBack === 0) return "tylko za bieżący dzień";
  if (daysBack === 1) return "1 dzień roboczy wstecz";
  const few = daysBack % 10 >= 2 && daysBack % 10 <= 4 && !(daysBack % 100 >= 12 && daysBack % 100 <= 14);
  return `${daysBack} ${few ? "dni robocze" : "dni roboczych"} wstecz`;
}
