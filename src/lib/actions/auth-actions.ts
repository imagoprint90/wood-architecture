"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LOCKOUT_MESSAGE, checkLoginThrottle } from "@/lib/login-throttle";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/supabase/auth-errors";
import type { ActionState } from "@/lib/types";

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { ok: false, error: "Podaj adres e-mail i hasło." };

  // Po serii nieudanych prób logowanie jest wstrzymane — także przy poprawnym haśle, żeby
  // odpowiedź nie zdradzała, czy hasło zostało właśnie odgadnięte.
  const throttle = await checkLoginThrottle(email);
  if (throttle.blocked) return { ok: false, error: LOCKOUT_MESSAGE };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  await throttle.record(!error);
  if (error) return { ok: false, error: translateAuthError(error.message) };

  redirect("/czas-pracy");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/logowanie");
}

// Wysyła e-mail z linkiem do ustawienia nowego hasła. Odpowiedź jest taka sama niezależnie
// od tego, czy konto istnieje — żeby formularz nie zdradzał, kto ma konto w systemie.
export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { ok: false, error: "Podaj adres e-mail." };

  const headerList = await headers();
  const origin =
    headerList.get("origin") ??
    `${headerList.get("x-forwarded-proto") ?? "https"}://${headerList.get("host")}`;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?dalej=/ustaw-haslo`,
  });
  if (error && error.message.toLowerCase().includes("rate limit")) {
    return { ok: false, error: translateAuthError(error.message) };
  }
  return { ok: true };
}

export async function setPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { ok: false, error: "Hasło musi mieć co najmniej 8 znaków." };
  if (password !== confirm) return { ok: false, error: "Hasła nie są identyczne." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesja wygasła. Poproś o nowy link do zmiany hasła." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("different from the old")) {
      return { ok: false, error: "Nowe hasło musi różnić się od dotychczasowego." };
    }
    return { ok: false, error: translateAuthError(error.message) };
  }

  redirect("/czas-pracy");
}

// Zmiana własnego hasła z panelu (zakładka „Moje konto”). W odróżnieniu od ustawiania hasła
// z linku w e-mailu wymaga podania obecnego hasła — żeby ktoś, kto dosiadł się do
// odblokowanego komputera, nie mógł przejąć konta.
export async function changeOwnPasswordAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!current) return { ok: false, error: "Podaj obecne hasło." };
  if (password.length < 8) return { ok: false, error: "Nowe hasło musi mieć co najmniej 8 znaków." };
  if (password !== confirm) return { ok: false, error: "Nowe hasła nie są identyczne." };
  if (password === current) return { ok: false, error: "Nowe hasło musi różnić się od obecnego." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Sesja wygasła. Zaloguj się ponownie." };

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  });
  if (verifyError) return { ok: false, error: "Obecne hasło jest nieprawidłowe." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: translateAuthError(error.message) };
  return { ok: true };
}
