import type { ReactNode } from "react";
import clsx from "clsx";

type Align = "left" | "right";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full whitespace-nowrap">{children}</table>
    </div>
  );
}

export function Th({ align = "left", children }: { align?: Align; children?: ReactNode }) {
  return (
    <th
      className={clsx(
        "border-b border-border bg-subtle px-3 py-2 text-[0.6875rem] font-semibold tracking-wider text-muted uppercase first:pl-5 last:pr-5",
        align === "right" ? "text-right" : "text-left"
      )}
    >
      {children}
    </th>
  );
}

export function Tr({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-border transition-colors last:border-b-0 hover:bg-subtle/70">
      {children}
    </tr>
  );
}

export function Td({
  align = "left",
  className,
  children,
}: {
  align?: Align;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <td
      className={clsx(
        "px-3 py-2.5 align-middle first:pl-5 last:pr-5",
        align === "right" && "text-right tabular-nums",
        className
      )}
    >
      {children}
    </td>
  );
}

// Wartość pusta w komórce.
export function Dash() {
  return <span className="text-muted/60">—</span>;
}
