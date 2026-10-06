import { Button } from "@/components/ui/Button";
import { Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { inputClass } from "@/components/ui/Form";
import { Table, Td, Th, Tr } from "@/components/ui/Table";
import { requireAdmin } from "@/lib/auth";
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

function sumRows(rows: SummaryRow[]) {
  return rows.reduce(
    (sum, r) => ({
      hours: sum.hours + r.hours,
      approvedHours: sum.approvedHours + r.approvedHours,
      cost: sum.cost + r.cost,
    }),
    { hours: 0, approvedHours: 0, cost: 0 }
  );
}

export default async function RaportyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
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
  const total = sumRows(byProject);
  const missingRate = entries.some((e) => e.hourly_rate_snapshot === null);

  return (
    <>
      <PageHeader
        title="Raport miesięczny"
        description="Wpisy zgłoszone i zatwierdzone, bez odrzuconych."
        actions={
          <form method="get" className="flex items-center gap-2">
            <input
              type="month"
              name="miesiac"
              aria-label="Miesiąc"
              defaultValue={month}
              className={`${inputClass} w-40`}
            />
            <Button type="submit" variant="secondary">
              Pokaż
            </Button>
          </form>
        }
      />

      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile label="Godziny razem" value={formatHours(total.hours)} />
          <StatTile label="W tym zatwierdzone" value={formatHours(total.approvedHours)} />
          <StatTile
            label="Koszt robocizny"
            value={formatMoney(total.cost)}
            hint={missingRate ? "Część wpisów nie ma stawki — liczone jako 0 zł." : undefined}
          />
        </div>

        <SummaryTable title="Według budów" firstColumn="Budowa" rows={byProject} />
        <SummaryTable title="Według pracowników" firstColumn="Pracownik" rows={byEmployee} />
      </div>
    </>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-5 py-4 shadow-xs">
      <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-warning">{hint}</p>}
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
  const total = sumRows(rows);

  return (
    <Card title={title} flush>
      {rows.length === 0 ? (
        <EmptyState>Brak wpisów w wybranym miesiącu.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{firstColumn}</Th>
              <Th align="right">Godziny</Th>
              <Th align="right">W tym zatwierdzone</Th>
              <Th align="right">Koszt robocizny</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <Tr key={index}>
                <Td className="font-medium">{row.label}</Td>
                <Td align="right">{formatHours(row.hours)}</Td>
                <Td align="right">{formatHours(row.approvedHours)}</Td>
                <Td align="right">{formatMoney(row.cost)}</Td>
              </Tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-subtle font-semibold">
              <Td>Razem</Td>
              <Td align="right">{formatHours(total.hours)}</Td>
              <Td align="right">{formatHours(total.approvedHours)}</Td>
              <Td align="right">{formatMoney(total.cost)}</Td>
            </tr>
          </tfoot>
        </Table>
      )}
    </Card>
  );
}
