import { fail, handle, ok, readJson } from "@/lib/api/respond";
import { vendorPasswordLogin, vendorSessionResponse } from "@/lib/auth/vendor-session";
import { completeInvite, inviteInfo } from "@/lib/services/vendor-onboarding";
import { vendorSummary } from "@/lib/services/vendor";

/**
 * GET /api/v1/vendor/auth/setup?anahtar= — kurulum bağlantısı geçerli mi
 * (işletme adı ve giriş e-postası döner).
 */
export async function GET(request: Request) {
  return handle(async () => {
    const token = new URL(request.url).searchParams.get("anahtar");
    if (!token) return fail("token_required", "Kurulum anahtarı eksik.");
    return ok(await inviteInfo(token));
  });
}

/**
 * POST /api/v1/vendor/auth/setup — Body: { token, password }
 * Parolayı belirler, bağlantıyı tüketir ve işletme oturumu açar.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<{ token?: string; password?: string }>(request);
    const { email } = await completeInvite(body.token ?? "", body.password ?? "");
    const { vendor, restaurant, session } = await vendorPasswordLogin(email, body.password ?? "");
    return vendorSessionResponse(vendor, restaurant, session, {
      summary: await vendorSummary(restaurant.id),
    });
  });
}
