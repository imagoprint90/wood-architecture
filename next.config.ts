import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Content-Security-Policy: przeglądarka wykonuje i ładuje wyłącznie zasoby z własnego adresu
// aplikacji. Ogranicza skutki ewentualnego wstrzyknięcia obcego kodu i blokuje osadzanie
// systemu w ramce na cudzej stronie.
const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js wstawia skrypty startowe w treść strony ('unsafe-inline'); tryb deweloperski
  // potrzebuje dodatkowo 'unsafe-eval' do odświeżania kodu na żywo.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Zakaz osadzania w ramkach (ochrona przed „clickjackingiem”) — dla starszych przeglądarek.
  { key: "X-Frame-Options", value: "DENY" },
  // Przeglądarka nie zgaduje typu plików.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Adres strony nie wycieka do obcych serwisów w nagłówku Referer.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Aplikacja nie używa kamery, mikrofonu ani lokalizacji — żadna strona w niej też nie może.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Wymuszenie HTTPS przez 2 lata.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Nie zdradzaj w nagłówkach, na czym stoi aplikacja.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
