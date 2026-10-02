import { handle, ok } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/admin-session";
import { db } from "@/lib/db/store";
import { adminOverview } from "@/lib/services/admin";

/** GET /api/v1/admin/overview — canli operasyon ekrani */
export async function GET(request: Request) {
  return handle(async () => {
    await requireAdmin(request);
    return ok({ ...adminOverview(), audit: db().audit.slice(0, 12) });
  });
}
