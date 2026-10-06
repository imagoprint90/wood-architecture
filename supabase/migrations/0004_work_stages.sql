-- Etapy prac: dotychczasowy słownik „rodzajów prac” (tabela work_categories) dostaje listę
-- etapów używaną w firmie i staje się obowiązkowym polem raportu czasu pracy.

-- Stare pozycje startowe, których nikt jeszcze nie użył we wpisach, znikają. Użyte zostają,
-- żeby nie zmieniać historii — można je potem przemianować lub wyłączyć w zakładce Etapy prac.
delete from public.work_categories wc
where not exists (select 1 from public.time_entries te where te.work_category_id = wc.id);

insert into public.work_categories (name, sort_order) values
  ('Fundament', 10),
  ('Konstrukcja szkieletowa', 20),
  ('Dach', 30),
  ('Rynny', 40),
  ('Elewacja', 50),
  ('Okna, drzwi', 60),
  ('Pokrycie ścian wewnątrz', 70),
  ('Podłoga strop', 80),
  ('Termoizolacja ścian i dachu', 90),
  ('Kanalizacja, woda', 100),
  ('Elektryka', 110)
on conflict (name) do update
  set sort_order = excluded.sort_order, is_archived = false;

-- Etapu, na który są już zaraportowane godziny, nie da się usunąć (wcześniej wpis po cichu
-- tracił etap). Taki etap można wyłączyć — przestaje być wtedy dostępny w nowych raportach.
alter table public.time_entries drop constraint time_entries_work_category_id_fkey;
alter table public.time_entries
  add constraint time_entries_work_category_id_fkey
  foreign key (work_category_id) references public.work_categories (id) on delete restrict;
