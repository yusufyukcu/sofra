import { handle, ok } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { reorder } from "@/lib/services/orders";

/**
 * POST /api/v1/orders/:id/reorder — "Tekrar Sipariş Ver"
 *
 * Eski siparişin satırlarını güncel menüye göre yeniden doğrular; menüden
 * kalkmış veya tükenmiş ürünleri `removed` listesinde bildirir.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    return ok(await reorder(user, id));
  });
}
