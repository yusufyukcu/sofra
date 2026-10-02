import { requireAdmin } from "@/lib/auth/admin-session";
import { sseResponse } from "@/lib/api/sse";
import { recentAudit } from "@/lib/db/queries";
import { adminOverview } from "@/lib/services/admin";

/** GET /api/v1/admin/overview/stream — canlı operasyon ekranı (SSE). */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await requireAdmin(request).catch(() => null);
  if (!admin) {
    return Response.json(
      { ok: false, error: { code: "admin_unauthorized", message: "Yönetici girişi gerekli." } },
      { status: 401 }
    );
  }

  return sseResponse(request, {
    intervalMs: 2500,
    load: async () => {
      const [overview, audit] = await Promise.all([adminOverview(), recentAudit(12)]);
      return { event: "overview", data: { ...overview, audit } };
    },
  });
}
