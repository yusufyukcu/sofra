import { handle, readJson } from "@/lib/api/respond";
import { respondWithSession } from "@/lib/auth/session";
import { socialTestLogin } from "@/lib/services/auth";
import { listAddresses } from "@/lib/services/account";
import { DomainError } from "@/lib/errors";

/**
 * POST /api/v1/auth/social
 * Body: { provider: "google" | "apple" }
 *
 * Google/Apple sağlayıcısı Supabase'te yapılandırılana kadar test
 * profiliyle giriş yapılır.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<{ provider?: string }>(request);
    if (body.provider !== "google" && body.provider !== "apple") {
      throw new DomainError("unsupported_provider", "Desteklenmeyen giriş sağlayıcısı.");
    }

    const { user, isNewUser } = await socialTestLogin(body.provider);
    return respondWithSession(user, {
      isNewUser,
      addresses: await listAddresses(user),
    });
  });
}
