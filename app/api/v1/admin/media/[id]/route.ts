import { handle, ok, readJson } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/admin-session";
import { DomainError } from "@/lib/errors";
import {
  adminMediaRequests,
  approveMediaRequest,
  rejectMediaRequest,
} from "@/lib/services/media";

/**
 * POST /api/v1/admin/media/:id
 * Body: { action, reason? }
 *
 *   approve -> fotoğrafı kapağa ya da ürüne işle, müşteri sitesinde yayınla
 *   reject  -> gerekçeyle reddet; gerekçe restoran panelinde görünür
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const admin = await requireAdmin(request);
    const { id } = await ctx.params;
    const body = await readJson<{ action?: string; reason?: string }>(request);

    switch (body.action) {
      case "approve":
        approveMediaRequest(admin, id);
        break;
      case "reject":
        rejectMediaRequest(admin, id, body.reason ?? "");
        break;
      default:
        throw new DomainError(
          "unknown_action",
          "Geçersiz işlem. Beklenen: approve, reject."
        );
    }

    return ok({ rows: adminMediaRequests() });
  });
}
