"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/supabase/auth-errors";
import type { ActionState } from "@/lib/types";

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { ok: false, error: "Podaj adres e-mail i hasło." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
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
