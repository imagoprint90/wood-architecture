import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ActionForm } from "@/components/ui/ActionForm";
import { FormField } from "@/components/ui/Form";
import { createEmployeeAccountAction, updateUserAction } from "@/lib/actions/employee-actions";
import { requireAdmin } from "@/lib/auth";
import { employeeName } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole, Employee } from "@/lib/types";
import { CredentialFields, PersonFields, ROLE_HINT, RoleSelect } from "../UserFields";

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
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-border bg-surface p-5">
        <Link
          href="/uzytkownicy"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft size={15} />
          Użytkownicy
        </Link>
        <h1 className="mt-3 text-base font-semibold">Edycja: {employeeName(employee)}</h1>
        <p className="mt-0.5 text-xs text-muted">
          {account ? `Login: ${account.email ?? "—"}. ${ROLE_HINT}` : "Ta osoba nie ma jeszcze konta do logowania."}
        </p>

        <ActionForm
          action={updateUserAction}
          submitLabel="Zapisz zmiany"
          className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <input type="hidden" name="id" value={employee.id} />
          <PersonFields employee={employee} />
          {account && (
            <FormField label="Rola" htmlFor="role" required>
              <RoleSelect id="role" defaultValue={account.role} />
            </FormField>
          )}
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={employee.is_active}
              disabled={isSelf}
              className="mt-0.5"
            />
            <span>
              Aktywny
              <span className="block text-xs text-muted">
                Nieaktywny użytkownik nie może się zalogować i nie pojawia się przy dodawaniu wpisów;
                jego dotychczasowe wpisy zostają.
              </span>
            </span>
          </label>
          {/* Wyłączone pole nie trafia do formularza — własne konto zawsze zostaje aktywne. */}
          {isSelf && <input type="hidden" name="is_active" value="on" />}
        </ActionForm>
      </section>

      {!account && (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-base font-semibold">Załóż konto do logowania</h2>
          <ActionForm
            action={createEmployeeAccountAction}
            submitLabel="Załóż konto"
            successMessage="Konto zostało założone."
            className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <input type="hidden" name="employee_id" value={employee.id} />
            <CredentialFields prefix="account-" />
          </ActionForm>
        </section>
      )}
    </div>
  );
}
