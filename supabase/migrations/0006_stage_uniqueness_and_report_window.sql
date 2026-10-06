-- 1) Blokada powtórnego raportu obejmuje teraz także etap: tego samego dnia pracownik może
--    złożyć kilka raportów na jednej budowie, o ile każdy dotyczy innego etapu prac.
--    Odrzucone raporty nadal się nie liczą.
drop index if exists public.time_entries_one_per_day_idx;

create unique index time_entries_one_per_stage_day_idx
  on public.time_entries (employee_id, project_id, work_category_id, work_date)
  where status <> 'odrzucony';

-- 2) Ile dni roboczych wstecz pracownik może raportować. 1 (domyślnie) = raport za dany dzień
--    można złożyć do końca następnego dnia roboczego; 0 = tylko za dziś.
alter table public.employees
  add column report_days_back integer not null default 1
  check (report_days_back between 0 and 365);
