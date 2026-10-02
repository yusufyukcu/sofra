import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { roleCookieOptions, supabasePublishableKey, supabaseUrl, type Role } from "./config";

/**
 * Supabase Auth istemcileri (sunucu).
 *
 * `supabaseFor(role)` route handler ve sunucu bileşenlerinde rolün kendi
 * çerezindeki oturumu açar; token yenilenirse çerez yazılır (sunucu
 * bileşenlerinde yazılamaz, orada proxy yeniler).
 */

export * from "./config";

export async function supabaseFor(role: Role): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookieOptions: roleCookieOptions(role),
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Sunucu bileşeninde çerez yazılamaz; oturumu proxy yeniler
        }
      },
    },
  });
}

let stateless: SupabaseClient | null = null;

/**
 * Oturum saklamayan istemci: mobilin gönderdiği Bearer token'ı doğrulamak
 * ve yenileme token'ıyla yeni oturum almak için.
 */
export function supabaseStateless(): SupabaseClient {
  if (stateless) return stateless;
  stateless = createClient(supabaseUrl(), supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return stateless;
}
