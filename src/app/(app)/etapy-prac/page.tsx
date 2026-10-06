import Link from "next/link";
import { Pencil } from "lucide-react";
import { ActionForm } from "@/components/ui/ActionForm";
import { buttonClass } from "@/components/ui/Button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { FormField, inputClass } from "@/components/ui/Form";
import { Dash, Table, Td, Th, Tr } from "@/components/ui/Table";
import { deleteStageAction, saveStageAction } from "@/lib/actions/stage-actions";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WorkCategory } from "@/lib/types";

export default async function EtapyPracPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const [stagesResult, usageResult] = await Promise.all([
    supabase.from("work_categories").select("*").order("sort_order").order("name"),
    supabase.from("time_entries").select("work_category_id").not("work_category_id", "is", null),
  ]);
  const loadError = stagesResult.error ?? usageResult.error;
  if (loadError) throw new Error(loadError.message);

  const stages = (stagesResult.data ?? []) as WorkCategory[];
  const usage = new Map<string, number>();
  for (const row of usageResult.data ?? []) {
    usage.set(row.work_category_id, (usage.get(row.work_category_id) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader
        title="Etapy prac"
        description="Lista etapów, z której pracownik obowiązkowo wybiera jeden przy każdym raporcie czasu pracy."
      />

      <div className="flex flex-col gap-5">
        <Card title="Nowy etap">
          <ActionForm
            action={saveStageAction}
            submitLabel="Dodaj etap"
            successMessage="Dodano etap."
            className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2"
          >
            <FormField label="Nazwa etapu" htmlFor="name" required>
              <input id="name" name="name" required className={inputClass} />
            </FormField>
            <FormField label="Kolejność na liście (puste = na końcu)" htmlFor="sort_order">
              <input id="sort_order" name="sort_order" type="number" min={0} step={1} className={inputClass} />
            </FormField>
          </ActionForm>
        </Card>

        <Card flush>
          {stages.length === 0 ? (
            <EmptyState>Nie dodano jeszcze żadnego etapu.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th align="right">Kolejność</Th>
                  <Th>Nazwa etapu</Th>
                  <Th>Status</Th>
                  <Th align="right">Liczba wpisów</Th>
                  <Th align="right">Akcje</Th>
                </tr>
              </thead>
              <tbody>
                {stages.map((stage) => (
                  <Tr key={stage.id}>
                    <Td align="right" className="w-0 text-muted">
                      {stage.sort_order}
                    </Td>
                    <Td className="font-medium">{stage.name}</Td>
                    <Td>
                      <Badge tone={stage.is_archived ? "neutral" : "success"}>
                        {stage.is_archived ? "Wyłączony" : "Aktywny"}
                      </Badge>
                    </Td>
                    <Td align="right">{usage.get(stage.id) ?? <Dash />}</Td>
                    <Td>
                      <div className="flex items-start justify-end gap-1">
                        <Link
                          href={`/etapy-prac/${stage.id}`}
                          className={buttonClass("ghost", "sm", "text-primary")}
                        >
                          <Pencil size={14} />
                          Edytuj
                        </Link>
                        <DeleteButton
                          action={deleteStageAction}
                          id={stage.id}
                          confirmMessage={`Usunąć etap „${stage.name}”? Tego nie da się cofnąć.`}
                        />
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
