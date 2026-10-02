import { fail, handle, ok } from "@/lib/api/respond";
import { currentVendor } from "@/lib/auth/vendor-session";
import { vendorSummary } from "@/lib/services/vendor";

/** GET /api/v1/vendor/auth/me — panel acilisinda tek istekte onyukleme */
export async function GET(request: Request) {
  return handle(async () => {
    const session = await currentVendor(request);
    if (!session) return fail("vendor_unauthorized", "Giris yapilmamis.", 401);

    return ok({
      vendor: {
        id: session.vendor.id,
        name: session.vendor.name,
        email: session.vendor.email,
      },
      restaurant: session.restaurant,
      summary: vendorSummary(session.restaurant.id),
    });
  });
}
