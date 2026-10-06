-- Wzmocnienie zabezpieczeń. Reguły, które do tej pory sprawdzała tylko aplikacja, pilnuje
-- teraz także baza — na wypadek, gdyby ktoś z kontem raportującego wysyłał zapytania do bazy
-- z pominięciem aplikacji.

-- ===== 1) Rejestr prób logowania (ochrona przed zgadywaniem haseł) =====
-- Bez żadnych polityk RLS: tabela jest dostępna wyłącznie dla serwera aplikacji
-- (klucz serwisowy); zalogowany ani niezalogowany użytkownik jej nie odczyta.
create table public.login_attempts (
  id bigint generated always as identity primary key,
  email text not null,
  ip text,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);

create index login_attempts_email_idx on public.login_attempts (email, created_at desc);
create index login_attempts_ip_idx on public.login_attempts (ip, created_at desc);

alter table public.login_attempts enable row level security;

-- ===== 2) Strażnik wpisów czasu pracy — pełna wersja =====
create or replace function public.time_entries_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  manager boolean := public.is_manager();
  today date := (now() at time zone 'Europe/Warsaw')::date;
  days_back integer;
  other_hours numeric;
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
    select hourly_rate into new.hourly_rate_snapshot
      from public.employees where id = new.employee_id;
    new.edited_by := null;
    new.edited_by_name := null;
    new.edited_at := null;
    if manager and new.status <> 'zgloszony' then
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    else
      if not manager then
        new.status := 'zgloszony';
      end if;
      new.reviewed_by := null;
      new.reviewed_at := null;
    end if;
  else
    -- Autora i daty utworzenia wpisu nie zmienia nikt — także administrator.
    new.created_by := old.created_by;
    new.created_at := old.created_at;

    if not manager then
      new.status := old.status;
      new.employee_id := old.employee_id;
      new.hourly_rate_snapshot := old.hourly_rate_snapshot;
      new.reviewed_by := old.reviewed_by;
      new.reviewed_at := old.reviewed_at;
      new.edited_by := old.edited_by;
      new.edited_by_name := old.edited_by_name;
      new.edited_at := old.edited_at;
    else
      if new.status is distinct from old.status then
        if new.status = 'zgloszony' then
          new.reviewed_by := null;
          new.reviewed_at := null;
        else
          new.reviewed_by := auth.uid();
          new.reviewed_at := now();
        end if;
      end if;
      if new.employee_id is distinct from old.employee_id then
        select hourly_rate into new.hourly_rate_snapshot
          from public.employees where id = new.employee_id;
      end if;
    end if;
  end if;

  -- Reguły tylko dla raportującego (administrator może poprawiać dowolne wpisy).
  if not manager then
    if new.work_category_id is null then
      raise exception 'Wybierz etap prac.' using errcode = '23514';
    end if;

    if tg_op = 'INSERT' or new.work_date is distinct from old.work_date then
      if new.work_date > today then
        raise exception 'Nie można raportować czasu pracy z przyszłą datą.' using errcode = '23514';
      end if;
      -- Dokładny limit dni roboczych (ze świętami) liczy aplikacja. Tu jest zapas na weekendy
      -- i święta, żeby baza nie odrzuciła raportu dozwolonego przez aplikację — chodzi o to,
      -- by nie dało się wpisać dowolnie starej daty.
      select report_days_back into days_back from public.employees where id = new.employee_id;
      days_back := coalesce(days_back, 1);
      if new.work_date < today - (days_back + 2 * ((days_back + 4) / 5) + 6) then
        raise exception 'Termin na raport z tego dnia już minął.' using errcode = '23514';
      end if;
    end if;
  end if;

  -- Reguła dla wszystkich: łącznie nie więcej niż 24 h jednego dnia (odrzucone się nie liczą).
  if new.status <> 'odrzucony' then
    select coalesce(sum(hours), 0) into other_hours
      from public.time_entries
      where employee_id = new.employee_id
        and work_date = new.work_date
        and status <> 'odrzucony'
        and id <> new.id;
    if other_hours + new.hours > 24 then
      raise exception 'Suma godzin z jednego dnia nie może przekroczyć 24.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- ===== 3) Funkcje pomocnicze tylko dla zalogowanych =====
-- Niezalogowany i tak dostawał z nich „fałsz / nic”, ale nie ma powodu, żeby mógł je wołać.
revoke execute on function public.is_manager() from anon;
revoke execute on function public.current_app_role() from anon;
revoke execute on function public.current_employee_id() from anon;
revoke execute on function public.is_manager() from public;
revoke execute on function public.current_app_role() from public;
revoke execute on function public.current_employee_id() from public;
grant execute on function public.is_manager() to authenticated, service_role;
grant execute on function public.current_app_role() to authenticated, service_role;
grant execute on function public.current_employee_id() to authenticated, service_role;
