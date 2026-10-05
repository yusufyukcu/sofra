import { handle, ok } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { arrivalAt, progressOf, remainingMinutes } from "@/lib/orders/progress";
import { getOrder } from "@/lib/services/orders";

/**
 * GET /api/v1/orders/:id — tek sipariş + takip bilgisi.
 * Kurye yoldaysa ve konumu canlıysa `remainingMinutes` ile `arrivalAt`
 * kuryenin önündeki gerçek yoldan hesaplanır; değilse planlanan saatten.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    const order = await getOrder(user, id);
    const now = Date.now();

    return ok({
      order,
      progress: progressOf(order, now),
      remainingMinutes: remainingMinutes(order, now),
      arrivalAt: arrivalAt(order, now),
    });
  });
}
