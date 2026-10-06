import Link from "next/link";
import { ActionForm } from "@/components/ui/ActionForm";
import { FormField, inputClass } from "@/components/ui/Form";
import { setPasswordAction } from "@/lib/actions/auth-actions";
import { requireSession } from "@/lib/auth";

// Ustawienie nowego hasła: po kliknięciu linku z e-maila albo z ikony klucza w nagłówku.
export default async function UstawHasloPage() {
  await requireSession();

  return (
    <>
      <h1 className="text-center text-base font-semibold">Ustaw nowe hasło</h1>

      <ActionForm
        action={setPasswordAction}
        submitLabel="Zapisz hasło"
        fullWidthSubmit
        className="mt-5 flex flex-col gap-4"
      >
        <FormField label="Nowe hasło (min. 8 znaków)" htmlFor="password" required>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
          />
        </FormField>
        <FormField label="Powtórz nowe hasło" htmlFor="confirm" required>
          <input
            id="confirm"
            name="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
          />
        </FormField>
      </ActionForm>

      <p className="mt-4 text-center">
        <Link href="/czas-pracy" className="text-primary underline-offset-2 hover:underline">
          Anuluj
        </Link>
      </p>
    </>
  );
}
