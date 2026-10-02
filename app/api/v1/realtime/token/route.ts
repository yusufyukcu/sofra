import { fail, handle, ok } from "@/lib/api/respond";
import { bearerToken, claimsFor } from "@/lib/auth/roles";
import { supabaseFor, type Role } from "@/lib/supabase/server";

const ROLES: Role[] = ["customer", "vendor", "courier", "admin"];

/** Tarayıcının da yeni token istediği eşik (lib/realtime.ts ile aynı) */
const REFRESH_BEFORE_SECONDS = 300;

/**
 * GET /api/v1/realtime/token?rol=customer|vendor|courier|admin
 *
 * Tarayıcı Realtime kanallarına bağlanmak için rolün kısa ömürlü erişim
 * token'ını buradan alır. Oturum çerezleri httpOnly olduğundan JavaScript
 * yenileme token'ını hiç görmez; yalnızca en fazla 1 saat geçerli erişim
 * token'ı verilir. Hangi kanalları dinleyebileceğine veritabanındaki
 * politika karar verir; `topics` yalnızca kolaylık içindir.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const role = new URL(request.url).searchParams.get("rol") as Role | null;
    if (!role || !ROLES.includes(role)) return fail("invalid_role", "Geçersiz rol.");

    const claims = await claimsFor(role, request);
    if (!claims) return fail("unauthorized", "Oturum bulunamadı.", 401);

    let accessToken = bearerToken(request);
    let expiresAt: number | null = null;
    if (!accessToken) {
      // getClaims yukarıda gerekirse oturumu yeniledi; güncel token çerezde
      const supabase = await supabaseFor(role);
      let { data: { session } } = await supabase.auth.getSession();
      // Bitmesine 5 dakikadan az kaldıysa şimdi yenile; tarayıcı süresi
      // dolmak üzere olan token'la kanallara bağlanmasın
      if (session && (session.expires_at ?? 0) - Date.now() / 1000 < REFRESH_BEFORE_SECONDS) {
        const refreshed = await supabase.auth.refreshSession();
        session = refreshed.data.session ?? session;
      }
      accessToken = session?.access_token ?? null;
      expiresAt = session?.expires_at ?? null;
    }
    if (!accessToken) return fail("unauthorized", "Oturum bulunamadı.", 401);

    const topics =
      role === "customer"
        ? [`user:${claims.sid}`]
        : role === "vendor"
          ? [`restaurant:${claims.rid}`]
          : role === "courier"
            ? [`courier:${claims.sid}`]
            : ["admin:ops", "admin:support"];

    return ok(
      { accessToken, expiresAt, topics },
      { headers: { "cache-control": "no-store" } }
    );
  });
}
