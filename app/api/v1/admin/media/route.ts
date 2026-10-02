import { handle, ok } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/admin-session";
import { adminMediaRequests } from "@/lib/services/media";

/**
 * GET /api/v1/admin/media — fotoğraf onay kuyruğu.
 * Bekleyenler geliş sırasıyla başta, ardından son kararlar.
 */
export async function GET(request: Request) {
  return handle(async () => {
    await requireAdmin(request);
    return ok({ rows: adminMediaRequests() });
  });
}
