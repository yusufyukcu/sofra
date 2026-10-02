import { handle, ok, readJson } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { DEFAULT_CENTER } from "@/lib/constants";
import { publishedRestaurantBases } from "@/lib/db/queries";
import { decorate } from "@/lib/discovery";
import { toggleFavorite } from "@/lib/services/account";
import { DomainError } from "@/lib/errors";

/** GET /api/v1/favorites — favori restoranlar (liste kartı formatında) */
export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    const params = new URL(request.url).searchParams;
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    const point =
      Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)
        ? { lat, lng }
        : DEFAULT_CENTER;

    const restaurants = await publishedRestaurantBases();
    const favorites = decorate(
      restaurants.filter((r) => user.favoriteRestaurantIds.includes(r.id)),
      point,
      user.favoriteRestaurantIds
    );

    return ok({ favorites, favoriteIds: user.favoriteRestaurantIds });
  });
}

/** POST /api/v1/favorites — favoriye ekle/çıkar */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    const body = await readJson<{ restaurantId?: string }>(request);
    if (!body.restaurantId) {
      throw new DomainError("restaurant_id_required", "Restoran seçilmedi.");
    }
    const favoriteIds = await toggleFavorite(user, body.restaurantId);
    return ok({ favoriteIds, isFavorite: favoriteIds.includes(body.restaurantId) });
  });
}
