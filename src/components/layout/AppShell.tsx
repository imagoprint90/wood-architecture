import Link from "next/link";
import { KeyRound, LogOut } from "lucide-react";
import { AppNav } from "@/components/layout/AppNav";
import { Footer } from "@/components/layout/Footer";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { signOutAction } from "@/lib/actions/auth-actions";
import type { SessionContext } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/types";

const iconButtonClass =
  "rounded-md p-2 text-muted transition-colors hover:bg-foreground/5 hover:text-foreground";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function UserActions() {
  return (
    <div className="flex items-center">
      <ThemeToggle />
      <Link
        href="/konto"
        title="Moje konto i zmiana hasła"
        aria-label="Moje konto i zmiana hasła"
        className={iconButtonClass}
      >
        <KeyRound size={16} />
      </Link>
      <form action={signOutAction}>
        <button type="submit" title="Wyloguj" aria-label="Wyloguj" className={iconButtonClass}>
          <LogOut size={16} />
        </button>
      </form>
    </div>
  );
}

function UserBadge({ session }: { session: SessionContext }) {
  return (
    <Link
      href="/konto"
      title="Moje konto i zmiana hasła"
      className="-m-1 flex min-w-0 items-center gap-2.5 rounded-md p-1 transition-colors hover:bg-foreground/5"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-primary">
        {initials(session.fullName)}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-medium">{session.fullName}</span>
        <span className="block text-xs text-muted">{ROLE_LABELS[session.role]}</span>
      </span>
    </Link>
  );
}

export function AppShell({ session, children }: { session: SessionContext; children: React.ReactNode }) {

  return (
    <div className="app-shell flex min-h-screen flex-col bg-background">
      {/* Duże ekrany: stały panel boczny z logo, menu i kontem użytkownika. */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-surface lg:flex">
        <Link href="/czas-pracy" className="flex h-16 shrink-0 items-center border-b border-border px-5">
          <Logo variant="horizontal" className="h-[30px] w-auto" />
        </Link>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-xs font-semibold tracking-wider text-muted uppercase">Menu</p>
          <AppNav isAdmin={session.isAdmin} orientation="vertical" />
        </div>
        <div className="flex flex-col gap-2 border-t border-border p-3">
          <UserBadge session={session} />
          <div className="flex justify-end border-t border-border pt-2">
            <UserActions />
          </div>
        </div>
      </aside>

      {/* Telefon i tablet: górny pasek z logo i zakładkami. */}
      <header className="sticky top-0 z-10 border-b border-border bg-surface lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Link href="/czas-pracy" className="shrink-0">
            <Logo variant="horizontal" className="h-[30px] w-auto" />
          </Link>
          <UserActions />
        </div>
        <div className="border-t border-border">
          <AppNav isAdmin={session.isAdmin} orientation="horizontal" />
        </div>
      </header>

      <main className="flex-1 px-4 py-6 lg:pr-8 lg:pl-68">
        {children}
      </main>
      <Footer className="border-t border-border px-4 py-3 lg:pr-8 lg:pl-68" />
    </div>
  );
}
