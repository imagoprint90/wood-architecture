import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Form";
import { requireManager } from "@/lib/auth";
import { employeeName, formatHours, formatMoney, isIsoMonth, monthRange, todayIso } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TimeEntry } from "@/lib/types";

interface SummaryRow {
  label: string;
  hours: number;
  approvedHours: number;
  cost: number;
}

// Sumuje wpisy według klucza (budowa / pracownik). Koszt robocizny liczony ze stawki
// zapamiętanej przy wpisie; wpisy bez stawki nie podbijają kosztu.
function summarize(entries: TimeEntry[], keyOf: (e: TimeEntry) => string, labelOf: (e: TimeEntry) => string) {
  const rows = new Map<string, SummaryRow>();
  for (const entry of entries) {
    const key = keyOf(entry);
    const row = rows.get(key) ?? { label: labelOf(entry), hours: 0, approvedHours: 0, cost: 0 };
    const hours = Number(entry.hours);
    row.hours += hours;
    if (entry.status === "zatwierdzony") row.approvedHours += hours;
    row.cost += hours * Number(entry.hourly_rate_snapshot ?? 0);
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => a.label.localeCompare(b.label, "pl"));
}

export default async function RaportyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireManager();
  const params = await searchParams;
  const month = isIsoMonth(params.miesiac) ? params.miesiac : todayIso().slice(0, 7);
  const { from, to } = monthRange(month);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("time_entries")
    .select("*, projects(name), employees(first_name, last_name), work_categories(name)")
    .gte("work_date", from)
    .lte("work_date", to)
    .neq("status", "odrzucony");
  if (error) throw new Error(error.message);
  const entries = (data ?? []) as TimeEntry[];

  const byProject = summarize(
    entries,
    (e) => e.project_id,
    (e) => e.projects?.name ?? "—"
  );
  const byEmployee = summarize(
    entries,
    (e) => e.employee_id,
    (e) => employeeName(e.employees)
  );
  const missingRate = entries.some((e) => e.hourly_rate_snapshot === null);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-border bg-surface p-5">
        <h1 className="text-base font-semibold">Raport miesięczny</h1>
        <form method="get" className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted">
            Miesiąc
            <input type="month" name="miesiac" defaultValue={month} className={`${inputClass} mt-1`} />
          </label>
          <Button type="submit" variant="secondary">
            Pokaż
          </Button>
        </form>
        <p className="mt-3 text-xs text-muted">
          Uwzględnia wpisy zgłoszone i zatwierdzone (bez odrzuconych).
          {missingRate && " Część wpisów nie ma stawki godzinowej — ich koszt liczony jest jako 0 zł."}
        </p>
      </section>

      <SummaryTable title="Według budów" firstColumn="Budowa" rows={byProject} />
      <SummaryTable title="Według pracowników" firstColumn="Pracownik" rows={byEmployee} />
    </div>
  );
}

function SummaryTable({
  title,
  firstColumn,
  rows,
}: {
  title: string;
  firstColumn: string;
  rows: SummaryRow[];
}) {
  const total = rows.reduce(
    (sum, r) => ({
      hours: sum.hours + r.hours,
      approvedHours: sum.approvedHours + r.approvedHours,
      cost: sum.cost + r.cost,
    }),
    { hours: 0, approvedHours: 0, cost: 0 }
  );

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Brak wpisów w wybranym miesiącu.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="py-2 pr-4 font-medium">{firstColumn}</th>
                <th className="py-2 pr-4 text-right font-medium">Godziny</th>
                <th className="py-2 pr-4 text-right font-medium">W tym zatwierdzone</th>
                <th className="py-2 text-right font-medium">Koszt robocizny</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((row, index) => (
                <tr key={index} className="border-b border-border">
                  <td className="py-2 pr-4">{row.label}</td>
                  <td className="py-2 pr-4 text-right">{formatHours(row.hours)}</td>
                  <td className="py-2 pr-4 text-right">{formatHours(row.approvedHours)}</td>
                  <td className="py-2 text-right">{formatMoney(row.cost)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2 pr-4">Razem</td>
                <td className="py-2 pr-4 text-right">{formatHours(total.hours)}</td>
                <td className="py-2 pr-4 text-right">{formatHours(total.approvedHours)}</td>
                <td className="py-2 text-right">{formatMoney(total.cost)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
