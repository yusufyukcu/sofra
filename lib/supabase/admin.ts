import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service role istemcisi — yalnızca sunucuda.
 *
 * Auth yönetimi (kullanıcı açma, oturum üretme, yasaklama) ve Storage
 * işlemleri için kullanılır. Bu anahtar RLS'yi atlar; tarayıcıya asla
 * gönderilmez (`server-only` bunu derleme anında garanti eder).
 */

let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tanımlı değil — `vercel env pull` çalıştır.");
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
