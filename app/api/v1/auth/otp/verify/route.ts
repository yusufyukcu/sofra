import { handle, readJson } from "@/lib/api/respond";
import { respondWithSession } from "@/lib/auth/session";
import { consumeOtp, customerFromVerifiedTarget } from "@/lib/services/auth";
import { listAddresses } from "@/lib/services/account";

/**
 * POST /api/v1/auth/otp/verify
 * Body: { challengeId: string, code: string, name?: string }
 * → { user, accessToken, addresses, isNewUser } + oturum çerezi
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<{ challengeId?: string; code?: string; name?: string }>(request);
    const verified = await consumeOtp(body.challengeId ?? "", body.code ?? "");
    const { user, isNewUser } = await customerFromVerifiedTarget(verified, body.name);

    return respondWithSession(user, {
      isNewUser,
      addresses: await listAddresses(user),
    });
  });
}
