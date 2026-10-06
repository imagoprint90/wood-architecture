import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { Dash, Table, Td, Th, Tr } from "@/components/ui/Table";
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
          <Table>
            <thead>
              <tr>
                <Th>Nazwa</Th>
                <Th>Status</Th>
                <Th align="right">Pracownicy</Th>
                <Th>Adres</Th>
                <Th>Inwestor / klient</Th>
                <Th>Rozpoczęcie</Th>
                <Th>Zakończenie</Th>
                <Th align="right">Akcje</Th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <Tr key={project.id}>
                  <Td className="font-medium">{project.name}</Td>
                  <Td>
                    <Badge tone={STATUS_TONES[project.status]}>{PROJECT_STATUS_LABELS[project.status]}</Badge>
                  </Td>
                  <Td align="right">{memberCounts.get(project.id) ?? <Dash />}</Td>
                  <Td>{project.address ?? <Dash />}</Td>
                  <Td>{project.client_name ?? <Dash />}</Td>
                  <Td className="tabular-nums">
                    {project.start_date ? formatDate(project.start_date) : <Dash />}
                  </Td>
                  <Td className="tabular-nums">
                    {project.end_date ? formatDate(project.end_date) : <Dash />}
                  </Td>
                  <Td align="right">
                    <Link href={`/budowy/${project.id}`} className={buttonClass("ghost", "sm", "text-primary")}>
                      <Pencil size={14} />
                      Edytuj
                    </Link>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
