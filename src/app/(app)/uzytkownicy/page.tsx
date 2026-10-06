import { ActionForm } from "@/components/ui/ActionForm";
import { FormField, inputClass } from "@/components/ui/Form";
import {
  createEmployeeAccountAction,
  createUserAction,
  updateUserAction,
} from "@/lib/actions/employee-actions";
import { requireAdmin } from "@/lib/auth";
import { employeeName, formatMoney } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ROLE_LABELS, type AppRole, type Employee } from "@/lib/types";

interface Account {
  email: string | null;
  role: AppRole;
}

const ROLE_HINT =
  "Administrator ma dostęp do wszystkiego. Raportujący widzi i dodaje wyłącznie własne raporty czasu pracy.";

export default async function UzytkownicyPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const [employeesResult, profilesResult] = await Promise.all([
    supabase.from("employees").select("*").order("last_name").order("first_name"),
    supabase.from("profiles").select("id, email, role"),
  ]);
  const loadError = employeesResult.error ?? profilesResult.error;
  if (loadError) throw new Error(loadError.message);

  const employees = (employeesResult.data ?? []) as Employee[];
  const accounts = new Map<string, Account>(
    (profilesResult.data ?? []).map((p) => [
      p.id as string,
      { email: p.email as string | null, role: p.role === "admin" ? "admin" : "pracownik" },
    ])
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-border bg-surface p-5">
        <h1 className="text-base font-semibold">Nowy użytkownik</h1>
        <p className="mt-0.5 text-xs text-muted">{ROLE_HINT}</p>
        <ActionForm
          action={createUserAction}
          submitLabel="Dodaj użytkownika"
          successMessage="Użytkownik został dodany. Przekaż mu e-mail i hasło startowe."
          className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <PersonFields suffix="new" />
          <CredentialFields suffix="new" />
        </ActionForm>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold">Użytkownicy ({employees.length})</h2>
        {employees.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nie dodano jeszcze żadnego użytkownika.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {employees.map((employee) => {
              const account = employee.user_id ? accounts.get(employee.user_id) : undefined;
              return (
                <li key={employee.id} className="py-3">
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="font-medium">{employeeName(employee)}</span>
                      {account && (
                        <span
                          className={
                            account.role === "admin"
                              ? "rounded-full bg-primary px-2 py-0.5 text-xs text-white"
                              : "rounded-full bg-accent/20 px-2 py-0.5 text-xs text-primary"
                          }
                        >
                          {ROLE_LABELS[account.role]}
                        </span>
                      )}
                      {!employee.is_active && (
                        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs">Nieaktywny</span>
                      )}
                      <span className="text-xs text-muted">
                        {[
                          account ? account.email : "bez konta",
                          employee.position,
                          employee.hourly_rate !== null
                            ? `${formatMoney(Number(employee.hourly_rate))}/h`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </summary>

                    <ActionForm
                      action={updateUserAction}
                      submitLabel="Zapisz zmiany"
                      className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"
                    >
                      <input type="hidden" name="id" value={employee.id} />
                      <PersonFields suffix={employee.id} employee={employee} />
                      {account && (
                        <FormField label="Rola" htmlFor={`role-${employee.id}`} required>
                          <RoleSelect id={`role-${employee.id}`} defaultValue={account.role} />
                        </FormField>
                      )}
                      <label className="flex items-center gap-2 self-end pb-2.5 text-sm">
                        <input type="checkbox" name="is_active" defaultChecked={employee.is_active} />
                        Aktywny (widoczny przy dodawaniu wpisów)
                      </label>
                    </ActionForm>

                    {!account && (
                      <div className="mt-5 rounded-lg border border-dashed border-border p-4">
                        <h3 className="text-sm font-semibold">Załóż konto do logowania</h3>
                        <ActionForm
                          action={createEmployeeAccountAction}
                          submitLabel="Załóż konto"
                          successMessage="Konto zostało założone."
                          className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2"
                        >
                          <input type="hidden" name="employee_id" value={employee.id} />
                          <CredentialFields suffix={`account-${employee.id}`} />
                        </ActionForm>
                      </div>
                    )}
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

// Sufiks odróżnia identyfikatory pól, gdy na stronie jest kilka formularzy naraz.
function PersonFields({ suffix, employee }: { suffix: string; employee?: Employee }) {
  return (
    <>
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
    </>
  );
}

function CredentialFields({ suffix }: { suffix: string }) {
  return (
    <>
      <FormField label="Rola" htmlFor={`role-${suffix}`} required>
        <RoleSelect id={`role-${suffix}`} defaultValue="pracownik" />
      </FormField>
      <FormField label="Adres e-mail (login)" htmlFor={`email-${suffix}`} required>
        <input
          id={`email-${suffix}`}
          name="email"
          type="email"
          required
          autoComplete="off"
          className={inputClass}
        />
      </FormField>
      <FormField label="Hasło startowe (min. 8 znaków)" htmlFor={`password-${suffix}`} required>
        <input
          id={`password-${suffix}`}
          name="password"
          type="text"
          required
          minLength={8}
          autoComplete="off"
          className={inputClass}
        />
      </FormField>
    </>
  );
}

function RoleSelect({ id, defaultValue }: { id: string; defaultValue: AppRole }) {
  return (
    <select id={id} name="role" defaultValue={defaultValue} className={inputClass}>
      {Object.entries(ROLE_LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
