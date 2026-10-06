import { forwardRef, type ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-primary text-on-primary shadow-xs hover:bg-primary-hover",
  secondary: "border border-border bg-surface text-foreground shadow-xs hover:bg-subtle",
  danger: "bg-danger text-white shadow-xs hover:opacity-90",
  ghost: "text-foreground hover:bg-foreground/5",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-9 px-3 text-xs lg:h-8 lg:px-2.5",
  md: "h-11 px-4 text-[0.875rem] lg:h-9 lg:px-3.5",
};

// Klasy przycisku do użycia także na <Link>, który ma wyglądać jak przycisk.
export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return clsx(
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
    "disabled:cursor-not-allowed disabled:opacity-50",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return <button ref={ref} className={buttonClass(variant, size, className)} {...props} />;
  }
);
Button.displayName = "Button";
