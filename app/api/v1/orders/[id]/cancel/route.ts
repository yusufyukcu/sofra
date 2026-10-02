import { handle, ok, readJson } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { cancelOrder } from "@/lib/services/orders";

/**
 * POST /api/v1/orders/:id/cancel
 * Body: { reason }
 * Onay bekleyen ya da hazırlanan sipariş iptal edilebilir. Online ödemede
 * tutar cüzdana iade edilir; `refunded` iade edilen tutarı bildirir.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    const body = await readJson<{ reason?: string }>(request);
    return ok(await cancelOrder(user, id, body.reason ?? "Kullanıcı iptali"));
  });
}
