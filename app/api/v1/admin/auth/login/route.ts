import { handle, readJson } from "@/lib/api/respond";
import { adminPasswordLogin, adminSessionResponse } from "@/lib/auth/admin-session";

/**
 * POST /api/v1/admin/auth/login — Body: { email, password }
 * Yönetici oturumu girişten 4 saat sonra kapanır.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<{ email?: string; password?: string }>(request);
    const { admin, session } = await adminPasswordLogin(body.email ?? "", body.password ?? "");
    return adminSessionResponse(admin, session);
  });
}
