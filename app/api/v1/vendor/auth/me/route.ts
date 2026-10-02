import { fail, handle, ok } from "@/lib/api/respond";
import { currentVendor } from "@/lib/auth/vendor-session";
import { vendorSummary } from "@/lib/services/vendor";

/** GET /api/v1/vendor/auth/me — işletme oturumu, restoran ve günlük özet */
export async function GET(request: Request) {
  return handle(async () => {
    const session = await currentVendor(request);
    if (!session) return fail("vendor_unauthorized", "Giriş yapılmamış.", 401);
    return ok({
      vendor: { id: session.vendor.id, name: session.vendor.name, email: session.vendor.email },
      restaurant: session.restaurant,
      summary: await vendorSummary(session.restaurant.id),
    });
  });
}
