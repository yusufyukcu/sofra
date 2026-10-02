import "server-only";
import type { Session } from "@supabase/supabase-js";
import { sql } from "../db/client";
import { DomainError } from "../errors";
import { supabaseAdmin } from "../supabase/admin";
import {
  supabaseFor,
  supabaseStateless,
  toAuthClaims,
  withinMaxAge,
  type AuthClaims,
  type Role,
} from "../supabase/server";

/**
 * Supabase Auth çekirdeği — dört rolün ortak parçaları.
 *
 * Web: oturum rolün kendi `httpOnly` çerezinde. Mobil: aynı erişim
 * token'ı `Authorization: Bearer` başlığıyla gelir. İkisi de Supabase'in
 * imzaladığı JWT'dir ve yerelde (JWKS ile) doğrulanır. Rol ve kayıt
 * kimliği JWT'nin `app_metadata` alanındadır; bu alanı yalnızca sunucu
 * (service role) yazabilir.
 */

export function bearerToken(request?: Request): string | null {
  const header = request?.headers.get("authorization");
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  return value.trim();
}

/** İstekteki oturum bu rol için geçerliyse oturum bilgisini döner. */
export async function claimsFor(role: Role, request?: Request): Promise<AuthClaims | null> {
  const bearer = bearerToken(request);
  let payload: unknown = null;

  try {
    if (bearer) {
      const { data } = await supabaseStateless().auth.getClaims(bearer);
      payload = data?.claims ?? null;
    } else {
      const supabase = await supabaseFor(role);
      const { data } = await supabase.auth.getClaims();
      payload = data?.claims ?? null;
    }
  } catch {
    return null;
  }

  const claims = toAuthClaims(payload);
  if (!claims || claims.role !== role) return null;
  if (!withinMaxAge(claims)) return null;
  return claims;
}

/* ------------------------------------------------------------------ */
/* Oturum üretme                                                       */
/* ------------------------------------------------------------------ */

/**
 * Müşteri ve kurye Auth kullanıcısının iç e-postası. Gerçek telefon ve
 * e-posta uygulamanın kendi tablosunda durur; Auth tarafında rol bazlı bir
 * adres kullanılır. Böylece aynı kişi hem müşteri hem kurye olsa bile iki
 * hesap çakışmaz. `.invalid` alan adı hiçbir zaman e-posta almaz (RFC 2606).
 */
export function internalAuthEmail(role: "customer" | "courier", sid: string): string {
  return `${role}.${sid}@auth.sofra.invalid`;
}

/**
 * Kaydın Auth kullanıcısını bulur ya da açar; rol bilgisini günceller ve
 * kullanıcı kimliğini kayda yazar.
 */
export async function ensureAuthUser(
  role: "customer" | "courier",
  sid: string,
  name: string,
  existingAuthUserId: string | null
): Promise<{ id: string; email: string }> {
  const admin = supabaseAdmin();
  const email = internalAuthEmail(role, sid);
  const appMetadata = { role, sid };

  if (existingAuthUserId) {
    const { data } = await admin.auth.admin.getUserById(existingAuthUserId);
    if (data?.user) {
      const meta = data.user.app_metadata ?? {};
      if (meta.role !== role || meta.sid !== sid) {
        await admin.auth.admin.updateUserById(existingAuthUserId, { app_metadata: appMetadata });
      }
      return { id: existingAuthUserId, email: data.user.email ?? email };
    }
  }

  let id: string | undefined;
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: appMetadata,
    user_metadata: { name },
  });
  if (created.data?.user) {
    id = created.data.user.id;
  } else {
    // Daha önce açılmış (örneğin veritabanı sıfırlandıysa): kimliği bul
    const [row] = await sql<{ id: string }[]>`
      select id::text from auth.users where lower(email) = lower(${email})
    `;
    if (!row) throw new Error(`Auth kullanıcısı açılamadı: ${created.error?.message ?? "bilinmeyen hata"}`);
    id = row.id;
    await admin.auth.admin.updateUserById(id, { app_metadata: appMetadata });
  }

  if (role === "customer") {
    await sql`update public.profiles set auth_user_id = ${id} where id = ${sid}`;
  } else {
    await sql`update public.couriers set auth_user_id = ${id} where id = ${sid}`;
  }
  return { id, email };
}

/**
 * Sunucu tarafında doğrulanmış bir kimlik için Supabase oturumu açar ve
 * rolün çerezine yazar. (Kod doğrulaması uygulamada yapılır; Supabase'in
 * tek kullanımlık giriş bağlantısı sunucuda hemen tüketilir.)
 */
export async function mintSession(role: Role, email: string): Promise<Session> {
  const { data, error } = await supabaseAdmin().auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) throw new Error(`Oturum bağlantısı üretilemedi: ${error?.message}`);

  const supabase = await supabaseFor(role);
  const verified = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (verified.error || !verified.data.session) {
    throw new Error(`Oturum açılamadı: ${verified.error?.message ?? "oturum yok"}`);
  }
  return verified.data.session;
}

/** E-posta + parolayla giriş (işletme ve yönetici). Rol uyuşmazsa oturum kapatılır. */
export async function passwordSignIn(role: "vendor" | "admin", email: string, password: string) {
  const supabase = await supabaseFor(role);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error || !data.session) {
    throw new DomainError("invalid_credentials", "E-posta ya da parola hatalı.", 401);
  }
  const claims = toAuthClaims({
    sub: data.user.id,
    app_metadata: data.user.app_metadata,
    iat: Math.floor(Date.now() / 1000),
  });
  if (!claims || claims.role !== role) {
    await supabase.auth.signOut({ scope: "local" });
    throw new DomainError(
      "wrong_account_type",
      role === "vendor" ? "Bu hesap bir işletme hesabı değil." : "Bu hesap bir yönetici hesabı değil.",
      403
    );
  }
  return { session: data.session, claims };
}

/** Rolün çerezindeki oturumu kapatır (diğer rollerin oturumlarına dokunmaz). */
export async function signOutRole(role: Role): Promise<void> {
  try {
    const supabase = await supabaseFor(role);
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Oturum zaten yoksa yapılacak bir şey yok
  }
}

/** Mobil istemcinin saklayacağı oturum alanları. */
export function sessionPayload(session: Session) {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? null,
  };
}

/** Mobil: yenileme token'ıyla yeni oturum (rol değişmez). */
export async function refreshSession(refreshToken: string) {
  const { data, error } = await supabaseStateless().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) {
    throw new DomainError("session_expired", "Oturumun sona erdi, yeniden giriş yap.", 401);
  }
  const claims = toAuthClaims({
    sub: data.session.user.id,
    app_metadata: data.session.user.app_metadata,
    iat: Math.floor(Date.now() / 1000),
  });
  return { session: data.session, role: claims?.role ?? null };
}
