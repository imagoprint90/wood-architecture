"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { BarChart3, Clock, HardHat, ListChecks, ScrollText, Users } from "lucide-react";

const ITEMS = [
  { href: "/czas-pracy", label: "Czas pracy", icon: Clock, adminOnly: false },
  { href: "/budowy", label: "Budowy", icon: HardHat, adminOnly: true },
  { href: "/etapy-prac", label: "Etapy prac", icon: ListChecks, adminOnly: true },
  { href: "/uzytkownicy", label: "Użytkownicy", icon: Users, adminOnly: true },
  { href: "/raporty", label: "Raporty", icon: BarChart3, adminOnly: true },
  { href: "/logi", label: "Logi", icon: ScrollText, adminOnly: true },
];

// `vertical` — lista w bocznym panelu (duże ekrany); `horizontal` — zakładki pod górnym
// paskiem (telefon, tablet).
export function AppNav({
  isAdmin,
  orientation,
}: {
  isAdmin: boolean;
  orientation: "vertical" | "horizontal";
}) {
  const pathname = usePathname();
  const items = ITEMS.filter((item) => isAdmin || !item.adminOnly);
  const vertical = orientation === "vertical";

  return (
    <nav className={vertical ? "flex flex-col gap-0.5" : "flex gap-1 overflow-x-auto px-2 [scrollbar-width:none]"}>
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex shrink-0 items-center gap-2.5 font-medium transition-colors",
              vertical ? "rounded-md px-3 py-2" : "border-b-2 px-3 py-2.5",
              vertical &&
                (active
                  ? "bg-accent/15 text-primary"
                  : "text-muted hover:bg-foreground/5 hover:text-foreground"),
              !vertical &&
                (active
                  ? "border-accent text-primary"
                  : "border-transparent text-muted hover:text-foreground")
            )}
          >
            <Icon size={16} className={active ? "text-accent" : undefined} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
