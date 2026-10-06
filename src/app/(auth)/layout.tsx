import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { ConfigMissing } from "@/components/ui/ConfigMissing";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <ConfigMissing />;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-6 py-6">
          <Logo variant="stacked" className="mx-auto h-auto w-52" />
        </div>
        <div className="px-6 py-6">{children}</div>
      </div>
      <p className="mt-5 text-xs text-muted">System raportowania czasu pracy</p>
    </div>
  );
}
