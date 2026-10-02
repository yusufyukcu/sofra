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
 * Body: { action: "upsert" | "delete" | "stock" | "option-stock", ... }
 *
 * `stock` ürünü anlık tükendi/satışta yapar; `option-stock` tek bir
 * malzemeyi (ör. "Trüf patates") stoktan düşer.
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

    switch (body.action) {
      case "upsert": {
        const { menu, productId } = await upsertProduct(restaurant.id, body);
        return ok({ menu, productId });
      }
      case "delete":
        return ok({ menu: await deleteProduct(restaurant.id, body.productId ?? "") });
      case "stock":
        return ok({
          menu: await setProductStock(restaurant.id, body.productId ?? "", Boolean(body.soldOut)),
        });
      case "option-stock":
        return ok({
          menu: await setOptionStock(
            restaurant.id,
            body.productId ?? "",
            body.groupId ?? "",
            body.optionId ?? "",
            Boolean(body.soldOut)
          ),
        });
      default:
        throw new DomainError(
          "unknown_action",
          "Geçersiz işlem. Beklenen: upsert, delete, stock, option-stock."
        );
    }
  });
}
