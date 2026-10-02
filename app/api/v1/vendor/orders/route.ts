import { handle, ok } from "@/lib/api/respond";
import { requireVendor } from "@/lib/auth/vendor-session";
import { orderBoard, vendorOrders, vendorSummary } from "@/lib/services/vendor";

/**
 * GET /api/v1/vendor/orders
 * ?gecmis=1 verilirse tum siparis gecmisi, aksi halde canli pano.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const { restaurant } = await requireVendor(request);
    const params = new URL(request.url).searchParams;

    if (params.get("gecmis") === "1") {
      return ok({ orders: vendorOrders(restaurant.id) });
    }

    return ok({
      board: orderBoard(restaurant.id),
      summary: vendorSummary(restaurant.id),
      autoAccept: restaurant.autoAccept,
    });
  });
}
