import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ui/ActionForm";
import { BackLink } from "@/components/ui/BackLink";
import { buttonClass } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Card";
import { FormField, inputClass } from "@/components/ui/Form";
import { saveStageAction } from "@/lib/actions/stage-actions";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WorkCategory } from "@/lib/types";

export default async function EdycjaEtapuPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("work_categories").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const stage = data as WorkCategory;

  return (
    <>
      <PageHeader
        title={stage.name}
        description="Edycja etapu prac"
        back={<BackLink href="/etapy-prac">Etapy prac</BackLink>}
      />
      <Card className="max-w-[60rem]">
        <ActionForm
          action={saveStageAction}
          submitLabel="Zapisz zmiany"
          secondaryAction={
            <Link href="/etapy-prac" className={buttonClass("ghost")}>
              Anuluj
            </Link>
          }
          className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2"
        >
          <input type="hidden" name="id" value={stage.id} />
          <FormField label="Nazwa etapu" htmlFor="name" required>
            <input id="name" name="name" required defaultValue={stage.name} className={inputClass} />
          </FormField>
          <FormField label="Kolejność na liście" htmlFor="sort_order" required>
            <input
              id="sort_order"
              name="sort_order"
              type="number"
              min={0}
              step={1}
              required
              defaultValue={stage.sort_order}
              className={inputClass}
            />
          </FormField>
          <label className="flex items-start gap-2 col-span-full">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={!stage.is_archived}
              className="mt-0.5 accent-accent"
            />
            <span>
              <span className="font-medium">Aktywny</span>
              <span className="block text-xs text-muted">
                Wyłączony etap znika z listy przy nowych raportach; dotychczasowe wpisy i raporty
                zbiorcze nadal go pokazują. Zmiana nazwy obejmuje także wpisy historyczne.
              </span>
            </span>
          </label>
        </ActionForm>
      </Card>
    </>
  );
}
