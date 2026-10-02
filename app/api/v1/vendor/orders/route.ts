import { handle, ok } from "@/lib/api/respond";
import { requireVendor } from "@/lib/auth/vendor-session";
import { orderBoard, orderHistory, vendorSummary, type OrderHistoryQuery } from "@/lib/services/vendor";

/**
 * GET /api/v1/vendor/orders
 *   → canlı pano: onay bekleyen, hazırlanan, yolda, son 24 saatte kapanan
 *
 * GET /api/v1/vendor/orders?gecmis=1&durum=&baslangic=&bitis=&sayfa=
 *   → geçmiş siparişler ve iptaller, tarih aralığı ve duruma göre sayfalı
 */
export async function GET(request: Request) {
  return handle(async () => {
    const { restaurant } = await requireVendor(request);
    const params = new URL(request.url).searchParams;

    if (params.get("gecmis") === "1") {
      const status = params.get("durum") as OrderHistoryQuery["status"] | null;
      return ok(
        await orderHistory(restaurant.id, {
          status: status ?? "all",
          from: params.get("baslangic") ?? undefined,
          to: params.get("bitis") ?? undefined,
          page: Number(params.get("sayfa") ?? 1) || 1,
        })
      );
    }

    const [board, summary] = await Promise.all([orderBoard(restaurant.id), vendorSummary(restaurant.id)]);
    return ok({ board, summary, autoAccept: restaurant.autoAccept });
  });
}
