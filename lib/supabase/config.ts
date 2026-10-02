import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Supabase Auth ortak ayarları — sunucu, route handler ve proxy kullanır.
 * Bu dosya `next/headers` içe aktarmaz; proxy'de de güvenle kullanılır.
 */

export type Role = "customer" | "vendor" | "courier" | "admin";

/** Her rolün oturumu kendi çerez adıyla saklanır (dördü birlikte açık kalabilir). */
export const ROLE_COOKIE: Record<Role, string> = {
  customer: "sofra-auth-musteri",
  vendor: "sofra-auth-isletme",
  courier: "sofra-auth-kurye",
  admin: "sofra-auth-yonetim",
};

/** Rol başına en uzun oturum (giriş anından itibaren). Müşteride sınır yok. */
export const ROLE_MAX_AGE_SECONDS: Record<Role, number | null> = {
  customer: null,
  vendor: 12 * 60 * 60,
  courier: 12 * 60 * 60,
  admin: 4 * 60 * 60,
};

export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL tanımlı değil — `vercel env pull` çalıştır.");
  return url;
}

export function supabasePublishableKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error("Supabase yayınlanabilir anahtarı tanımlı değil.");
  return key;
}

/**
 * Çerezler `httpOnly`: tarayıcıdaki JavaScript yenileme token'ını okuyamaz.
 * Realtime için gereken kısa ömürlü erişim token'ı ayrı bir uçtan verilir.
 */
export function roleCookieOptions(role: Role): CookieOptionsWithName {
  return {
    name: ROLE_COOKIE[role],
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };
}

/** JWT'den okunan ve uygulamanın kullandığı oturum bilgisi. */
export interface AuthClaims {
  authUserId: string;
  role: Role;
  /** Rolün kendi kaydı: usr_…, vnd_…, crr_…, adm_… */
  sid: string;
  /** İşletme oturumunda restoran kimliği */
  rid?: string;
  /** Kimlik doğrulamanın yapıldığı an (saniye) */
  authTime: number | null;
}

const ROLES: Role[] = ["customer", "vendor", "courier", "admin"];

/** Supabase JWT yükünden uygulama oturumunu çıkarır. */
export function toAuthClaims(payload: unknown): AuthClaims | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as {
    sub?: string;
    app_metadata?: { role?: string; sid?: string; rid?: string };
    amr?: { timestamp?: number }[];
    iat?: number;
  };
  const role = p.app_metadata?.role as Role | undefined;
  const sid = p.app_metadata?.sid;
  if (!p.sub || !role || !ROLES.includes(role) || !sid) return null;
  const times = (p.amr ?? []).map((a) => a.timestamp).filter((t): t is number => typeof t === "number");
  return {
    authUserId: p.sub,
    role,
    sid,
    rid: p.app_metadata?.rid,
    authTime: times.length ? Math.max(...times) : p.iat ?? null,
  };
}

/** Rolün en uzun oturum süresi aşıldı mı (yönetici 4 saat, işletme/kurye 12 saat). */
export function withinMaxAge(claims: AuthClaims, now = Date.now()): boolean {
  const limit = ROLE_MAX_AGE_SECONDS[claims.role];
  if (!limit || !claims.authTime) return true;
  return now / 1000 - claims.authTime <= limit;
}
