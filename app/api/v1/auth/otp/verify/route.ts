import { handle, readJson } from "@/lib/api/respond";
import { respondWithSession } from "@/lib/auth/session";
import { verifyOtp } from "@/lib/services/auth";
import { listAddresses } from "@/lib/services/account";

/**
 * POST /api/v1/auth/otp/verify
 * Body: { challengeId: string, code: string, name?: string }
 * → { user, accessToken, addresses, isNewUser } + oturum çerezi
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<{
      challengeId?: string;
      code?: string;
      name?: string;
    }>(request);

    const { user, isNewUser } = verifyOtp(
      body.challengeId ?? "",
      body.code ?? "",
      body.name
    );

    return respondWithSession(user, {
      isNewUser,
      addresses: listAddresses(user),
    });
  });
}
