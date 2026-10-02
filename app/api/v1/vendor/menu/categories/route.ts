import { handle, ok, readJson } from "@/lib/api/respond";
import { requireVendor } from "@/lib/auth/vendor-session";
import { DomainError } from "@/lib/errors";
import {
  deleteCategory,
  moveCategory,
  upsertCategory,
} from "@/lib/services/vendor";

/**
 * POST /api/v1/vendor/menu/categories
 * Body: { action: "upsert" | "delete" | "move", ... }
 *
 * Menü kategorilerinin sırası müşteri menüsündeki sırayı belirler,
 * bu yüzden taşıma da bir işlem olarak buradan yürütülür.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const { restaurant } = await requireVendor(request);
    const body = await readJson<{
      action?: string;
      id?: string;
      name?: string;
      description?: string;
      direction?: "up" | "down";
    }>(request);

    let updated;
    switch (body.action) {
      case "upsert":
        updated = upsertCategory(restaurant.id, {
          id: body.id,
          name: body.name ?? "",
          description: body.description,
        });
        break;
      case "delete":
        updated = deleteCategory(restaurant.id, body.id ?? "");
        break;
      case "move":
        updated = moveCategory(
          restaurant.id,
          body.id ?? "",
          body.direction === "up" ? "up" : "down"
        );
        break;
      default:
        throw new DomainError(
          "unknown_action",
          "Geçersiz işlem. Beklenen: upsert, delete, move."
        );
    }

    return ok({ menu: updated.menu });
  });
}
