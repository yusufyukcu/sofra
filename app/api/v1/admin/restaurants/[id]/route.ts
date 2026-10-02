import { handle, ok, readJson } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/admin-session";
import { DomainError } from "@/lib/errors";
import {
  adminRestaurants,
  setCommissionRate,
  setFeatured,
  setRestaurantApproval,
} from "@/lib/services/admin";

/**
 * POST /api/v1/admin/restaurants/:id
 * Body: { action, reason?, rate?, rank? }
 *
 *   approve | suspend | pending → platform onay durumu
 *   commission                  → restoran bazlı komisyon (0–0,40)
 *   feature                     → öne çıkanlar sırası (rank: 1–99, null = çıkar)
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin(request);
    const { id } = await ctx.params;
    const body = await readJson<{ action?: string; reason?: string; rate?: number; rank?: number | null }>(request);

    switch (body.action) {
      case "approve":
        await setRestaurantApproval(admin, id, "approved", body.reason);
        break;
      case "suspend":
        await setRestaurantApproval(admin, id, "suspended", body.reason);
        break;
      case "pending":
        await setRestaurantApproval(admin, id, "pending", body.reason);
        break;
      case "commission":
        await setCommissionRate(admin, id, Number(body.rate));
        break;
      case "feature":
        await setFeatured(admin, id, body.rank === null || body.rank === undefined ? null : Number(body.rank));
        break;
      default:
        throw new DomainError(
          "unknown_action",
          "Geçersiz işlem. Beklenen: approve, suspend, pending, commission, feature."
        );
    }
    return ok({ rows: await adminRestaurants() });
  });
}
