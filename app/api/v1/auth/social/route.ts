import { handle, readJson } from "@/lib/api/respond";
import { respondWithSession } from "@/lib/auth/session";
import { socialLogin } from "@/lib/services/auth";
import { listAddresses } from "@/lib/services/account";
import { DomainError } from "@/lib/errors";

/**
 * POST /api/v1/auth/social
 * Body: { provider: "google" | "apple" }
 *
 * Gerçek sistemde sağlayıcıdan dönen `id_token` burada doğrulanır.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<{ provider?: string }>(request);
    if (body.provider !== "google" && body.provider !== "apple") {
      throw new DomainError(
        "unsupported_provider",
        "Desteklenmeyen giriş sağlayıcısı."
      );
    }

    const { user, isNewUser } = socialLogin(body.provider);
    return respondWithSession(user, {
      isNewUser,
      addresses: listAddresses(user),
    });
  });
}
