-- Dwie role w systemie: administrator (może wszystko) i raportujący (wartość 'pracownik'
-- w bazie — widzi i dodaje wyłącznie własne raporty czasu pracy).
-- Rola 'kierownik' z migracji 0001 przestaje dawać jakiekolwiek uprawnienia zarządcze.

-- Ewentualne konta kierowników stają się kontami raportujących (najmniejsze uprawnienia);
-- administrator może je potem podnieść w zakładce Użytkownicy.
update public.profiles set role = 'pracownik' where role = 'kierownik';

-- Wszystkie polityki RLS z 0001 korzystają z tej funkcji, więc zmiana jej treści od razu
-- zawęża zarządzanie budowami, użytkownikami i cudzymi wpisami do administratora.
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'admin', false);
$$;

-- Każde konto ma mieć swój wpis na liście użytkowników (tabela employees). Konta założone
-- ręcznie w panelu Supabase — np. pierwszy administrator — jeszcze go nie mają.
insert into public.employees (user_id, first_name, last_name)
select
  p.id,
  coalesce(nullif(split_part(trim(p.full_name), ' ', 1), ''), split_part(p.email, '@', 1), 'Użytkownik'),
  case
    when position(' ' in trim(p.full_name)) > 0
      then trim(substring(trim(p.full_name) from position(' ' in trim(p.full_name)) + 1))
    else ''
  end
from public.profiles p
where not exists (select 1 from public.employees e where e.user_id = p.id);
