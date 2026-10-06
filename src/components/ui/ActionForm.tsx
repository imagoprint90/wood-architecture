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
  secondaryAction,
  className,
  children,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  successMessage?: string;
  // Przycisk na całą szerokość, komunikat pod nim — układ dla wąskich kart (logowanie).
  fullWidthSubmit?: boolean;
  // Dodatkowy element obok przycisku zapisu, np. link „Anuluj”.
  secondaryAction?: ReactNode;
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
          fullWidthSubmit ? "flex-col" : "mt-1 flex-wrap items-center border-t border-border pt-4"
        )}
      >
        <Button type="submit" disabled={pending} className={fullWidthSubmit ? "w-full" : undefined}>
          {pending ? "Proszę czekać…" : submitLabel}
        </Button>
        {secondaryAction}
        {state?.ok === false && (
          <p role="alert" className="text-danger">
            {state.error}
          </p>
        )}
        {state?.ok && !pending && (
          <p role="status" className="text-success">
            {successMessage}
          </p>
        )}
      </div>
    </form>
  );
}
