import { handle, ok, readJson } from "@/lib/api/respond";
import { publicCourier, requireCourier } from "@/lib/auth/courier-session";
import { DomainError } from "@/lib/errors";
import { acceptOffer, courierBoard, rejectOffer } from "@/lib/services/courier";

/**
 * POST /api/v1/courier/offers/:id
 * Body: { action: "accept" | "reject" }
 *
 * Teklifler sure kisitlidir; suresi dolmus bir teklif kabul edilemez
 * (`offer_expired`) ve sipariş sıradaki en yakın kuryeye gider.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const courier = await requireCourier(request);
    const { id } = await ctx.params;
    const body = await readJson<{ action?: string }>(request);

    if (body.action === "accept") {
      acceptOffer(courier, id);
    } else if (body.action === "reject") {
      rejectOffer(courier, id);
    } else {
      throw new DomainError(
        "unknown_action",
        "Gecersiz islem. Beklenen: accept, reject."
      );
    }

    const board = courierBoard(courier);
    return ok({ ...board, courier: publicCourier(board.courier) });
  });
}
