import { ActionForm } from "@/components/ui/ActionForm";
import { FormField, inputClass } from "@/components/ui/Form";
import { createEmployeeAccountAction, saveEmployeeAction } from "@/lib/actions/employee-actions";
import { requireManager } from "@/lib/auth";
import { employeeName, formatMoney } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ROLE_LABELS, type AppRole, type Employee } from "@/lib/types";

export default async function PracownicyPage() {
  const session = await requireManager();
  const supabase = await createSupabaseServerClient();
  const [employeesResult, profilesResult] = await Promise.all([
    supabase.from("employees").select("*").order("last_name").order("first_name"),
    supabase.from("profiles").select("id, email, role"),
  ]);
  const loadError = employeesResult.error ?? profilesResult.error;
  if (loadError) throw new Error(loadError.message);

  const employees = (employeesResult.data ?? []) as Employee[];
  const profiles = new Map(
    (profilesResult.data ?? []).map((p) => [p.id as string, p as { email: string | null; role: AppRole }])
  );
  const isAdmin = session.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-border bg-surface p-5">
        <h1 className="text-base font-semibold">Nowy pracownik</h1>
        <EmployeeForm />
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold">Pracownicy ({employees.length})</h2>
        {employees.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nie dodano jeszcze żadnego pracownika.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {employees.map((employee) => {
              const account = employee.user_id ? profiles.get(employee.user_id) : undefined;
              return (
                <li key={employee.id} className="py-3">
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="font-medium">{employeeName(employee)}</span>
                      {!employee.is_active && (
                        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs">Nieaktywny</span>
                      )}
                      <span className="text-xs text-muted">
                        {[
                          employee.position,
                          employee.hourly_rate !== null
                            ? `${formatMoney(Number(employee.hourly_rate))}/h`
                            : null,
                          account
                            ? `konto: ${account.email ?? "—"} (${ROLE_LABELS[account.role]})`
                            : "bez konta",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </summary>
                    <EmployeeForm employee={employee} />
                    {isAdmin && !employee.user_id && <AccountForm employeeId={employee.id} />}
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function EmployeeForm({ employee }: { employee?: Employee }) {
  const suffix = employee?.id ?? "new";
  return (
    <ActionForm
      action={saveEmployeeAction}
      submitLabel={employee ? "Zapisz zmiany" : "Dodaj pracownika"}
      className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      {employee && <input type="hidden" name="id" value={employee.id} />}
      <FormField label="Imię" htmlFor={`first-${suffix}`} required>
        <input
          id={`first-${suffix}`}
          name="first_name"
          required
          defaultValue={employee?.first_name}
          className={inputClass}
        />
      </FormField>
      <FormField label="Nazwisko" htmlFor={`last-${suffix}`}>
        <input
          id={`last-${suffix}`}
          name="last_name"
          defaultValue={employee?.last_name}
          className={inputClass}
        />
      </FormField>
      <FormField label="Stanowisko" htmlFor={`position-${suffix}`}>
        <input
          id={`position-${suffix}`}
          name="position"
          defaultValue={employee?.position ?? ""}
          className={inputClass}
        />
      </FormField>
      <FormField label="Telefon" htmlFor={`phone-${suffix}`}>
        <input
          id={`phone-${suffix}`}
          name="phone"
          type="tel"
          defaultValue={employee?.phone ?? ""}
          className={inputClass}
        />
      </FormField>
      <FormField label="Stawka godzinowa (zł)" htmlFor={`rate-${suffix}`}>
        <input
          id={`rate-${suffix}`}
          name="hourly_rate"
          type="text"
          inputMode="decimal"
          placeholder="np. 35 lub 42,50"
          defaultValue={employee?.hourly_rate ?? ""}
          className={inputClass}
        />
      </FormField>
      <label className="flex items-center gap-2 self-end pb-2.5 text-sm">
        <input type="checkbox" name="is_active" defaultChecked={employee?.is_active ?? true} />
        Aktywny (widoczny przy dodawaniu wpisów)
      </label>
    </ActionForm>
  );
}

function AccountForm({ employeeId }: { employeeId: string }) {
  return (
    <div className="mt-5 rounded-lg border border-dashed border-border p-4">
      <h3 className="text-sm font-semibold">Załóż konto do logowania</h3>
      <p className="mt-0.5 text-xs text-muted">
        Hasło startowe przekaż pracownikowi osobiście. Z kontem będzie mógł sam raportować godziny.
      </p>
      <ActionForm
        action={createEmployeeAccountAction}
        submitLabel="Załóż konto"
        successMessage="Konto zostało założone."
        className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <input type="hidden" name="employee_id" value={employeeId} />
        <FormField label="Adres e-mail" htmlFor={`email-${employeeId}`} required>
          <input
            id={`email-${employeeId}`}
            name="email"
            type="email"
            required
            autoComplete="off"
            className={inputClass}
          />
        </FormField>
        <FormField label="Hasło startowe (min. 8 znaków)" htmlFor={`password-${employeeId}`} required>
          <input
            id={`password-${employeeId}`}
            name="password"
            type="text"
            required
            minLength={8}
            autoComplete="off"
            className={inputClass}
          />
        </FormField>
        <FormField label="Rola" htmlFor={`role-${employeeId}`} required>
          <select id={`role-${employeeId}`} name="role" defaultValue="pracownik" className={inputClass}>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
      </ActionForm>
    </div>
  );
}
