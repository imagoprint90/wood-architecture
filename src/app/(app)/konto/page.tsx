import { ActionForm } from "@/components/ui/ActionForm";
import { Badge, Card, PageHeader } from "@/components/ui/Card";
import { FormField, inputClass } from "@/components/ui/Form";
import { changeOwnPasswordAction } from "@/lib/actions/auth-actions";
import { requireSession } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/types";

export default async function KontoPage() {
  const session = await requireSession();

  return (
    <>
      <PageHeader title="Moje konto" description="Twoje dane w systemie i zmiana hasła." />

      <div className="flex max-w-[40rem] flex-col gap-5">
        <Card title="Dane konta">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            <dt className="text-muted">Imię i nazwisko</dt>
            <dd className="font-medium">{session.fullName}</dd>
            <dt className="text-muted">E-mail (login)</dt>
            <dd className="font-medium">{session.email ?? "—"}</dd>
            <dt className="text-muted">Rola</dt>
            <dd>
              <Badge tone={session.isAdmin ? "primary" : "accent"}>{ROLE_LABELS[session.role]}</Badge>
            </dd>
          </dl>
          {!session.isAdmin && (
            <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
              Dane konta zmienia administrator.
            </p>
          )}
        </Card>

        <Card title="Zmiana hasła">
          <ActionForm
            action={changeOwnPasswordAction}
            submitLabel="Zmień hasło"
            successMessage="Hasło zostało zmienione."
            className="flex flex-col gap-3"
          >
            <FormField label="Obecne hasło" htmlFor="current" required>
              <input
                id="current"
                name="current"
                type="password"
                required
                autoComplete="current-password"
                className={inputClass}
              />
            </FormField>
            <FormField label="Nowe hasło (min. 8 znaków)" htmlFor="password" required>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className={inputClass}
              />
            </FormField>
            <FormField label="Powtórz nowe hasło" htmlFor="confirm" required>
              <input
                id="confirm"
                name="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className={inputClass}
              />
            </FormField>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
