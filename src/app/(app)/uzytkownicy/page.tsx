import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { employeeName, formatMoney } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ROLE_LABELS, type AppRole, type Employee } from "@/lib/types";
import { DeleteUserButton } from "./DeleteUserButton";

interface Account {
  email: string | null;
  role: AppRole;
}

export default async function UzytkownicyPage() {
  const session = await requireAdmin();
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
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-semibold">Użytkownicy ({employees.length})</h1>
        <Link
          href="/uzytkownicy/nowy"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-dark"
        >
          <Plus size={16} />
          Dodaj użytkownika
        </Link>
      </div>

      {employees.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nie dodano jeszcze żadnego użytkownika.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="py-2 pr-4 font-medium">Imię i nazwisko</th>
                <th className="py-2 pr-4 font-medium">E-mail (login)</th>
                <th className="py-2 pr-4 font-medium">Rola</th>
                <th className="py-2 pr-4 font-medium">Stanowisko</th>
                <th className="py-2 pr-4 font-medium">Telefon</th>
                <th className="py-2 pr-4 text-right font-medium">Stawka</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 text-right font-medium">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => {
                const account = employee.user_id ? accounts.get(employee.user_id) : undefined;
                const isSelf = employee.user_id === session.userId;
                return (
                  <tr key={employee.id} className="border-b border-border align-top last:border-b-0">
                    <td className="py-3 pr-4 font-medium">
                      {employeeName(employee)}
                      {isSelf && <span className="ml-2 text-xs font-normal text-muted">(Ty)</span>}
                    </td>
                    <td className="py-3 pr-4">{account?.email ?? <Muted>bez konta</Muted>}</td>
                    <td className="py-3 pr-4">
                      {account ? (
                        <span
                          className={
                            account.role === "admin"
                              ? "rounded-full bg-primary px-2 py-0.5 text-xs text-white"
                              : "rounded-full bg-accent/20 px-2 py-0.5 text-xs text-primary"
                          }
                        >
                          {ROLE_LABELS[account.role]}
                        </span>
                      ) : (
                        <Muted>—</Muted>
                      )}
                    </td>
                    <td className="py-3 pr-4">{employee.position ?? <Muted>—</Muted>}</td>
                    <td className="py-3 pr-4">{employee.phone ?? <Muted>—</Muted>}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      {employee.hourly_rate !== null ? (
                        `${formatMoney(Number(employee.hourly_rate))}/h`
                      ) : (
                        <Muted>—</Muted>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          employee.is_active
                            ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800"
                            : "rounded-full bg-black/5 px-2 py-0.5 text-xs text-muted"
                        }
                      >
                        {employee.is_active ? "Aktywny" : "Nieaktywny"}
                      </span>
                    </td>
                    <td className="py-1.5">
                      <div className="flex items-start justify-end gap-1">
                        <Link
                          href={`/uzytkownicy/${employee.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-primary hover:bg-accent/10"
                        >
                          <Pencil size={15} />
                          Edytuj
                        </Link>
                        {!isSelf && <DeleteUserButton id={employee.id} name={employeeName(employee)} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted">{children}</span>;
}
