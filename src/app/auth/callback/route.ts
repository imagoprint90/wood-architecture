import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Odbiera link z e-maila (reset hasła), wymienia kod na sesję i przekierowuje dalej —
// tam gdzie wskazuje `dalej`, o ile to ścieżka wewnątrz aplikacji.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requested = searchParams.get("dalej") ?? "";
  const dalej = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/czas-pracy";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${dalej}`);
    }
  }

  return NextResponse.redirect(`${origin}/logowanie?blad=link_wygasl`);
}
