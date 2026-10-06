import type { ReactNode } from "react";

export function FormField({
  label,
  htmlFor,
  error,
  required,
  full,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-foreground/80">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

const fieldBase =
  "w-full rounded-md border border-border bg-surface px-3 text-[0.8125rem] text-foreground outline-none transition-colors placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60";

export const inputClass = `${fieldBase} h-9`;
export const textareaClass = `${fieldBase} py-2`;
