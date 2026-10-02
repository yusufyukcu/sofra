import { handle, readJson } from "@/lib/api/respond";
import { respondWithCourierSession } from "@/lib/auth/courier-session";
import { DomainError } from "@/lib/errors";
import { consumeOtp } from "@/lib/services/auth";
import { courierByPhone, courierStats } from "@/lib/services/courier";

/**
 * POST /api/v1/courier/auth/otp/verify
 * Body: { challengeId, code }
 * → { courier, stats, accessToken, refreshToken, expiresAt } + oturum çerezi
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<{ challengeId?: string; code?: string }>(request);
    const verified = await consumeOtp(body.challengeId ?? "", body.code ?? "");
    if (verified.purpose !== "courier") {
      throw new DomainError("otp_purpose", "Bu doğrulama kodu kurye girişi için değil.");
    }
    const courier = await courierByPhone(verified.target);
    if (!courier) {
      throw new DomainError("courier_not_found", "Bu numarayla kayıtlı bir kurye hesabı yok.", 404);
    }
    return respondWithCourierSession(courier, { stats: await courierStats(courier) });
  });
}
