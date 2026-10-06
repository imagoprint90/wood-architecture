// Dni ustawowo wolne od pracy w Polsce — do oznaczania kolumn w raportach miesięcznych
// i do wyliczania dni roboczych bez raportu.

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Niedziela wielkanocna (algorytm Meeusa/Jonesa/Butchera dla kalendarza gregoriańskiego).
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number): string {
  const shifted = new Date(date.getTime() + days * 86_400_000);
  return iso(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

export function polishHolidays(year: number): Map<string, string> {
  const easter = easterSunday(year);
  const holidays = new Map<string, string>([
    [iso(year, 1, 1), "Nowy Rok"],
    [iso(year, 1, 6), "Trzech Króli"],
    [addDays(easter, 0), "Wielkanoc"],
    [addDays(easter, 1), "Poniedziałek Wielkanocny"],
    [iso(year, 5, 1), "Święto Pracy"],
    [iso(year, 5, 3), "Święto Konstytucji 3 Maja"],
    [addDays(easter, 49), "Zielone Świątki"],
    [addDays(easter, 60), "Boże Ciało"],
    [iso(year, 8, 15), "Wniebowzięcie NMP"],
    [iso(year, 11, 1), "Wszystkich Świętych"],
    [iso(year, 11, 11), "Święto Niepodległości"],
    [iso(year, 12, 25), "Boże Narodzenie"],
    [iso(year, 12, 26), "Drugi dzień Bożego Narodzenia"],
  ]);
  // Wigilia jest dniem wolnym od 2025 r.
  if (year >= 2025) holidays.set(iso(year, 12, 24), "Wigilia");
  return holidays;
}
