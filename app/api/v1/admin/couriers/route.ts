import { handle, ok } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/admin-session";
import { adminCouriers } from "@/lib/services/admin";

/** GET /api/v1/admin/couriers — aktivasyon kuyrugu dahil tum kuryeler */
export async function GET(request: Request) {
  return handle(async () => {
    await requireAdmin(request);
    return ok({ rows: await adminCouriers() });
  });
}
