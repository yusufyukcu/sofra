import { handle, ok, readJson } from "@/lib/api/respond";
import { requireVendor } from "@/lib/auth/vendor-session";
import { DomainError } from "@/lib/errors";
import {
  approveOrder,
  markOnTheWay,
  markReady,
  rejectOrder,
  updatePrepTime,
  vendorSummary,
} from "@/lib/services/vendor";

/**
 * POST /api/v1/vendor/orders/:id
 * Body: { action, prepMinutes?, reason? }
 *
 * Tek uç noktada sipariş aksiyonları:
 *   approve    → siparişi onayla, hazırlık süresini bildir
 *   prep-time  → hazırlık süresini güncelle (müşterinin ETA'sı kayar)
 *   ready      → paket hazır, kurye alabilir (platform kuryesinde)
 *   dispatch   → kuryeye teslim edildi, "Yolda" (restoran kuryesinde)
 *   reject     → reddet; online ödemede tutar cüzdana iade edilir
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { restaurant } = await requireVendor(request);
    const { id } = await ctx.params;
    const body = await readJson<{
      action?: string;
      prepMinutes?: number;
      reason?: string;
    }>(request);

    let order;
    switch (body.action) {
      case "approve":
        order = approveOrder(restaurant.id, id, Number(body.prepMinutes ?? 20));
        break;
      case "prep-time":
        order = updatePrepTime(restaurant.id, id, Number(body.prepMinutes ?? 20));
        break;
      case "ready":
        order = markReady(restaurant.id, id);
        break;
      case "dispatch":
        order = markOnTheWay(restaurant.id, id);
        break;
      case "reject":
        order = rejectOrder(restaurant.id, id, body.reason ?? "");
        break;
      default:
        throw new DomainError(
          "unknown_action",
          "Geçersiz işlem. Beklenen: approve, prep-time, ready, dispatch, reject."
        );
    }

    return ok({ order, summary: vendorSummary(restaurant.id) });
  });
}
