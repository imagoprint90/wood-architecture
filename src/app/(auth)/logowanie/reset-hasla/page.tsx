import Link from "next/link";
import { ActionForm } from "@/components/ui/ActionForm";
import { FormField, inputClass } from "@/components/ui/Form";
import { requestPasswordResetAction } from "@/lib/actions/auth-actions";

export default function ResetHaslaPage() {
  return (
    <>
      <h1 className="text-center text-base font-semibold">Przypomnienie hasła</h1>
      <p className="mt-1 text-center text-muted">
        Podaj adres e-mail swojego konta — wyślemy link do ustawienia nowego hasła.
      </p>

      <ActionForm
        action={requestPasswordResetAction}
        submitLabel="Wyślij link"
        successMessage="Jeśli konto o tym adresie istnieje, wysłaliśmy na nie link. Sprawdź skrzynkę (także spam)."
        fullWidthSubmit
        className="mt-5 flex flex-col gap-4"
      >
        <FormField label="Adres e-mail" htmlFor="email" required>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputClass}
          />
        </FormField>
      </ActionForm>

      <p className="mt-4 text-center">
        <Link href="/logowanie" className="text-primary underline-offset-2 hover:underline">
          Wróć do logowania
        </Link>
      </p>
    </>
  );
}
