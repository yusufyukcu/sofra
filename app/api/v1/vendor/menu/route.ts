import { handle, ok } from "@/lib/api/respond";
import { requireVendor } from "@/lib/auth/vendor-session";

/** GET /api/v1/vendor/menu — restoranın tüm menüsü (tükenenler dahil) */
export async function GET(request: Request) {
  return handle(async () => {
    const { restaurant } = await requireVendor(request);
    const products = restaurant.menu.flatMap((c) => c.products);
    return ok({
      menu: restaurant.menu,
      productCount: products.length,
      soldOutCount: products.filter((p) => p.soldOut).length,
    });
  });
}
