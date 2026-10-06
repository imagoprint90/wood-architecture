-- 1) Jeden raport na dzień: ten sam pracownik nie może mieć dwóch raportów na tej samej
--    budowie w tym samym dniu. Odrzucone raporty się nie liczą — po odrzuceniu można
--    złożyć poprawiony.
create unique index time_entries_one_per_day_idx
  on public.time_entries (employee_id, project_id, work_date)
  where status <> 'odrzucony';

-- 2) Ślad po edycji raportu przez administratora: kto i kiedy go zmienił. Imię i nazwisko
--    zapisane tekstem, żeby informacja została także po usunięciu konta administratora.
alter table public.time_entries
  add column edited_by uuid references auth.users (id) on delete set null,
  add column edited_by_name text,
  add column edited_at timestamptz;

-- Raportujący nie może sam ustawić ani wymazać informacji o modyfikacji — strażnik z 0001
-- rozszerzony o nowe kolumny (reszta bez zmian).
create or replace function public.time_entries_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    select hourly_rate into new.hourly_rate_snapshot
      from public.employees where id = new.employee_id;
    new.edited_by := null;
    new.edited_by_name := null;
    new.edited_at := null;
    if public.is_manager() and new.status <> 'zgloszony' then
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    else
      if not public.is_manager() then
        new.status := 'zgloszony';
      end if;
      new.reviewed_by := null;
      new.reviewed_at := null;
    end if;
    return new;
  end if;

  if not public.is_manager() then
    new.status := old.status;
    new.employee_id := old.employee_id;
    new.hourly_rate_snapshot := old.hourly_rate_snapshot;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
    new.edited_by := old.edited_by;
    new.edited_by_name := old.edited_by_name;
    new.edited_at := old.edited_at;
    return new;
  end if;

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
  return new;
end;
$$;
