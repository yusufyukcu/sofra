import { handle, ok } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/admin-session";
import { adminUsers } from "@/lib/services/admin";

/** GET /api/v1/admin/users?q= — musteri hesaplari */
export async function GET(request: Request) {
  return handle(async () => {
    await requireAdmin(request);
    const q = new URL(request.url).searchParams.get("q") ?? "";
    return ok({ rows: await adminUsers(q) });
  });
}
