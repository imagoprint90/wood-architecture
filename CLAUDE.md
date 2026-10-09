@AGENTS.md

# Wood Architecture — notatki dla kolejnych sesji

System raportowania czasu pracy na budowach (w planach: kosztorysowanie domów). Next.js 16 +
Supabase, wdrożenie na Vercelu z gałęzi `main`. Rozmowy z właścicielem prowadź po polsku.

## Zasady pracy ustalone z właścicielem

- **Po każdej zleconej zmianie od razu commit i push na `main`** (Vercel wdraża sam), bez pytania
  o zgodę. Najpierw `npm run lint` i `npm run build`; jeśli nie przechodzą — nie wypychaj.
- **Migracji SQL nie da się uruchomić z kodu.** Nową migrację zapisz w `supabase/migrations/`
  i wklej jej pełną treść w odpowiedzi — właściciel uruchamia ją w Supabase → SQL Editor.
  Kod pisz tak, żeby aplikacja działała także przed uruchomieniem migracji.
- **Przy każdym imporcie/eksporcie CSV podaj w odpowiedzi strukturę pliku** (kolumny, przykład).
- Kosztorysowania nie projektuj, dopóki właściciel nie poda dokładnego opisu.

## Reguły biznesowe (stan po migracjach 0001–0010)

- Role: Administrator (wszystko) i Raportujący (tylko własne wpisy, tylko przydzielone budowy).
  W bazie rola raportującego to `pracownik`; funkcja `is_manager()` oznacza „jest administratorem”.
- Wpis czasu: pracownik + budowa + etap prac (obowiązkowy) + data + godziny.
  Ten sam etap na tej samej budowie tylko raz dziennie na pracownika; suma dnia ≤ 24 h;
  odrzucone wpisy nie liczą się do żadnej z tych reguł.
- Raportujący może raportować tylko N dni roboczych wstecz (`employees.report_days_back`,
  domyślnie 1; dni robocze = pon.–pt. bez polskich świąt, patrz `src/lib/workdays.ts`).
- Statusy wpisu: zgłoszony → zatwierdzony / odrzucony. Wpis dodany przez administratora jest
  od razu zatwierdzony. Edycja przez administratora zostawia ślad (`edited_by_name`, `edited_at`).
- „Etapy prac” to tabela `work_categories`; „Użytkownicy” to `employees` + konto w `profiles`.
- Koszt robocizny = godziny × stawka zapamiętana przy wpisie (`hourly_rate_snapshot`), a gdy jej
  brak — obecna stawka pracownika.
- Godziny mają w bazie 4 miejsca po przecinku (po imporcie starych danych); formularz przyjmuje 2.
- Każda akcja zmieniająca dane zapisuje zdarzenie przez `logEvent` (`src/lib/audit.ts`) —
  nowe akcje też powinny.

## Pułapki narzędziowe

- W PowerShellu właściciela `npm` jest zablokowane przez execution policy — podawaj `npm.cmd`.
- Ekrany po zalogowaniu wymagają konta; do podglądu wyglądu używaj tymczasowej publicznej strony
  testowej i **usuń ją oraz wpis w `PUBLIC_PATHS` (`src/lib/supabase/middleware.ts`) przed commitem**.
- Klucz serwisowy Supabase tylko po stronie serwera (`src/lib/supabase/server.ts`, `server-only`).
