"use client";

import { useActionState, type ReactNode } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import type { ActionState } from "@/lib/types";

// Formularz podpięty pod akcję serwerową: pokazuje błąd / potwierdzenie i blokuje
// przycisk na czas zapisu. Po udanym zapisie React sam czyści pola formularza.
export function ActionForm({
  action,
  submitLabel,
  successMessage = "Zapisano.",
  fullWidthSubmit = false,
  className,
  children,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  successMessage?: string;
  // Przycisk na całą szerokość, komunikat pod nim — układ dla wąskich kart (logowanie).
  fullWidthSubmit?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className={className}>
      {children}
      <div
        className={clsx(
          "flex gap-3 sm:col-span-2",
          fullWidthSubmit ? "flex-col" : "flex-wrap items-center"
        )}
      >
        <Button type="submit" disabled={pending} className={fullWidthSubmit ? "w-full" : undefined}>
          {pending ? "Proszę czekać…" : submitLabel}
        </Button>
        {state?.ok === false && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        {state?.ok && !pending && (
          <p role="status" className="text-sm text-success">
            {successMessage}
          </p>
        )}
      </div>
    </form>
  );
}
