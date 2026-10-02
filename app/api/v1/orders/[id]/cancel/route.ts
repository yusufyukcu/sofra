import { handle, ok, readJson } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { cancelOrder } from "@/lib/services/orders";

/**
 * POST /api/v1/orders/:id/cancel
 * Body: { reason?: string }
 *
 * Yalnızca "Onay bekliyor" ve "Hazırlanıyor" durumlarında mümkündür.
 * Online ödemelerde tutar cüzdana iade edilir.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    const body = await readJson<{ reason?: string }>(request);
    const order = cancelOrder(user, id, body.reason ?? "Kullanıcı iptali");
    return ok({ order, walletBalance: user.walletBalance });
  });
}
