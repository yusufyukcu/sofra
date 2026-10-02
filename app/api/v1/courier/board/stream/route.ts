import { publicCourier, requireCourier } from "@/lib/auth/courier-session";
import { sseResponse } from "@/lib/api/sse";
import { findCourier } from "@/lib/db/queries";
import { courierBoard } from "@/lib/services/courier";

/**
 * GET /api/v1/courier/board/stream — Server-Sent Events.
 *
 * Kurye uygulaması vardiya boyunca bu akışa bağlı kalır: yeni teklif
 * düştüğünde kart belirir, kalan süre istemcide saniye saniye sayar.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireCourier(request).catch(() => null);
  if (!session) {
    return Response.json(
      { ok: false, error: { code: "courier_unauthorized", message: "Kurye girişi gerekli." } },
      { status: 401 }
    );
  }

  return sseResponse(request, {
    intervalMs: 1500,
    load: async () => {
      const courier = await findCourier(session.id);
      if (!courier) return { event: "error", data: { code: "courier_not_found" }, done: true };
      const board = await courierBoard(courier);
      // Kalan saniye her turda değişir; içerik karşılaştırması sayaç yüzünden
      // her kareyi gönderir — teklif varken istenen davranış budur.
      return { event: "board", data: { ...board, courier: publicCourier(board.courier) } };
    },
  });
}
