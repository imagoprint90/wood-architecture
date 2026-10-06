import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { SortableTable } from "@/components/ui/SortableTable";
import { cells } from "@/components/ui/table-cells";
import { Dash } from "@/components/ui/Table";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROJECT_STATUS_LABELS, type Project } from "@/lib/types";

const STATUS_TONES = {
  planowana: "accent",
  w_toku: "success",
  wstrzymana: "warning",
  zakonczona: "neutral",
} as const;

export default async function BudowyPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("projects").select("*").order("name");
  if (error) throw new Error(error.message);
  const projects = (data ?? []) as Project[];

  // Liczba przydzielonych na budowę. Błąd odczytu (np. brak migracji 0003) = zera.
  const { data: members } = await supabase.from("project_members").select("project_id");
  const memberCounts = new Map<string, number>();
  for (const m of members ?? []) {
    memberCounts.set(m.project_id, (memberCounts.get(m.project_id) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader
        title="Budowy"
        description="Lista budów, na które raportowany jest czas pracy."
        actions={
          <Link href="/budowy/nowy" className={buttonClass()}>
            <Plus size={15} />
            Dodaj budowę
          </Link>
        }
      />

      <Card flush>
        {projects.length === 0 ? (
          <EmptyState>Nie dodano jeszcze żadnej budowy.</EmptyState>
        ) : (
          <SortableTable
            columns={[
              { label: "Nazwa", className: "font-medium" },
              { label: "Status" },
              { label: "Pracownicy", align: "right" },
              { label: "Adres" },
              { label: "Inwestor / klient" },
              { label: "Rozpoczęcie", className: "tabular-nums" },
              { label: "Zakończenie", className: "tabular-nums" },
              { label: "Akcje", align: "right", sortable: false },
            ]}
            rows={projects.map((project) => ({
              key: project.id,
              sort: [
                project.name,
                PROJECT_STATUS_LABELS[project.status],
                memberCounts.get(project.id) ?? 0,
                project.address,
                project.client_name,
                project.start_date,
                project.end_date,
                null,
              ],
              cells: cells(
                project.name,
                <Badge tone={STATUS_TONES[project.status]}>
                  {PROJECT_STATUS_LABELS[project.status]}
                </Badge>,
                memberCounts.get(project.id) ?? <Dash />,
                project.address ?? <Dash />,
                project.client_name ?? <Dash />,
                project.start_date ? formatDate(project.start_date) : <Dash />,
                project.end_date ? formatDate(project.end_date) : <Dash />,
                <Link
                 
                  href={`/budowy/${project.id}`}
                  className={buttonClass("ghost", "sm", "text-primary")}
                >
                  <Pencil size={14} />
                  Edytuj
                </Link>,
              ),
            }))}
          />
        )}
      </Card>
    </>
  );
}
