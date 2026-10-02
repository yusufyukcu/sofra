import { handle, ok } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/admin-session";
import { adminFinance } from "@/lib/services/admin";

/** GET /api/v1/admin/finance — GMV, net gelir, odeme gecidi, hakedisler */
export async function GET(request: Request) {
  return handle(async () => {
    await requireAdmin(request);
    return ok(await adminFinance());
  });
}
