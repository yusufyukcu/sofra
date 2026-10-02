import { requireVendor } from "@/lib/auth/vendor-session";
import { sseResponse } from "@/lib/api/sse";
import { orderBoard, vendorSummary } from "@/lib/services/vendor";

/**
 * GET /api/v1/vendor/orders/stream — canlı sipariş panosu (SSE).
 * Panel yeni "onay bekliyor" siparişini görünce zil çalar.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireVendor(request).catch(() => null);
  if (!session) {
    return Response.json(
      { ok: false, error: { code: "vendor_unauthorized", message: "İşletme girişi gerekli." } },
      { status: 401 }
    );
  }
  const restaurantId = session.restaurant.id;

  return sseResponse(request, {
    intervalMs: 2000,
    load: async () => {
      const [board, summary] = await Promise.all([orderBoard(restaurantId), vendorSummary(restaurantId)]);
      return { event: "board", data: { board, summary } };
    },
  });
}
