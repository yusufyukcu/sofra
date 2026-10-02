import { handle, ok, readJson } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/admin-session";
import { DomainError } from "@/lib/errors";
import { adminCancelOrder, adminRefund } from "@/lib/services/admin";

/**
 * POST /api/v1/admin/orders/:id
 * Body: { action: "cancel" | "refund", reason?, amount? }
 * Siparis iptalleri ve iade operasyonlarinin manuel yonetimi.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const admin = await requireAdmin(request);
    const { id } = await ctx.params;
    const body = await readJson<{
      action?: string;
      reason?: string;
      amount?: number;
    }>(request);

    if (body.action === "cancel") {
      return ok({ order: await adminCancelOrder(admin, id, body.reason ?? "") });
    }
    if (body.action === "refund") {
      return ok(await adminRefund(admin, id, Number(body.amount), body.reason ?? ""));
    }

    throw new DomainError(
      "unknown_action",
      "Gecersiz islem. Beklenen: cancel, refund."
    );
  });
}
