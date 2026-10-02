import { handle, ok, readJson } from "@/lib/api/respond";
import { refreshSession, sessionPayload } from "@/lib/auth/roles";
import { DomainError } from "@/lib/errors";

/**
 * POST /api/v1/auth/refresh — Body: { refreshToken }
 *
 * Mobil uygulama erişim token'ının süresi dolmadan yenisini alır. Rol
 * değişmez; dört rol de bu ucu kullanır. Web çerezli oturumları sunucu
 * kendiliğinden yeniler.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<{ refreshToken?: string }>(request);
    if (!body.refreshToken) {
      throw new DomainError("refresh_token_required", "Yenileme token'ı gerekli.");
    }
    const { session, role } = await refreshSession(body.refreshToken);
    return ok({ ...sessionPayload(session), role });
  });
}
