import { AlertTriangle } from "lucide-react";

const codeClass = "rounded bg-foreground/10 px-1";

export function ConfigMissing() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md rounded-lg border border-warning/30 bg-warning/10 p-6 text-center">
        <AlertTriangle size={24} className="mx-auto mb-3 text-warning" />
        <h1 className="text-sm font-semibold">Brak konfiguracji Supabase</h1>
        <p className="mt-2 text-foreground/80">
          Uzupełnij <code className={codeClass}>NEXT_PUBLIC_SUPABASE_URL</code> i{" "}
          <code className={codeClass}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> w pliku{" "}
          <code className={codeClass}>.env.local</code> (lokalnie) lub w zmiennych środowiskowych
          Vercela (na produkcji), a następnie uruchom aplikację ponownie. Wzór: plik{" "}
          <code className={codeClass}>.env.example</code>.
        </p>
      </div>
    </div>
  );
}
