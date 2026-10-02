import { handle, ok, readJson } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/admin-session";
import { DomainError } from "@/lib/errors";
import {
  deleteBanner,
  deleteCoupon,
  marketingSnapshot,
  moveBanner,
  pushAudience,
  sendPush,
  toggleCoupon,
  upsertBanner,
  upsertCoupon,
  type BannerInput,
  type CouponInput,
  type PushInput,
} from "@/lib/services/admin";
import type { PushCampaign } from "@/lib/types";

/**
 * GET /api/v1/admin/marketing
 * Kampanyalar, afişler, push geçmişi, bölgeler ve restoranlar.
 * `?segment=&districts=` ile gönderim öncesi hedef kitle sayılır.
 */
export async function GET(request: Request) {
  return handle(async () => {
    await requireAdmin(request);
    const params = new URL(request.url).searchParams;
    const snapshot = await marketingSnapshot();

    const segment = params.get("segment") as PushCampaign["segment"] | null;
    if (segment) {
      const districts = (params.get("districts") ?? "").split(",").filter(Boolean);
      return ok({ ...snapshot, audienceCount: (await pushAudience(segment, districts)).length });
    }
    return ok(snapshot);
  });
}

/**
 * POST /api/v1/admin/marketing
 * Body: { action: "coupon-upsert" | "coupon-delete" | "coupon-toggle" |
 *                 "banner-upsert" | "banner-delete" | "banner-move" | "push-send", ... }
 */
export async function POST(request: Request) {
  return handle(async () => {
    const admin = await requireAdmin(request);
    const body = await readJson<{
      action?: string;
      coupon?: CouponInput;
      originalCode?: string;
      code?: string;
      banner?: BannerInput;
      id?: string;
      direction?: "up" | "down";
      push?: PushInput;
    }>(request);

    switch (body.action) {
      case "coupon-upsert":
        await upsertCoupon(admin, body.coupon as CouponInput, body.originalCode);
        break;
      case "coupon-delete":
        await deleteCoupon(admin, body.code ?? "");
        break;
      case "coupon-toggle":
        await toggleCoupon(admin, body.code ?? "");
        break;
      case "banner-upsert":
        await upsertBanner(admin, body.banner as BannerInput);
        break;
      case "banner-delete":
        await deleteBanner(admin, body.id ?? "");
        break;
      case "banner-move":
        await moveBanner(admin, body.id ?? "", body.direction === "up" ? "up" : "down");
        break;
      case "push-send": {
        const campaign = await sendPush(admin, body.push as PushInput);
        return ok({ ...(await marketingSnapshot()), sent: campaign });
      }
      default:
        throw new DomainError("unknown_action", "Geçersiz işlem. Beklenen: coupon-*, banner-*, push-send.");
    }
    return ok(await marketingSnapshot());
  });
}
