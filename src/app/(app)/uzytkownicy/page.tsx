import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { Dash, Table, Td, Th, Tr } from "@/components/ui/Table";
import { deleteUserAction } from "@/lib/actions/employee-actions";
import { requireAdmin } from "@/lib/auth";
import { employeeName, formatMoney } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ROLE_LABELS, type AppRole, type Employee } from "@/lib/types";

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
    <>
      <PageHeader
        title="Użytkownicy"
        description={`Konta w systemie: ${employees.length}`}
        actions={
          <Link href="/uzytkownicy/nowy" className={buttonClass()}>
            <Plus size={15} />
            Dodaj użytkownika
          </Link>
        }
      />

      <Card flush>
        {employees.length === 0 ? (
          <EmptyState>Nie dodano jeszcze żadnego użytkownika.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Imię i nazwisko</Th>
                <Th>E-mail (login)</Th>
                <Th>Rola</Th>
                <Th>Stanowisko</Th>
                <Th>Telefon</Th>
                <Th align="right">Stawka</Th>
                <Th>Status</Th>
                <Th align="right">Akcje</Th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => {
                const account = employee.user_id ? accounts.get(employee.user_id) : undefined;
                const isSelf = employee.user_id === session.userId;
                return (
                  <Tr key={employee.id}>
                    <Td className="font-medium">
                      {employeeName(employee)}
                      {isSelf && <span className="ml-1.5 text-xs font-normal text-muted">(Ty)</span>}
                    </Td>
                    <Td>{account?.email ?? <span className="text-muted">bez konta</span>}</Td>
                    <Td>
                      {account ? (
                        <Badge tone={account.role === "admin" ? "primary" : "accent"}>
                          {ROLE_LABELS[account.role]}
                        </Badge>
                      ) : (
                        <Dash />
                      )}
                    </Td>
                    <Td>{employee.position ?? <Dash />}</Td>
                    <Td className="tabular-nums">{employee.phone ?? <Dash />}</Td>
                    <Td align="right">
                      {employee.hourly_rate !== null ? (
                        `${formatMoney(Number(employee.hourly_rate))}/h`
                      ) : (
                        <Dash />
                      )}
                    </Td>
                    <Td>
                      <Badge tone={employee.is_active ? "success" : "neutral"}>
                        {employee.is_active ? "Aktywny" : "Nieaktywny"}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex items-start justify-end gap-1">
                        <Link
                          href={`/uzytkownicy/${employee.id}`}
                          className={buttonClass("ghost", "sm", "text-primary")}
                        >
                          <Pencil size={14} />
                          Edytuj
                        </Link>
                        {!isSelf && (
                          <DeleteButton
                            action={deleteUserAction}
                            id={employee.id}
                            confirmMessage={`Usunąć użytkownika „${employeeName(employee)}” razem z kontem logowania? Tego nie da się cofnąć.`}
                          />
                        )}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
