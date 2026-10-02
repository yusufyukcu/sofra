import { handle, ok, readJson } from "@/lib/api/respond";
import { respondWithVendorSession } from "@/lib/auth/vendor-session";
import { allRestaurants } from "@/lib/db/store";
import { vendorLogin } from "@/lib/services/vendor";

/**
 * GET /api/v1/vendor/auth/login
 * Giriş ekranındaki restoran seçici için hafif liste.
 * (Prototip kolaylığı; üretimde işletme e-posta + parola ile giriş yapar.)
 */
export async function GET() {
  return handle(async () =>
    ok({
      restaurants: allRestaurants().map((r) => ({
        id: r.id,
        name: r.name,
        emoji: r.emoji,
        district: r.district,
        tags: r.tags,
      })),
    })
  );
}

/**
 * POST /api/v1/vendor/auth/login
 * Body: { restaurantId, pin }
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<{ restaurantId?: string; pin?: string }>(request);
    const { vendor, restaurant } = vendorLogin(
      body.restaurantId ?? "",
      body.pin ?? ""
    );
    return respondWithVendorSession(vendor, restaurant);
  });
}
