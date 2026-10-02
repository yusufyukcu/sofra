import { handle } from "@/lib/api/respond";
import { respondWithSession } from "@/lib/auth/session";
import { demoLogin } from "@/lib/services/auth";
import { listAddresses } from "@/lib/services/account";

/**
 * POST /api/v1/auth/demo
 * Hazır demo hesabıyla tek tıkla giriş — yalnızca demo modu açıkken.
 */
export async function POST() {
  return handle(async () => {
    const user = await demoLogin();
    return respondWithSession(user, {
      isNewUser: false,
      addresses: await listAddresses(user),
    });
  });
}
