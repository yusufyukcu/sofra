import { handle, ok, readJson } from "@/lib/api/respond";
import { respondWithVendorSession } from "@/lib/auth/vendor-session";
import { vendorLogin, vendorLoginRestaurants } from "@/lib/services/vendor";

/** GET /api/v1/vendor/auth/login — giriş ekranındaki restoran listesi */
export async function GET() {
  return handle(async () => ok({ restaurants: await vendorLoginRestaurants() }));
}

/** POST /api/v1/vendor/auth/login — Body: { restaurantId, pin } */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<{ restaurantId?: string; pin?: string }>(request);
    const { vendor, restaurant } = await vendorLogin(body.restaurantId ?? "", body.pin ?? "");
    return respondWithVendorSession(vendor, restaurant);
  });
}
