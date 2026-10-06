import Link from "next/link";
import { ActionForm } from "@/components/ui/ActionForm";
import { BackLink } from "@/components/ui/BackLink";
import { buttonClass } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Card";
import { saveProjectAction } from "@/lib/actions/project-actions";
import { requireAdmin } from "@/lib/auth";
import { ProjectFields } from "../ProjectFields";

export default async function NowaBudowaPage() {
  await requireAdmin();

  return (
    <>
      <PageHeader title="Nowa budowa" back={<BackLink href="/budowy">Budowy</BackLink>} />
      <Card className="max-w-3xl">
        <ActionForm
          action={saveProjectAction}
          submitLabel="Dodaj budowę"
          secondaryAction={
            <Link href="/budowy" className={buttonClass("ghost")}>
              Anuluj
            </Link>
          }
          className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2"
        >
          <ProjectFields />
        </ActionForm>
      </Card>
    </>
  );
}
