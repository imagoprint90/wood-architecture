import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { CollapsibleFilters } from "@/components/ui/CollapsibleFilters";
import { inputClass } from "@/components/ui/Form";
import { SortableTable } from "@/components/ui/SortableTable";
import { cells } from "@/components/ui/table-cells";
import { Dash } from "@/components/ui/Table";
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_TONES,
  AUDIT_AREAS,
  describeDevice,
  type AuditAction,
  type AuditArea,
  type AuditEntry,
} from "@/lib/audit-labels";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, isIsoDate, todayIso } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PAGE_SIZE = 100;
const DEFAULT_DAYS = 30;
const filterLabelClass = "flex flex-col gap-1 text-xs font-medium text-muted";

function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function daysAgo(today: string, days: number): string {
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
}

// Początek / koniec dnia w Polsce jako znacznik czasu — zdarzenia mają dokładną godzinę (UTC),
// a filtr działa na polskich dniach kalendarzowych.
function warsawBoundary(date: string, endOfDay: boolean): string {
  const [y, m, d] = date.split("-").map(Number);
  // Przesunięcie Warszawy względem UTC w danym dniu (1 h zimą, 2 h latem).
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12));
  const warsawHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", hour: "2-digit", hour12: false }).format(noonUtc)
  );
  const offsetHours = warsawHour - 12;
  const boundary = new Date(Date.UTC(y, m - 1, d + (endOfDay ? 1 : 0), -offsetHours));
  return boundary.toISOString();
}

export default async function LogiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const raw = await searchParams;
  const today = todayIso();
  const defaultFrom = daysAgo(today, DEFAULT_DAYS);
  const from = isIsoDate(raw.od) ? raw.od : defaultFrom;
  const to = isIsoDate(raw.do) ? raw.do : today;
  const actor = single(raw.uzytkownik);
  const area = single(raw.obszar) in AUDIT_AREAS ? (single(raw.obszar) as AuditArea) : "";
  const action = single(raw.zdarzenie) in AUDIT_ACTIONS ? (single(raw.zdarzenie) as AuditAction) : "";
  // Znaki, które w zapytaniu do bazy mają specjalne znaczenie, wycinamy z szukanej frazy.
  const search = single(raw.szukaj).trim().replace(/[%,()]/g, " ").slice(0, 80);
  const page = Math.max(1, Number.parseInt(single(raw.strona), 10) || 1);

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("audit_log")
    .select("*", { count: "exact" })
    .gte("created_at", warsawBoundary(from, false))
    .lt("created_at", warsawBoundary(to, true))
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (/^[0-9a-f-]{36}$/i.test(actor)) query = query.eq("actor_id", actor);
  if (area) query = query.eq("area", area);
  if (action) query = query.eq("action", action);
  if (search) {
    const pattern = `%${search}%`;
    query = query.or(
      `actor_name.ilike.${pattern},actor_email.ilike.${pattern},target.ilike.${pattern},details.ilike.${pattern},ip.ilike.${pattern}`
    );
  }

  const [logResult, profilesResult] = await Promise.all([
    query,
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
  ]);

  // Brak tabeli = migracja 0008 jeszcze nie uruchomiona — czytelna informacja zamiast błędu.
  if (logResult.error) {
    return (
      <>
        <PageHeader title="Logi" description="Dziennik zdarzeń systemu." />
        <Card>
          <p className="text-warning">
            Dziennik zdarzeń nie jest jeszcze dostępny. Uruchom w Supabase migrację{" "}
            <code className="rounded bg-foreground/10 px-1">0008_audit_log.sql</code>, a zdarzenia zaczną
            się zapisywać.
          </p>
          <p className="mt-2 text-xs text-muted">Szczegóły: {logResult.error.message}</p>
        </Card>
      </>
    );
  }

  const entries = (logResult.data ?? []) as AuditEntry[];
  const total = logResult.count ?? entries.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const users = profilesResult.data ?? [];

  const activeFilters =
    Number(from !== defaultFrom || to !== today) +
    Number(Boolean(actor)) +
    Number(Boolean(area)) +
    Number(Boolean(action)) +
    Number(Boolean(search));

  function pageHref(target: number): string {
    const params = new URLSearchParams();
    if (from !== defaultFrom) params.set("od", from);
    if (to !== today) params.set("do", to);
    if (actor) params.set("uzytkownik", actor);
    if (area) params.set("obszar", area);
    if (action) params.set("zdarzenie", action);
    if (search) params.set("szukaj", search);
    if (target > 1) params.set("strona", String(target));
    const text = params.toString();
    return text ? `/logi?${text}` : "/logi";
  }

  return (
    <>
      <PageHeader
        title="Logi"
        description="Dziennik zdarzeń: kto, kiedy i skąd się logował oraz kto co dodał, zmienił lub usunął."
      />

      <Card
        title="Zdarzenia"
        actions={
          <p className="text-xs text-muted">
            Znaleziono <span className="font-semibold text-foreground">{total}</span>
            {pages > 1 && (
              <>
                <span className="mx-2 text-border">|</span>
                strona {page} z {pages}
              </>
            )}
          </p>
        }
        flush
      >
        <CollapsibleFilters storageKey="logi-filtry" activeCount={activeFilters} clearHref="/logi">
          <form
            method="get"
            className="grid grid-cols-1 gap-3 px-4 py-3 min-[26rem]:grid-cols-2 sm:grid-cols-3 sm:px-5 xl:grid-cols-7"
          >
            <label className={filterLabelClass}>
              Od
              <input type="date" name="od" defaultValue={from} max={today} className={inputClass} />
            </label>
            <label className={filterLabelClass}>
              Do
              <input type="date" name="do" defaultValue={to} max={today} className={inputClass} />
            </label>
            <label className={filterLabelClass}>
              Użytkownik
              <select name="uzytkownik" defaultValue={actor} className={inputClass}>
                <option value="">Wszyscy</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </option>
                ))}
              </select>
            </label>
            <label className={filterLabelClass}>
              Obszar
              <select name="obszar" defaultValue={area} className={inputClass}>
                <option value="">Wszystkie</option>
                {Object.entries(AUDIT_AREAS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className={filterLabelClass}>
              Zdarzenie
              <select name="zdarzenie" defaultValue={action} className={inputClass}>
                <option value="">Wszystkie</option>
                {Object.entries(AUDIT_ACTIONS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className={filterLabelClass}>
              Szukaj
              <input
                type="search"
                name="szukaj"
                defaultValue={search}
                placeholder="nazwa, e-mail, adres IP…"
                className={inputClass}
              />
            </label>
            <div className="flex items-end">
              <Button type="submit" variant="secondary" className="w-full">
                Filtruj
              </Button>
            </div>
          </form>
        </CollapsibleFilters>

        {entries.length === 0 ? (
          <EmptyState>Brak zdarzeń dla wybranych filtrów.</EmptyState>
        ) : (
          <SortableTable
            columns={[
              { label: "Data i godzina", className: "tabular-nums" },
              { label: "Użytkownik", className: "font-medium" },
              { label: "Zdarzenie" },
              { label: "Obszar" },
              { label: "Czego dotyczy" },
              { label: "Szczegóły", className: "max-w-md truncate text-muted" },
              { label: "Adres IP", className: "tabular-nums" },
              { label: "Urządzenie", className: "text-muted" },
            ]}
            rows={entries.map((entry) => {
              const actionLabel = AUDIT_ACTIONS[entry.action as AuditAction] ?? entry.action;
              const areaLabel = AUDIT_AREAS[entry.area as AuditArea] ?? entry.area;
              const device = describeDevice(entry.user_agent);
              return {
                key: String(entry.id),
                sort: [
                  entry.created_at,
                  entry.actor_name,
                  actionLabel,
                  areaLabel,
                  entry.target,
                  entry.details,
                  entry.ip,
                  device,
                ],
                cells: cells(
                  formatDateTime(entry.created_at),
                  <span title={entry.actor_email ?? undefined}>{entry.actor_name || "—"}</span>,
                  <Badge tone={AUDIT_ACTION_TONES[entry.action as AuditAction] ?? "neutral"}>{actionLabel}</Badge>,
                  areaLabel,
                  entry.target ?? <Dash />,
                  entry.details ? <span title={entry.details}>{entry.details}</span> : <Dash />,
                  entry.ip ?? <Dash />,
                  <span title={entry.user_agent ?? undefined}>{device}</span>
                ),
              };
            })}
          />
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className={buttonClass("secondary", "sm")}>
                <ChevronLeft size={14} />
                Nowsze
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-muted">
              Strona {page} z {pages}
            </span>
            {page < pages ? (
              <Link href={pageHref(page + 1)} className={buttonClass("secondary", "sm")}>
                Starsze
                <ChevronRight size={14} />
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </Card>
    </>
  );
}
