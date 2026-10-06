import Link from "next/link";
import { ActionForm } from "@/components/ui/ActionForm";
import { FormField, inputClass } from "@/components/ui/Form";
import { signInAction } from "@/lib/actions/auth-actions";

export default async function LogowaniePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const linkExpired = (await searchParams).blad === "link_wygasl";

  return (
    <>
      <h1 className="text-center text-base font-semibold">Zaloguj się</h1>

      {linkExpired && (
        <p role="alert" className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-danger">
          Link wygasł lub jest nieprawidłowy. Poproś o nowy.
        </p>
      )}

      <ActionForm
        action={signInAction}
        submitLabel="Zaloguj się"
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
        <FormField label="Hasło" htmlFor="password" required>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={inputClass}
          />
        </FormField>
      </ActionForm>

      <p className="mt-4 text-center">
        <Link href="/logowanie/reset-hasla" className="text-primary underline-offset-2 hover:underline">
          Nie pamiętasz hasła?
        </Link>
      </p>
    </>
  );
}
