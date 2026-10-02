import { handle, ok, readJson } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/admin-session";
import { allBanners, allCoupons, db } from "@/lib/db/store";
import { DomainError } from "@/lib/errors";
import {
  deleteBanner,
  deleteCoupon,
  knownDistricts,
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

function snapshot() {
  return {
    coupons: allCoupons(),
    banners: allBanners(),
    campaigns: db().pushCampaigns.slice(0, 20),
    districts: knownDistricts(),
    restaurants: db().restaurants.map((r) => ({
      id: r.id,
      name: r.name,
      emoji: r.emoji,
    })),
  };
}

/** GET /api/v1/admin/marketing — kampanyalar, afişler, push geçmişi */
export async function GET(request: Request) {
  return handle(async () => {
    await requireAdmin(request);
    const params = new URL(request.url).searchParams;

    // Push formu, gönder demeden önce hedef kitleyi sayabilsin
    const segment = params.get("segment") as PushCampaign["segment"] | null;
    if (segment) {
      const districts = (params.get("districts") ?? "")
        .split(",")
        .filter(Boolean);
      return ok({
        ...snapshot(),
        audienceCount: pushAudience(segment, districts).length,
      });
    }

    return ok(snapshot());
  });
}

/**
 * POST /api/v1/admin/marketing
 * Body: { action, ... }
 *
 *   coupon-upsert / coupon-delete / coupon-toggle
 *   banner-upsert / banner-delete / banner-move
 *   push-send
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
        upsertCoupon(admin, body.coupon as CouponInput, body.originalCode);
        break;
      case "coupon-delete":
        deleteCoupon(admin, body.code ?? "");
        break;
      case "coupon-toggle":
        toggleCoupon(admin, body.code ?? "");
        break;
      case "banner-upsert":
        upsertBanner(admin, body.banner as BannerInput);
        break;
      case "banner-delete":
        deleteBanner(admin, body.id ?? "");
        break;
      case "banner-move":
        moveBanner(admin, body.id ?? "", body.direction === "up" ? "up" : "down");
        break;
      case "push-send": {
        const campaign = sendPush(admin, body.push as PushInput);
        return ok({ ...snapshot(), sent: campaign });
      }
      default:
        throw new DomainError(
          "unknown_action",
          "Geçersiz işlem. Beklenen: coupon-*, banner-*, push-send."
        );
    }

    return ok(snapshot());
  });
}
