import clsx from "clsx";

export function Footer({ className }: { className?: string }) {
  return (
    <footer className={clsx("text-center text-xs text-muted", className)}>
      Wykonanie i realizacja —{" "}
      <a
        href="https://imagocreate.pl"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground/80 underline-offset-2 hover:text-primary hover:underline"
      >
        imagocreate.pl
      </a>{" "}
      — Mateusz Michałowski. © Copyright. Wszystkie prawa zastrzeżone.
    </footer>
  );
}
