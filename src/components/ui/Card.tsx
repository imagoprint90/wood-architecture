import type { ReactNode } from "react";
import clsx from "clsx";

// Nagłówek strony: tytuł, krótki opis i akcje po prawej, oddzielone linią od treści.
export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div className="mb-5 border-b border-border pb-4">
      {back && <div className="mb-2">{back}</div>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-0.5 text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

// Karta z opcjonalnym nagłówkiem oddzielonym linią. `flush` — treść bez wewnętrznego
// marginesu (np. tabela od krawędzi do krawędzi).
export function Card({
  title,
  description,
  actions,
  flush,
  className,
  children,
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={clsx(
        "rounded-lg border border-border bg-surface shadow-xs",
        // Tabela od krawędzi do krawędzi musi być przycięta do zaokrąglonych rogów; zwykła
        // treść nie — inaczej rozwijane listy w formularzach byłyby ucinane.
        flush && "overflow-hidden",
        className
      )}
    >
      {title && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{title}</h2>
            {description && <p className="text-xs text-muted">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={flush ? undefined : "p-4 sm:p-5"}>{children}</div>
    </section>
  );
}

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "accent" | "primary";

const BADGE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-foreground/8 text-muted",
  success: "bg-success/12 text-success",
  warning: "bg-warning/14 text-warning",
  danger: "bg-danger/12 text-danger",
  accent: "bg-accent/15 text-primary",
  primary: "bg-primary text-on-primary",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        BADGE_CLASSES[tone]
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-5 py-10 text-center text-muted">{children}</p>;
}
