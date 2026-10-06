import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ui/ActionForm";
import { BackLink } from "@/components/ui/BackLink";
import { buttonClass } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Card";
import { saveProjectAction } from "@/lib/actions/project-actions";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types";
import { ProjectFields } from "../ProjectFields";

export default async function EdycjaBudowyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const project = data as Project;

  return (
    <>
      <PageHeader title={project.name} description="Edycja budowy" back={<BackLink href="/budowy">Budowy</BackLink>} />
      <Card className="max-w-3xl">
        <ActionForm
          action={saveProjectAction}
          submitLabel="Zapisz zmiany"
          secondaryAction={
            <Link href="/budowy" className={buttonClass("ghost")}>
              Anuluj
            </Link>
          }
          className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2"
        >
          <input type="hidden" name="id" value={project.id} />
          <ProjectFields project={project} />
        </ActionForm>
      </Card>
    </>
  );
}
