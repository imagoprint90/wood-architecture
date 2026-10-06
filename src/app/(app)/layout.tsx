import Link from "next/link";
import { KeyRound, LogOut } from "lucide-react";
import { AppNav } from "@/components/layout/AppNav";
import { ConfigMissing } from "@/components/ui/ConfigMissing";
import { signOutAction } from "@/lib/actions/auth-actions";
import { requireSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ROLE_LABELS } from "@/lib/types";

const iconButtonClass = "rounded-lg p-2 text-muted hover:bg-black/5 hover:text-foreground";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <ConfigMissing />;
  const session = await requireSession();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pt-3">
          <Link href="/czas-pracy" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.svg" alt="" width={669} height={456} className="h-9 w-auto" />
            <span className="hidden text-sm font-semibold uppercase tracking-wide text-primary sm:inline">
              Wood Architecture
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <div className="mr-2 text-right leading-tight">
              <div className="text-sm font-medium">{session.fullName}</div>
              <div className="text-xs text-muted">{ROLE_LABELS[session.role]}</div>
            </div>
            <Link href="/ustaw-haslo" title="Zmień hasło" aria-label="Zmień hasło" className={iconButtonClass}>
              <KeyRound size={18} />
            </Link>
            <form action={signOutAction}>
              <button type="submit" title="Wyloguj" aria-label="Wyloguj" className={iconButtonClass}>
                <LogOut size={18} />
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-1 sm:px-4">
          <AppNav isAdmin={session.isAdmin} />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
