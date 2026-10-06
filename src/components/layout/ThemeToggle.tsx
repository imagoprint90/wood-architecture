"use client";

import clsx from "clsx";
import { Moon, Sun } from "lucide-react";

// Przełącza klasę "dark" na <html> i zapamiętuje wybór. Ikona zależy wyłącznie od CSS,
// więc serwer i przeglądarka renderują to samo (brak błędów hydracji).
export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const isDark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch {
      // Brak dostępu do localStorage (np. tryb prywatny) — motyw zmieni się tylko do odświeżenia.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title="Przełącz tryb jasny / ciemny"
      aria-label="Przełącz tryb jasny / ciemny"
      className={clsx(
        "rounded-md p-2 text-muted transition-colors hover:bg-foreground/5 hover:text-foreground",
        className
      )}
    >
      <Moon size={16} className="dark:hidden" />
      <Sun size={16} className="hidden dark:block" />
    </button>
  );
}
