import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "./config";

const PUBLIC_PATHS = ["/logowanie", "/auth/callback", "/podglad-tmp"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    // Bez konfiguracji Supabase nie da się sprawdzić sesji — strony same pokażą
    // czytelny komunikat (ConfigMissing), więc middleware nikogo tu nie blokuje.
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = isPublicPath(pathname);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/logowanie";
    url.searchParams.set("dalej", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/logowanie") {
    const url = request.nextUrl.clone();
    url.pathname = "/czas-pracy";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
