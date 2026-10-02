import { handle, ok } from "@/lib/api/respond";
import { requireVendor } from "@/lib/auth/vendor-session";

/** GET /api/v1/vendor/menu — restoranın güncel menü ağacı */
export async function GET(request: Request) {
  return handle(async () => {
    const { restaurant } = await requireVendor(request);
    return ok({
      menu: restaurant.menu,
      productCount: restaurant.menu.reduce(
        (sum, category) => sum + category.products.length,
        0
      ),
      soldOutCount: restaurant.menu.reduce(
        (sum, category) =>
          sum + category.products.filter((p) => p.soldOut).length,
        0
      ),
    });
  });
}
