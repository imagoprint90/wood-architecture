import clsx from "clsx";
import { ROW_DIMS, type Pivot, type ReportParams } from "@/lib/reports";

function formatValue(value: number, kind: ReportParams["value"]): string {
  return value.toLocaleString("pl-PL", { maximumFractionDigits: kind === "koszt" ? 0 : 2 });
}

const TONE_HEAD = { saturday: "bg-accent/35", holiday: "bg-danger/25" };
const TONE_CELL = { saturday: "bg-accent/20", holiday: "bg-danger/15" };

export function PivotTable({ pivot, params }: { pivot: Pivot; params: ReportParams }) {
  // Dni miesiąca to ~31 wąskich kolumn; pozostałe wymiary mają mało kolumn, za to długie nazwy.
  const narrow = params.colDim === "dzien";
  const headBase =
    "border-b border-border bg-subtle py-2 text-[11px] font-semibold tracking-wider text-muted uppercase";
  const stickyFirst = "sticky left-0 z-[1] border-r border-border pl-5 pr-3 text-left";
  const numeric = clsx("text-right tabular-nums", narrow ? "px-1.5" : "px-3");

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 whitespace-nowrap">
        <thead>
          <tr>
            <th className={clsx(headBase, stickyFirst)}>{ROW_DIMS[params.rowDim]}</th>
            {pivot.columns.map((column) => (
              <th
                key={column.key}
                title={column.title}
                className={clsx(
                  headBase,
                  narrow ? "min-w-8 px-1 text-center" : "px-3 text-right",
                  column.tone && TONE_HEAD[column.tone]
                )}
              >
                {column.sublabel && (
                  <span className="block text-[10px] font-medium opacity-80">{column.sublabel}</span>
                )}
                {column.label}
              </th>
            ))}
            {params.continuity && (
              <>
                <th className={clsx(headBase, "border-l border-border px-3 text-right")}>Dni z raportem</th>
                <th className={clsx(headBase, "px-3 text-right")}>Braki</th>
              </>
            )}
            <th className={clsx(headBase, "border-l border-border pr-5 pl-3 text-right")}>Suma</th>
          </tr>
        </thead>
        <tbody>
          {pivot.rows.map((row) => (
            <tr key={row.key} className="group">
              <td
                className={clsx(
                  stickyFirst,
                  "border-b border-border bg-surface py-2 font-medium group-hover:bg-subtle"
                )}
              >
                {row.label}
              </td>
              {row.values.map((value, i) => {
                const column = pivot.columns[i];
                const missing = row.missing?.[i];
                return (
                  <td
                    key={column.key}
                    title={missing ? "Dzień roboczy bez raportu" : column.title}
                    className={clsx(
                      "border-b border-border py-2 group-hover:bg-subtle/70",
                      narrow ? "px-1 text-center tabular-nums" : numeric,
                      column.tone && TONE_CELL[column.tone],
                      missing && "bg-warning/25 text-warning",
                      value === 0 && !missing && "text-muted/40"
                    )}
                  >
                    {formatValue(value, params.value)}
                  </td>
                );
              })}
              {params.continuity && (
                <>
                  <td className="border-b border-l border-border px-3 py-2 text-right tabular-nums">
                    {row.reportedDays}
                  </td>
                  <td
                    className={clsx(
                      "border-b border-border px-3 py-2 text-right tabular-nums",
                      row.missingDays ? "font-semibold text-warning" : "text-muted/40"
                    )}
                  >
                    {row.missingDays}
                  </td>
                </>
              )}
              <td className="border-b border-l border-border py-2 pr-5 pl-3 text-right font-semibold tabular-nums">
                {formatValue(row.total, params.value)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className={clsx(stickyFirst, "bg-subtle py-2.5")}>Razem</td>
            {pivot.columnTotals.map((value, i) => (
              <td
                key={pivot.columns[i].key}
                className={clsx(
                  "bg-subtle py-2.5",
                  narrow ? "px-1 text-center tabular-nums" : numeric,
                  value === 0 && "text-muted/40"
                )}
              >
                {formatValue(value, params.value)}
              </td>
            ))}
            {params.continuity && <td colSpan={2} className="border-l border-border bg-subtle" />}
            <td className="border-l border-border bg-subtle py-2.5 pr-5 pl-3 text-right tabular-nums">
              {formatValue(pivot.grandTotal, params.value)}
              {params.value === "koszt" ? " zł" : " h"}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
