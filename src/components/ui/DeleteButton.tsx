"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import type { ActionState } from "@/lib/types";

// Przycisk „Usuń” w wierszu tabeli: pyta o potwierdzenie, a odmowę serwera (np. „są już
// wpisy”) pokazuje pod przyciskiem.
export function DeleteButton({
  action,
  id,
  confirmMessage,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  id: string;
  confirmMessage: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className={buttonClass("ghost", "sm", "text-danger hover:bg-danger/10")}
      >
        <Trash2 size={14} />
        {pending ? "Usuwanie…" : "Usuń"}
      </button>
      {state?.ok === false && (
        <p role="alert" className="mt-1 w-64 text-left text-xs whitespace-normal text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
