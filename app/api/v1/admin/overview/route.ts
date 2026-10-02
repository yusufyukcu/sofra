import { handle, ok } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/admin-session";
import { recentAudit } from "@/lib/db/queries";
import { adminOverview } from "@/lib/services/admin";

/** GET /api/v1/admin/overview — canlı operasyon özeti + son yönetici işlemleri */
export async function GET(request: Request) {
  return handle(async () => {
    await requireAdmin(request);
    const [overview, audit] = await Promise.all([adminOverview(), recentAudit(12)]);
    return ok({ ...overview, audit });
  });
}
