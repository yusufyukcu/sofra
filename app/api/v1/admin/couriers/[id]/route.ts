import { handle, ok, readJson } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/admin-session";
import { DomainError } from "@/lib/errors";
import { adminCouriers, setCourierStatus } from "@/lib/services/admin";

/**
 * POST /api/v1/admin/couriers/:id
 * Body: { action: "activate" | "suspend" | "pending", reason? }
 * Askiya alinan kurye derhal mesaiden duser.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const admin = await requireAdmin(request);
    const { id } = await ctx.params;
    const body = await readJson<{ action?: string; reason?: string }>(request);

    const map = {
      activate: "active",
      suspend: "suspended",
      pending: "pending",
    } as const;
    const status = map[body.action as keyof typeof map];

    if (!status) {
      throw new DomainError(
        "unknown_action",
        "Gecersiz islem. Beklenen: activate, suspend, pending."
      );
    }

    await setCourierStatus(admin, id, status, body.reason);
    return ok({ rows: await adminCouriers() });
  });
}
