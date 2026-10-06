import Link from "next/link";
import { ActionForm } from "@/components/ui/ActionForm";
import { BackLink } from "@/components/ui/BackLink";
import { buttonClass } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Card";
import { createUserAction } from "@/lib/actions/employee-actions";
import { requireAdmin } from "@/lib/auth";
import { CredentialFields, FieldGroupTitle, PersonFields, ROLE_HINT } from "../UserFields";

export default async function NowyUzytkownikPage() {
  await requireAdmin();

  return (
    <>
      <PageHeader
        title="Nowy użytkownik"
        description="E-mail i hasło startowe przekaż użytkownikowi — hasło zmieni sam po zalogowaniu."
        back={<BackLink href="/uzytkownicy">Użytkownicy</BackLink>}
      />
      <Card className="max-w-[60rem]">
        <ActionForm
          action={createUserAction}
          submitLabel="Dodaj użytkownika"
          secondaryAction={
            <Link href="/uzytkownicy" className={buttonClass("ghost")}>
              Anuluj
            </Link>
          }
          className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2"
        >
          <PersonFields />
          <FieldGroupTitle>Konto do logowania</FieldGroupTitle>
          <CredentialFields />
          <p className="text-xs text-muted col-span-full">{ROLE_HINT}</p>
        </ActionForm>
      </Card>
    </>
  );
}
