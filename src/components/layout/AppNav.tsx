"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { BarChart3, Clock, HardHat, Users } from "lucide-react";

const ITEMS = [
  { href: "/czas-pracy", label: "Czas pracy", icon: Clock, adminOnly: false },
  { href: "/budowy", label: "Budowy", icon: HardHat, adminOnly: true },
  { href: "/uzytkownicy", label: "Użytkownicy", icon: Users, adminOnly: true },
  { href: "/raporty", label: "Raporty", icon: BarChart3, adminOnly: true },
];

export function AppNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = ITEMS.filter((item) => isAdmin || !item.adminOnly);

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-accent text-primary"
                : "border-transparent text-muted hover:text-foreground"
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
