import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground">
      <ArrowLeft size={14} />
      {children}
    </Link>
  );
}
