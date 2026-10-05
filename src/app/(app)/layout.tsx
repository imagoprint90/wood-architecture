import { LogOut } from "lucide-react";
import { AppNav } from "@/components/layout/AppNav";
import { ConfigMissing } from "@/components/ui/ConfigMissing";
import { signOutAction } from "@/lib/actions/auth-actions";
import { requireSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ROLE_LABELS } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <ConfigMissing />;
  const session = await requireSession();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pt-3">
          <span className="text-base font-semibold text-primary-dark">Wood Architecture</span>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-medium">{session.fullName}</div>
              <div className="text-xs text-muted">{ROLE_LABELS[session.role]}</div>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                title="Wyloguj"
                aria-label="Wyloguj"
                className="rounded-lg p-2 text-muted hover:bg-black/5 hover:text-foreground"
              >
                <LogOut size={18} />
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-1 sm:px-4">
          <AppNav isManager={session.isManager} />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
