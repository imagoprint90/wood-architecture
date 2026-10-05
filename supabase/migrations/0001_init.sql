-- Wood Architecture — schemat startowy: konta, pracownicy, budowy, rodzaje prac i wpisy
-- czasu pracy. Uruchom w całości w Supabase -> SQL Editor.
--
-- Przygotowanie pod kosztorysowanie: wpis czasu wskazuje budowę i rodzaj prac oraz
-- zapamiętuje stawkę godzinową z dnia wpisu, więc przyszłe pozycje kosztorysu (budowa +
-- rodzaj prac) da się zestawić z faktycznie przepracowanymi godzinami i kosztem robocizny.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create type public.app_role as enum ('admin', 'kierownik', 'pracownik');
create type public.project_status as enum ('planowana', 'w_toku', 'wstrzymana', 'zakonczona');
create type public.time_entry_status as enum ('zgloszony', 'zatwierdzony', 'odrzucony');

-- ===== Konta aplikacji =====
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  role public.app_role not null default 'pracownik',
  created_at timestamptz not null default now()
);

-- ===== Pracownicy (także ci bez konta — godziny wpisuje za nich kierownik) =====
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  first_name text not null,
  last_name text not null default '',
  phone text,
  position text,
  hourly_rate numeric(10, 2) check (hourly_rate is null or hourly_rate >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger employees_set_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();

-- ===== Budowy =====
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  client_name text,
  status public.project_status not null default 'w_toku',
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ===== Rodzaje prac (wspólny słownik dla czasu pracy i przyszłych kosztorysów) =====
create table public.work_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.work_categories (name, sort_order) values
  ('Prace przygotowawcze', 10),
  ('Fundamenty', 20),
  ('Prefabrykacja', 30),
  ('Konstrukcja szkieletowa', 40),
  ('Dach', 50),
  ('Elewacja', 60),
  ('Stolarka okienna i drzwiowa', 70),
  ('Instalacje', 80),
  ('Wykończenie wnętrz', 90),
  ('Transport', 100),
  ('Inne', 110);

-- ===== Wpisy czasu pracy =====
create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  employee_id uuid not null references public.employees (id) on delete restrict,
  work_category_id uuid references public.work_categories (id) on delete set null,
  work_date date not null,
  hours numeric(4, 2) not null check (hours > 0 and hours <= 24),
  description text,
  status public.time_entry_status not null default 'zgloszony',
  -- Stawka pracownika z chwili wpisu — późniejsza zmiana stawki nie zmienia historii.
  hourly_rate_snapshot numeric(10, 2),
  created_by uuid references auth.users (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index time_entries_work_date_idx on public.time_entries (work_date);
create index time_entries_project_idx on public.time_entries (project_id, work_date);
create index time_entries_employee_idx on public.time_entries (employee_id, work_date);

create trigger time_entries_set_updated_at
  before update on public.time_entries
  for each row execute function public.set_updated_at();

-- ===== Funkcje pomocnicze dla RLS =====
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('admin', 'kierownik'), false);
$$;

create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.employees where user_id = auth.uid();
$$;

-- Profil zakładany automatycznie przy tworzeniu konta. Pierwsze konto w systemie
-- dostaje rolę administratora, kolejne — pracownika (rolę zmienia administrator).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    case when exists (select 1 from public.profiles) then 'pracownik' else 'admin' end::public.app_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Pilnuje pól, których pracownik nie może ustawiać sam: status, osoba, stawka i dane
-- zatwierdzenia. Kierownik/administrator może je zmieniać.
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

create trigger time_entries_guard
  before insert or update on public.time_entries
  for each row execute function public.time_entries_guard();

-- ===== RLS =====
alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.projects enable row level security;
alter table public.work_categories enable row level security;
alter table public.time_entries enable row level security;

create policy "profil: odczyt wlasnego lub przez kierownictwo" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_manager());

create policy "profil: zmiany tylko administrator" on public.profiles
  for update to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy "pracownicy: odczyt wlasnego lub przez kierownictwo" on public.employees
  for select to authenticated
  using (user_id = auth.uid() or public.is_manager());

create policy "pracownicy: zarzadza kierownictwo" on public.employees
  for all to authenticated
  using (public.is_manager())
  with check (public.is_manager());

create policy "budowy: odczyt dla zalogowanych" on public.projects
  for select to authenticated
  using (true);

create policy "budowy: zarzadza kierownictwo" on public.projects
  for all to authenticated
  using (public.is_manager())
  with check (public.is_manager());

create policy "rodzaje prac: odczyt dla zalogowanych" on public.work_categories
  for select to authenticated
  using (true);

create policy "rodzaje prac: zarzadza kierownictwo" on public.work_categories
  for all to authenticated
  using (public.is_manager())
  with check (public.is_manager());

create policy "czas: odczyt wlasnych lub przez kierownictwo" on public.time_entries
  for select to authenticated
  using (public.is_manager() or employee_id = public.current_employee_id());

create policy "czas: dodawanie wlasnych lub przez kierownictwo" on public.time_entries
  for insert to authenticated
  with check (public.is_manager() or employee_id = public.current_employee_id());

-- Pracownik poprawia i usuwa tylko własne wpisy, dopóki nie zostały zatwierdzone/odrzucone.
create policy "czas: edycja wlasnych niezatwierdzonych lub przez kierownictwo" on public.time_entries
  for update to authenticated
  using (
    public.is_manager()
    or (employee_id = public.current_employee_id() and status = 'zgloszony')
  )
  with check (public.is_manager() or employee_id = public.current_employee_id());

create policy "czas: usuwanie wlasnych niezatwierdzonych lub przez kierownictwo" on public.time_entries
  for delete to authenticated
  using (
    public.is_manager()
    or (employee_id = public.current_employee_id() and status = 'zgloszony')
  );
