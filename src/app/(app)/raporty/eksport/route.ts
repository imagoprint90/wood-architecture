import { getSession } from "@/lib/auth";
import { ROW_DIMS, loadReport, parseReportParams } from "@/lib/reports";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Eksport bieżącego widoku raportu do CSV dla Excela: separator średnik, przecinek dziesiętny,
// UTF-8 z BOM. Pierwsza kolumna to wymiar z wierszy, kolejne — kolumny tabeli, na końcu suma.
function cell(value: string | number): string {
  if (typeof value === "number") {
    return (Math.round(value * 100) / 100).toString().replace(".", ",");
  }
  return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
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
      ...pivot.columns.map((c) => (dayColumns ? c.key : c.sublabel ? `${c.label} (${c.sublabel})` : c.label)),
      ...extraHead,
      "Suma",
    ],
    ...pivot.rows.map((row) => [
      row.label,
      ...row.values,
      ...(params.continuity ? [row.reportedDays ?? 0, row.missingDays ?? 0] : []),
      row.total,
    ]),
    ["Razem", ...pivot.columnTotals, ...extraHead.map(() => ""), pivot.grandTotal],
  ];

  const csv = "﻿" + lines.map((line) => line.map(cell).join(";")).join("\r\n") + "\r\n";
  const name = `raport-${params.continuity ? "ciaglosc" : `${params.rowDim}-${params.colDim}`}-${params.month}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
