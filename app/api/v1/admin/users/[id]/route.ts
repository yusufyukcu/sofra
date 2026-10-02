import { handle, ok, readJson } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/admin-session";
import { DomainError } from "@/lib/errors";
import { adminUsers, creditWallet, setUserBlocked } from "@/lib/services/admin";

/**
 * POST /api/v1/admin/users/:id
 * Body: { action, reason?, amount? }
 *
 *   block   -> kara listeye al (giris ve siparis engellenir)
 *   unblock -> kara listeden cikar
 *   credit  -> manuel bakiye yukleme / dusum
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

    switch (body.action) {
      case "block":
        await setUserBlocked(admin, id, true, body.reason);
        break;
      case "unblock":
        await setUserBlocked(admin, id, false);
        break;
      case "credit":
        await creditWallet(admin, id, Number(body.amount), body.reason ?? "");
        break;
      default:
        throw new DomainError(
          "unknown_action",
          "Gecersiz islem. Beklenen: block, unblock, credit."
        );
    }

    return ok({ rows: await adminUsers() });
  });
}
