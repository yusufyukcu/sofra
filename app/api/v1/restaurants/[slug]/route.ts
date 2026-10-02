import { fail, handle, ok } from "@/lib/api/respond";
import { currentUser } from "@/lib/auth/session";
import { DEFAULT_CENTER } from "@/lib/constants";
import { findRestaurant, reviewsOf } from "@/lib/db/store";
import {
  distanceKm,
  etaForDistance,
  isRestaurantOpen,
} from "@/lib/utils";

/**
 * GET /api/v1/restaurants/:slug?lat=&lng=
 * Menü ağacı, teslimat bilgisi ve yorumlarla birlikte restoran detayı.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  return handle(async () => {
    const { slug } = await ctx.params;
    const restaurant = findRestaurant(slug);
    if (!restaurant) {
      return fail("restaurant_not_found", "Restoran bulunamadı.", 404);
    }

    const params = new URL(request.url).searchParams;
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    const point =
      Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)
        ? { lat, lng }
        : DEFAULT_CENTER;

    const user = await currentUser(request);
    const km = distanceKm(point, restaurant.location);
    const eta = etaForDistance(restaurant, km);

    return ok({
      restaurant,
      delivery: {
        distanceKm: Math.round(km * 10) / 10,
        deliverable: km <= restaurant.deliveryRadiusKm,
        etaText: `${eta.min}-${eta.max} dk`,
        open: isRestaurantOpen(restaurant),
      },
      isFavorite: user?.favoriteRestaurantIds.includes(restaurant.id) ?? false,
      reviews: reviewsOf(restaurant.id).slice(0, 20),
    });
  });
}
