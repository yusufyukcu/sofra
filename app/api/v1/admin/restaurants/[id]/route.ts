import { handle, ok, readJson } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/admin-session";
import { sql } from "@/lib/db/client";
import { recordAudit } from "@/lib/db/queries";
import { DomainError } from "@/lib/errors";
import {
  adminRestaurants,
  setCommissionRate,
  setFeatured,
  setRestaurantApproval,
} from "@/lib/services/admin";
import { provisionVendorAccount, type VendorInvite } from "@/lib/services/vendor-onboarding";

/**
 * POST /api/v1/admin/restaurants/:id
 * Body: { action, reason?, rate?, rank? }
 *
 *   approve | suspend | pending → platform onay durumu (başvuruyla gelen
 *                                 restoran onaylanınca panel hesabı açılır)
 *   invite                      → işletmeye yeni panel kurulum bağlantısı
 *   commission                  → restoran bazlı komisyon (0–0,40)
 *   feature                     → öne çıkanlar sırası (rank: 1–99, null = çıkar)
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin(request);
    const { id } = await ctx.params;
    const body = await readJson<{ action?: string; reason?: string; rate?: number; rank?: number | null }>(request);

    let invite: VendorInvite | null = null;

    switch (body.action) {
      case "approve": {
        const { vendorMemberId } = await setRestaurantApproval(admin, id, "approved", body.reason);
        if (vendorMemberId) invite = await provisionVendorAccount(vendorMemberId);
        break;
      }
      case "suspend":
        await setRestaurantApproval(admin, id, "suspended", body.reason);
        break;
      case "pending":
        await setRestaurantApproval(admin, id, "pending", body.reason);
        break;
      case "invite": {
        const [member] = await sql<{ id: string }[]>`
          select id from public.vendor_members where restaurant_id = ${id} order by created_at limit 1
        `;
        if (!member) throw new DomainError("vendor_not_found", "Bu restoranın panel hesabı yok.", 404);
        invite = await provisionVendorAccount(member.id);
        await recordAudit(admin.name, "Panel kurulum bağlantısı üretildi", invite.email);
        break;
      }
      case "commission":
        await setCommissionRate(admin, id, Number(body.rate));
        break;
      case "feature":
        await setFeatured(admin, id, body.rank === null || body.rank === undefined ? null : Number(body.rank));
        break;
      default:
        throw new DomainError(
          "unknown_action",
          "Geçersiz işlem. Beklenen: approve, suspend, pending, invite, commission, feature."
        );
    }
    return ok({ rows: await adminRestaurants(), invite });
  });
}
