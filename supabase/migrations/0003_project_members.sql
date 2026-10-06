-- Przydział pracowników do budów. Raportujący może dodawać wpisy czasu pracy wyłącznie na
-- budowach, do których został przydzielony; administrator — na dowolnych.

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, employee_id)
);

create index project_members_employee_idx on public.project_members (employee_id);

-- Kto ma już wpisy na danej budowie, zostaje do niej przydzielony — żeby po wdrożeniu nikt
-- nie stracił możliwości raportowania tam, gdzie do tej pory raportował.
insert into public.project_members (project_id, employee_id)
select distinct project_id, employee_id from public.time_entries
on conflict do nothing;

alter table public.project_members enable row level security;

create policy "przydzialy: odczyt wlasnych lub przez administratora" on public.project_members
  for select to authenticated
  using (public.is_manager() or employee_id = public.current_employee_id());

create policy "przydzialy: zarzadza administrator" on public.project_members
  for all to authenticated
  using (public.is_manager())
  with check (public.is_manager());

-- Raportujący widzi tylko budowy, do których jest przydzielony, oraz te, na których ma już
-- wpisy (żeby w historii nadal wyświetlała się nazwa budowy).
drop policy "budowy: odczyt dla zalogowanych" on public.projects;

create policy "budowy: odczyt przydzielonych lub przez administratora" on public.projects
  for select to authenticated
  using (
    public.is_manager()
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = projects.id and pm.employee_id = public.current_employee_id()
    )
    or exists (
      select 1 from public.time_entries te
      where te.project_id = projects.id and te.employee_id = public.current_employee_id()
    )
  );

-- Wpisy czasu: raportujący dodaje i poprawia własne wpisy tylko na przydzielonych budowach.
drop policy "czas: dodawanie wlasnych lub przez kierownictwo" on public.time_entries;
drop policy "czas: edycja wlasnych niezatwierdzonych lub przez kierownictwo" on public.time_entries;

create policy "czas: dodawanie wlasnych na przydzielonych budowach" on public.time_entries
  for insert to authenticated
  with check (
    public.is_manager()
    or (
      employee_id = public.current_employee_id()
      and exists (
        select 1 from public.project_members pm
        where pm.project_id = time_entries.project_id and pm.employee_id = time_entries.employee_id
      )
    )
  );

create policy "czas: edycja wlasnych niezatwierdzonych na przydzielonych budowach" on public.time_entries
  for update to authenticated
  using (
    public.is_manager()
    or (employee_id = public.current_employee_id() and status = 'zgloszony')
  )
  with check (
    public.is_manager()
    or (
      employee_id = public.current_employee_id()
      and exists (
        select 1 from public.project_members pm
        where pm.project_id = time_entries.project_id and pm.employee_id = time_entries.employee_id
      )
    )
  );
