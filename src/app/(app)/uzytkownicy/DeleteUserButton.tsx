"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
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
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-danger hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2 size={15} />
        {pending ? "Usuwanie…" : "Usuń"}
      </button>
      {state?.ok === false && (
        <p role="alert" className="mt-1 max-w-xs whitespace-normal text-left text-xs text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
