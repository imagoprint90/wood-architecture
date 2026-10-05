import { ConfigMissing } from "@/components/ui/ConfigMissing";
import { ActionForm } from "@/components/ui/ActionForm";
import { FormField, inputClass } from "@/components/ui/Form";
import { signInAction } from "@/lib/actions/auth-actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function LogowaniePage() {
  if (!isSupabaseConfigured()) return <ConfigMissing />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold text-primary-dark">Wood Architecture</h1>
          <p className="mt-1 text-sm text-muted">Zaloguj się, aby raportować czas pracy</p>
        </div>

        <ActionForm action={signInAction} submitLabel="Zaloguj się" className="flex flex-col gap-4">
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
      </div>
    </div>
  );
}
