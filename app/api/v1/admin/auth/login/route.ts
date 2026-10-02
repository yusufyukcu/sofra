import { handle, readJson } from "@/lib/api/respond";
import { respondWithAdminSession } from "@/lib/auth/admin-session";
import { adminLogin } from "@/lib/services/admin";

/**
 * POST /api/v1/admin/auth/login
 * Body: { pin }
 * Prototipte tek yonetici hesabi ve PIN; uretimde parola + 2FA olur.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<{ pin?: string }>(request);
    return respondWithAdminSession(adminLogin(body.pin ?? ""));
  });
}
