import { handle, ok, readJson } from "@/lib/api/respond";
import { publicCourier, requireCourier } from "@/lib/auth/courier-session";
import { DomainError } from "@/lib/errors";
import {
  advanceStage,
  courierBoard,
  type StageAction,
} from "@/lib/services/courier";

const ACTIONS: StageAction[] = ["arrived", "pickup", "deliver"];

/**
 * POST /api/v1/courier/orders/:id
 * Body: { action: "arrived" | "pickup" | "deliver" }
 *
 * Asama bildirimleri: Restorana vardim -> Teslim aldim -> Teslim ettim.
 * `pickup` siparisi musteri tarafinda "Yolda"ya, `deliver` ise
 * "Teslim edildi"ye cevirir ve kurye kazancini kaydeder.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const courier = await requireCourier(request);
    const { id } = await ctx.params;
    const body = await readJson<{ action?: StageAction }>(request);

    if (!body.action || !ACTIONS.includes(body.action)) {
      throw new DomainError(
        "unknown_action",
        "Gecersiz islem. Beklenen: arrived, pickup, deliver."
      );
    }

    const order = advanceStage(courier, id, body.action);
    const board = courierBoard(courier);
    return ok({ order, ...board, courier: publicCourier(board.courier) });
  });
}
