import { handle, ok } from "@/lib/api/respond";
import { publicCourier, requireCourier } from "@/lib/auth/courier-session";
import { courierBoard } from "@/lib/services/courier";

/**
 * GET /api/v1/courier/board
 * Kurye ana ekranının tamamı: vardiya durumu, bekleyen teklif (kalan
 * süresiyle), açık teslimat ve günün özeti.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const courier = await requireCourier(request);
    const board = await courierBoard(courier);
    return ok({ ...board, courier: publicCourier(board.courier) });
  });
}
