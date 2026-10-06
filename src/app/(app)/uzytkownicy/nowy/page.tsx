import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ActionForm } from "@/components/ui/ActionForm";
import { createUserAction } from "@/lib/actions/employee-actions";
import { requireAdmin } from "@/lib/auth";
import { CredentialFields, PersonFields, ROLE_HINT } from "../UserFields";

export default async function NowyUzytkownikPage() {
  await requireAdmin();

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <Link href="/uzytkownicy" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={15} />
        Użytkownicy
      </Link>
      <h1 className="mt-3 text-base font-semibold">Nowy użytkownik</h1>
      <p className="mt-0.5 text-xs text-muted">
        {ROLE_HINT} E-mail i hasło startowe przekaż użytkownikowi — hasło zmieni sam po zalogowaniu.
      </p>
      <ActionForm
        action={createUserAction}
        submitLabel="Dodaj użytkownika"
        className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <PersonFields />
        <CredentialFields />
      </ActionForm>
    </section>
  );
}
