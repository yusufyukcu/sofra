import { handle, ok } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/admin-session";
import { adminRestaurants } from "@/lib/services/admin";

/** GET /api/v1/admin/restaurants — onay kuyrugu dahil tum restoranlar */
export async function GET(request: Request) {
  return handle(async () => {
    await requireAdmin(request);
    return ok({ rows: adminRestaurants() });
  });
}
