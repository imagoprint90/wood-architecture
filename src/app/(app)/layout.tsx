import { AppShell } from "@/components/layout/AppShell";
import { ConfigMissing } from "@/components/ui/ConfigMissing";
import { requireSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <ConfigMissing />;
  const session = await requireSession();

  return <AppShell session={session}>{children}</AppShell>;
}
