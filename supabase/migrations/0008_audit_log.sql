-- Dziennik zdarzeń: kto, kiedy i skąd się logował oraz kto co dodał, zmienił lub usunął.
-- Zapisuje go wyłącznie serwer aplikacji (klucz serwisowy). Administrator może dziennik
-- czytać; nikt — także administrator — nie może przez aplikację wpisów zmienić ani usunąć,
-- bo nie ma do tego żadnej polityki RLS.

create table public.audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  -- Bez klucza obcego i z nazwą zapisaną tekstem: wpis zostaje czytelny także po usunięciu konta.
  actor_id uuid,
  actor_name text not null default '',
  actor_email text,
  -- Rodzaj zdarzenia (np. logowanie, dodanie, zmiana, usuniecie) i obszar systemu.
  action text not null,
  area text not null,
  -- Czego dotyczy (np. nazwa budowy, pracownik i data raportu) oraz opis zmian.
  target text,
  details text,
  ip text,
  user_agent text
);

create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);
create index audit_log_area_idx on public.audit_log (area, created_at desc);
create index audit_log_action_idx on public.audit_log (action, created_at desc);

alter table public.audit_log enable row level security;

create policy "dziennik: odczyt tylko administrator" on public.audit_log
  for select to authenticated
  using (public.is_manager());
