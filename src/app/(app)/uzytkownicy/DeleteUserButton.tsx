"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { deleteUserAction } from "@/lib/actions/employee-actions";

export function DeleteUserButton({ id, name }: { id: string; name: string }) {
  const [state, formAction, pending] = useActionState(deleteUserAction, null);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`Usunąć użytkownika „${name}” razem z kontem logowania? Tego nie da się cofnąć.`)) {
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
