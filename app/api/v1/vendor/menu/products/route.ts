import { handle, ok, readJson } from "@/lib/api/respond";
import { requireVendor } from "@/lib/auth/vendor-session";
import { DomainError } from "@/lib/errors";
import {
  deleteProduct,
  setOptionStock,
  setProductStock,
  upsertProduct,
  type ProductInput,
} from "@/lib/services/vendor";

/**
 * POST /api/v1/vendor/menu/products
 * Body: { action, ... }
 *
 *   upsert       → ürün ekle/güncelle (varyant ağacıyla birlikte); yanıtta
 *                  `productId` döner — fotoğraf bu kimlikle onaya gönderilir
 *   delete       → ürünü menüden kaldır
 *   stock        → anlık stok kapat/aç
 *   option-stock → tek bir malzeme/ekstrayı stoktan düş
 */
export async function POST(request: Request) {
  return handle(async () => {
    const { restaurant } = await requireVendor(request);
    const body = await readJson<
      ProductInput & {
        action?: string;
        productId?: string;
        groupId?: string;
        optionId?: string;
        soldOut?: boolean;
      }
    >(request);

    let updated;
    let productId: string | undefined;
    switch (body.action) {
      case "upsert":
        ({ restaurant: updated, productId } = upsertProduct(restaurant.id, body));
        break;
      case "delete":
        updated = deleteProduct(restaurant.id, body.productId ?? "");
        break;
      case "stock":
        updated = setProductStock(
          restaurant.id,
          body.productId ?? "",
          Boolean(body.soldOut)
        );
        break;
      case "option-stock":
        updated = setOptionStock(
          restaurant.id,
          body.productId ?? "",
          body.groupId ?? "",
          body.optionId ?? "",
          Boolean(body.soldOut)
        );
        break;
      default:
        throw new DomainError(
          "unknown_action",
          "Geçersiz işlem. Beklenen: upsert, delete, stock, option-stock."
        );
    }

    return ok({ menu: updated.menu, productId });
  });
}
