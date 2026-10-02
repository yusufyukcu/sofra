import { handle, ok } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/admin-session";
import { supportQueue, type SupportQueueFilter } from "@/lib/services/support";

const FILTERS: SupportQueueFilter[] = ["open", "closed", "all"];

/**
 * GET /api/v1/admin/support?durum=open|closed|all
 * Destek kuyruğu: temsilci bekleyenler önce, son mesaj ve müşteri bilgisiyle.
 */
export async function GET(request: Request) {
  return handle(async () => {
    await requireAdmin(request);
    const param = new URL(request.url).searchParams.get("durum") as SupportQueueFilter | null;
    return ok(await supportQueue(param && FILTERS.includes(param) ? param : "open"));
  });
}
