"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { logEvent } from "@/lib/audit";
import { LOCKOUT_MESSAGE, checkLoginThrottle } from "@/lib/login-throttle";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/supabase/auth-errors";
import type { ActionState } from "@/lib/types";

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { ok: false, error: "Podaj adres e-mail i hasło." };

  // Przy próbach logowania sesji jeszcze nie ma — sprawcą w dzienniku jest wpisany adres e-mail.
  const unknownActor = { id: null, name: email, email };

  // Po serii nieudanych prób logowanie jest wstrzymane — także przy poprawnym haśle, żeby
  // odpowiedź nie zdradzała, czy hasło zostało właśnie odgadnięte.
  const throttle = await checkLoginThrottle(email);
  if (throttle.blocked) {
    await logEvent({
      action: "blokada_logowania",
      area: "konto",
      target: email,
      details: "Zbyt wiele nieudanych prób — logowanie czasowo wstrzymane.",
      actor: unknownActor,
    });
    return { ok: false, error: LOCKOUT_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  await throttle.record(!error);
  if (error) {
    const message = translateAuthError(error.message);
    await logEvent({ action: "blad_logowania", area: "konto", target: email, details: message, actor: unknownActor });
    return { ok: false, error: message };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", data.user.id)
    .maybeSingle();
  await logEvent({
    action: "logowanie",
    area: "konto",
    target: email,
    actor: { id: data.user.id, name: profile?.full_name || email, email },
  });

  redirect("/czas-pracy");
}

export async function signOutAction(): Promise<void> {
  // Zapis przed wylogowaniem — potem nie byłoby już wiadomo, kto się wylogował.
  await logEvent({ action: "wylogowanie", area: "konto" });
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
  await logEvent({
    action: "reset_hasla",
    area: "konto",
    target: email,
    details: error ? `Nie wysłano: ${translateAuthError(error.message)}` : "Poproszono o link do ustawienia nowego hasła.",
    actor: { id: null, name: email, email },
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

  await logEvent({
    action: "zmiana_hasla",
    area: "konto",
    target: user.email ?? null,
    details: "Nowe hasło ustawione z linku w e-mailu.",
  });
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
  if (verifyError) {
    await logEvent({
      action: "zmiana_hasla",
      area: "konto",
      target: user.email,
      details: "Nieudana próba zmiany własnego hasła — błędne obecne hasło.",
    });
    return { ok: false, error: "Obecne hasło jest nieprawidłowe." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: translateAuthError(error.message) };
  await logEvent({
    action: "zmiana_hasla",
    area: "konto",
    target: user.email,
    details: "Własne hasło zmienione w zakładce Moje konto.",
  });
  return { ok: true };
}
