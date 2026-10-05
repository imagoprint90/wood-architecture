import { AlertTriangle } from "lucide-react";

export function ConfigMissing() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md rounded-xl border border-warning/30 bg-warning/10 p-6 text-center">
        <AlertTriangle size={28} className="mx-auto mb-3 text-warning" />
        <h1 className="text-base font-semibold text-foreground">Brak konfiguracji Supabase</h1>
        <p className="mt-2 text-sm text-foreground/80">
          Uzupełnij <code className="rounded bg-black/10 px-1">NEXT_PUBLIC_SUPABASE_URL</code> i{" "}
          <code className="rounded bg-black/10 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> w pliku{" "}
          <code className="rounded bg-black/10 px-1">.env.local</code> (lokalnie) lub w zmiennych
          środowiskowych Vercela (na produkcji), a następnie uruchom aplikację ponownie. Wzór:
          plik <code className="rounded bg-black/10 px-1">.env.example</code>.
        </p>
      </div>
    </div>
  );
}
