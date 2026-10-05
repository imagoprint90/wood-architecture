// Tłumaczenie najczęstszych komunikatów błędów logowania Supabase Auth na polski.

export function translateAuthError(message: string | undefined): string {
  if (!message) return "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.";

  const m = message.toLowerCase();

  if (m.includes("invalid login credentials")) {
    return "Nieprawidłowy adres e-mail lub hasło.";
  }
  if (m.includes("email not confirmed")) {
    return "Adres e-mail nie został jeszcze potwierdzony. Sprawdź skrzynkę pocztową.";
  }
  if (m.includes("user not found")) {
    return "Nie znaleziono konta dla podanego adresu e-mail.";
  }
  if (m.includes("password") && m.includes("6 characters")) {
    return "Hasło musi mieć co najmniej 6 znaków.";
  }
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.";
  }
  if (m.includes("network")) {
    return "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.";
  }

  return "Wystąpił błąd. Spróbuj ponownie.";
}
