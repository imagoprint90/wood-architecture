import { ConfigMissing } from "@/components/ui/ConfigMissing";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <ConfigMissing />;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.svg"
          alt="Wood Architecture — domy drewniane"
          width={1000}
          height={670}
          className="mx-auto mb-6 h-auto w-56"
        />
        {children}
      </div>
      <p className="mt-6 text-xs text-muted">System raportowania czasu pracy</p>
    </div>
  );
}
