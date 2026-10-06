import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Kończy sesję i odsyła na ekran logowania. Trafiają tu konta dezaktywowane w trakcie
// trwającej sesji — strona nie może sama usunąć ciasteczek, a ten adres może.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${origin}/logowanie?blad=konto_nieaktywne`);
}
