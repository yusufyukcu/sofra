import { handle, ok, readJson } from "@/lib/api/respond";
import { requireVendor } from "@/lib/auth/vendor-session";
import { DomainError } from "@/lib/errors";
import {
  approveOrder,
  markDelivered,
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
 *   approve    → siparişi onayla, hazırlık süresini bildir
 *   prep-time  → hazırlık süresini güncelle (müşterinin ETA'sı kayar)
 *   ready      → paket hazır, kurye alabilir
 *   dispatch   → restoran kuryesi yola çıktı → "Yolda"
 *   deliver    → restoran kuryesi teslim etti → "Teslim edildi"
 *   reject     → reddet; online ödemede tutar cüzdana iade edilir
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { restaurant } = await requireVendor(request);
    const { id } = await ctx.params;
    const body = await readJson<{ action?: string; prepMinutes?: number; reason?: string }>(request);

    let order;
    switch (body.action) {
      case "approve":
        order = await approveOrder(restaurant.id, id, Number(body.prepMinutes ?? restaurant.defaultPrepMinutes ?? 20));
        break;
      case "prep-time":
        order = await updatePrepTime(restaurant.id, id, Number(body.prepMinutes ?? 20));
        break;
      case "ready":
        order = await markReady(restaurant.id, id);
        break;
      case "dispatch":
        order = await markOnTheWay(restaurant.id, id);
        break;
      case "deliver":
        order = await markDelivered(restaurant.id, id);
        break;
      case "reject":
        order = await rejectOrder(restaurant.id, id, body.reason ?? "");
        break;
      default:
        throw new DomainError(
          "unknown_action",
          "Geçersiz işlem. Beklenen: approve, prep-time, ready, dispatch, deliver, reject."
        );
    }

    return ok({ order, summary: await vendorSummary(restaurant.id) });
  });
}
