import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ui/ActionForm";
import { BackLink } from "@/components/ui/BackLink";
import { buttonClass } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Card";
import { FormField, inputClass } from "@/components/ui/Form";
import {
  createEmployeeAccountAction,
  setUserPasswordAction,
  updateUserAction,
} from "@/lib/actions/employee-actions";
import { requireAdmin } from "@/lib/auth";
import { employeeName } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole, Employee } from "@/lib/types";
import { CredentialFields, FieldGroupTitle, PersonFields, ROLE_HINT, RoleSelect } from "../UserFields";

export default async function EdycjaUzytkownikaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("employees").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const employee = data as Employee;

  let account: { email: string | null; role: AppRole } | null = null;
  if (employee.user_id) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, role")
      .eq("id", employee.user_id)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (profile) account = { email: profile.email, role: profile.role === "admin" ? "admin" : "pracownik" };
  }
  const isSelf = employee.user_id === session.userId;

  return (
    <>
      <PageHeader
        title={employeeName(employee)}
        description={account ? `Login: ${account.email ?? "—"}` : "Ta osoba nie ma jeszcze konta do logowania."}
        back={<BackLink href="/uzytkownicy">Użytkownicy</BackLink>}
      />

      <div className="flex max-w-[60rem] flex-col gap-5">
        <Card title="Dane użytkownika">
          <ActionForm
            action={updateUserAction}
            submitLabel="Zapisz zmiany"
            secondaryAction={
              <Link href="/uzytkownicy" className={buttonClass("ghost")}>
                Anuluj
              </Link>
            }
            className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2"
          >
            <input type="hidden" name="id" value={employee.id} />
            <PersonFields employee={employee} />

            <FieldGroupTitle>Dostęp</FieldGroupTitle>
            {account && (
              <FormField label="Rola" htmlFor="role" required>
                <RoleSelect id="role" defaultValue={account.role} />
              </FormField>
            )}
            <label className="flex items-start gap-2 col-span-full">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={employee.is_active}
                disabled={isSelf}
                className="mt-0.5 accent-accent"
              />
              <span>
                <span className="font-medium">Aktywny</span>
                <span className="block text-xs text-muted">
                  Nieaktywny użytkownik nie może się zalogować i nie pojawia się przy dodawaniu wpisów;
                  jego dotychczasowe wpisy zostają.
                </span>
              </span>
            </label>
            {/* Wyłączone pole nie trafia do formularza — własne konto zawsze zostaje aktywne. */}
            {isSelf && <input type="hidden" name="is_active" value="on" />}
            {account && <p className="text-xs text-muted col-span-full">{ROLE_HINT}</p>}
          </ActionForm>
        </Card>

        {account && isSelf && (
          <Card title="Zmiana hasła">
            <p className="text-muted">
              To Twoje konto — hasło zmienisz w zakładce{" "}
              <Link href="/konto" className="font-medium text-primary underline-offset-2 hover:underline">
                Moje konto
              </Link>
              .
            </p>
          </Card>
        )}

        {account && !isSelf && (
          <Card
            title="Zmiana hasła"
            description="Ustaw nowe hasło i przekaż je użytkownikowi. Dotychczasowe przestanie działać od razu."
          >
            <ActionForm
              action={setUserPasswordAction}
              submitLabel="Ustaw nowe hasło"
              successMessage="Hasło zostało zmienione."
              className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2"
            >
              <input type="hidden" name="employee_id" value={employee.id} />
              <FormField label="Nowe hasło (min. 8 znaków)" htmlFor="new-password" required>
                <input
                  id="new-password"
                  name="password"
                  type="text"
                  required
                  minLength={8}
                  autoComplete="off"
                  className={inputClass}
                />
              </FormField>
              <FormField label="Powtórz nowe hasło" htmlFor="new-password-confirm" required>
                <input
                  id="new-password-confirm"
                  name="confirm"
                  type="text"
                  required
                  minLength={8}
                  autoComplete="off"
                  className={inputClass}
                />
              </FormField>
            </ActionForm>
          </Card>
        )}

        {!account && (
          <Card title="Załóż konto do logowania">
            <ActionForm
              action={createEmployeeAccountAction}
              submitLabel="Załóż konto"
              successMessage="Konto zostało założone."
              className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2"
            >
              <input type="hidden" name="employee_id" value={employee.id} />
              <CredentialFields prefix="account-" />
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
