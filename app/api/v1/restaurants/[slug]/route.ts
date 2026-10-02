import { fail, handle, ok } from "@/lib/api/respond";
import { currentUser } from "@/lib/auth/session";
import { DEFAULT_CENTER } from "@/lib/constants";
import { customerMenu, findRestaurant, reviewsOf } from "@/lib/db/queries";
import { distanceKm, etaForDistance, isInDeliveryZone, isRestaurantOpen } from "@/lib/utils";

/**
 * GET /api/v1/restaurants/:slug?lat=&lng=
 * Menü ağacı, teslimat bilgisi ve yorumlarla birlikte restoran detayı.
 * Onay bekleyen ya da askıya alınan restoran müşteriye görünmez.
 */
export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const { slug } = await ctx.params;
    const restaurant = await findRestaurant(slug);
    if (!restaurant || restaurant.approvalStatus !== "approved") {
      return fail("restaurant_not_found", "Restoran bulunamadı.", 404);
    }

    const params = new URL(request.url).searchParams;
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    const point =
      Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)
        ? { lat, lng }
        : DEFAULT_CENTER;

    const [user, reviews] = await Promise.all([currentUser(request), reviewsOf(restaurant.id, 20)]);
    const km = distanceKm(point, restaurant.location);
    const eta = etaForDistance(restaurant, km);

    return ok({
      restaurant: customerMenu(restaurant),
      delivery: {
        distanceKm: Math.round(km * 10) / 10,
        deliverable: isInDeliveryZone(restaurant, point),
        etaText: `${eta.min}-${eta.max} dk`,
        open: isRestaurantOpen(restaurant),
      },
      isFavorite: user?.favoriteRestaurantIds.includes(restaurant.id) ?? false,
      reviews,
    });
  });
}
