import { getSession } from "@/lib/auth";
import { ROW_DIMS, loadReport, parseReportParams } from "@/lib/reports";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Eksport bieżącego widoku raportu do CSV dla Excela: separator średnik, przecinek dziesiętny,
// UTF-8 z BOM. Pierwsza kolumna to wymiar z wierszy, kolejne — kolumny tabeli, na końcu suma.
function cell(value: string | number): string {
  if (typeof value === "number") {
    return (Math.round(value * 100) / 100).toString().replace(".", ",");
  }
  // Tekst zaczynający się od = + - @ Excel potraktowałby jak formułę; apostrof na początku
  // sprawia, że zostaje zwykłym tekstem (nazwy budów i etapów wpisują ludzie).
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.isAdmin) return new Response("Brak uprawnień.", { status: 403 });

  const params = parseReportParams(Object.fromEntries(new URL(request.url).searchParams));
  const supabase = await createSupabaseServerClient();
  const { pivot } = await loadReport(supabase, params);

  const dayColumns = params.colDim === "dzien";
  const extraHead = params.continuity ? ["Dni z raportem", "Braki"] : [];
  const lines: (string | number)[][] = [
    [
      ROW_DIMS[params.rowDim],
      // Dni jako pełne daty; tygodnie z zakresem dat; pozostałe wymiary po nazwie.
      ...pivot.columns.map((c) =>
        dayColumns || params.colDim === "miesiac" ? c.key : c.sublabel ? `${c.label} (${c.sublabel})` : c.label
      ),
      ...extraHead,
      "Suma godzin",
      "Suma PLN",
    ],
    ...pivot.rows.map((row) => [
      row.label,
      ...row.values,
      ...(params.continuity ? [row.reportedDays ?? 0, row.missingDays ?? 0] : []),
      row.totalHours,
      row.totalCost,
    ]),
    ["Razem", ...pivot.columnTotals, ...extraHead.map(() => ""), pivot.grandHours, pivot.grandCost],
  ];

  const csv = "﻿" + lines.map((line) => line.map(cell).join(";")).join("\r\n") + "\r\n";
  const period = params.colDim === "miesiac" ? params.month.slice(0, 4) : params.month;
  const name = `raport-${params.continuity ? "ciaglosc" : `${params.rowDim}-${params.colDim}`}-${period}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
