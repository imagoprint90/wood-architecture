import clsx from "clsx";

const VARIANTS = {
  // Logo pionowe (znak nad napisem) — ekran logowania.
  stacked: { light: "/logo.svg", dark: "/logo-dark.svg", width: 1000, height: 670 },
  // Logo poziome (znak obok napisu) — nagłówek aplikacji po zalogowaniu.
  horizontal: { light: "/logo-poziome.svg", dark: "/logo-poziome-dark.svg", width: 712, height: 148 },
};

// Dwie wersje pliku: w trybie ciemnym ciemny morski z logotypu zastępuje jasny odcień,
// żeby logo było widoczne na ciemnym tle.
export function Logo({ variant, className }: { variant: keyof typeof VARIANTS; className?: string }) {
  const { light, dark, width, height } = VARIANTS[variant];
  const alt = "Wood Architecture — domy drewniane";
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={light} alt={alt} width={width} height={height} className={clsx("dark:hidden", className)} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dark} alt={alt} width={width} height={height} className={clsx("hidden dark:block", className)} />
    </>
  );
}
