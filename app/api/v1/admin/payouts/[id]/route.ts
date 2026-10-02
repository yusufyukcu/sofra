import { handle, ok, readJson } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/admin-session";
import { DomainError } from "@/lib/errors";
import { adminFinance, setPayoutStatus } from "@/lib/services/admin";

/**
 * POST /api/v1/admin/payouts/:id
 * Body: { action: "approve" | "pay" }
 * Hakedis onay akisi: pending -> approved -> paid.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const admin = await requireAdmin(request);
    const { id } = await ctx.params;
    const body = await readJson<{ action?: string }>(request);

    if (body.action !== "approve" && body.action !== "pay") {
      throw new DomainError(
        "unknown_action",
        "Gecersiz islem. Beklenen: approve, pay."
      );
    }

    await setPayoutStatus(admin, id, body.action);
    return ok(await adminFinance());
  });
}
