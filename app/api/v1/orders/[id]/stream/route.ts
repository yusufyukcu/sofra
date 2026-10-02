import { requireUser } from "@/lib/auth/session";
import { sseResponse } from "@/lib/api/sse";
import { appSettings } from "@/lib/db/settings";
import { findOrder } from "@/lib/db/queries";
import { progressOf, remainingMinutes } from "@/lib/orders/progress";

/**
 * GET /api/v1/orders/:id/stream — Server-Sent Events ile canlı takip.
 * Sipariş teslim edildiğinde ya da iptal olduğunda akış kapanır.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request).catch(() => null);
  const { id } = await ctx.params;
  const initial = user ? await findOrder(id) : null;

  if (!user || !initial || initial.userId !== user.id) {
    return Response.json(
      { ok: false, error: { code: "order_not_found", message: "Sipariş bulunamadı." } },
      { status: 404 }
    );
  }

  return sseResponse(request, {
    intervalMs: 1500,
    load: async () => {
      const [order, settings] = await Promise.all([findOrder(id), appSettings()]);
      if (!order) return { event: "error", data: { code: "order_not_found" }, done: true };
      const finished = order.status === "delivered" || order.status === "cancelled";
      return {
        event: "update",
        data: { order, progress: progressOf(order, settings), remainingMinutes: remainingMinutes(order) },
        done: finished,
      };
    },
  });
}
