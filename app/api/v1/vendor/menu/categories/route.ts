import { handle, ok, readJson } from "@/lib/api/respond";
import { requireVendor } from "@/lib/auth/vendor-session";
import { DomainError } from "@/lib/errors";
import { deleteCategory, moveCategory, upsertCategory } from "@/lib/services/vendor";

/**
 * POST /api/v1/vendor/menu/categories
 * Body: { action: "upsert" | "delete" | "move", id?, name?, description?, direction? }
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

    let menu;
    switch (body.action) {
      case "upsert":
        menu = await upsertCategory(restaurant.id, {
          id: body.id,
          name: body.name ?? "",
          description: body.description,
        });
        break;
      case "delete":
        menu = await deleteCategory(restaurant.id, body.id ?? "");
        break;
      case "move":
        menu = await moveCategory(restaurant.id, body.id ?? "", body.direction === "up" ? "up" : "down");
        break;
      default:
        throw new DomainError("unknown_action", "Geçersiz işlem. Beklenen: upsert, delete, move.");
    }

    return ok({ menu });
  });
}
