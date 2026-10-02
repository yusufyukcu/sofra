import { handle, ok, readJson } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/admin-session";
import { DomainError } from "@/lib/errors";
import {
  adminRestaurants,
  setCommissionRate,
  setRestaurantApproval,
} from "@/lib/services/admin";

/**
 * POST /api/v1/admin/restaurants/:id
 * Body: { action, reason?, rate? }
 *
 *   approve    -> yeni restorani onayla, musteri uygulamasinda yayinla
 *   suspend    -> askiya al (listeden kalkar, siparis alamaz)
 *   pending    -> tekrar onay kuyruguna al
 *   commission -> komisyon oranini restoran bazli belirle
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const admin = await requireAdmin(request);
    const { id } = await ctx.params;
    const body = await readJson<{
      action?: string;
      reason?: string;
      rate?: number;
    }>(request);

    switch (body.action) {
      case "approve":
        setRestaurantApproval(admin, id, "approved", body.reason);
        break;
      case "suspend":
        setRestaurantApproval(admin, id, "suspended", body.reason);
        break;
      case "pending":
        setRestaurantApproval(admin, id, "pending", body.reason);
        break;
      case "commission":
        setCommissionRate(admin, id, Number(body.rate));
        break;
      default:
        throw new DomainError(
          "unknown_action",
          "Gecersiz islem. Beklenen: approve, suspend, pending, commission."
        );
    }

    return ok({ rows: adminRestaurants() });
  });
}
