// Klient Supabase do użytku w Server Components / Route Handlers (Etap 2+).
// Respektuje sesję logowania zapisaną w ciasteczkach.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Brak konfiguracji Supabase. Uzupełnij NEXT_PUBLIC_SUPABASE_URL i NEXT_PUBLIC_SUPABASE_ANON_KEY w pliku .env.local."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Wywołanie z Server Component bez możliwości zapisu ciasteczek — middleware
          // odświeży sesję. Można bezpiecznie zignorować.
        }
      },
    },
  });
}

// Klient z uprawnieniami service_role — WYŁĄCZNIE do operacji serwerowych, np.
// generowania i zapisu protokołów PDF w prywatnym Storage. Nigdy nie importuj tego
// pliku w komponencie klienckim.
import { createClient } from "@supabase/supabase-js";

export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Brak konfiguracji Supabase (service role). Uzupełnij SUPABASE_SERVICE_ROLE_KEY w .env.local — wyłącznie na serwerze."
    );
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
