import { handle, ok } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { appSettings } from "@/lib/db/settings";
import { progressOf, remainingMinutes } from "@/lib/orders/progress";
import { getOrder } from "@/lib/services/orders";

/** GET /api/v1/orders/:id — tek sipariş + takip bilgisi */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    const [order, settings] = await Promise.all([getOrder(user, id), appSettings()]);

    return ok({
      order,
      progress: progressOf(order, settings),
      remainingMinutes: remainingMinutes(order),
    });
  });
}
