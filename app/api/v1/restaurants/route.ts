import { handle, ok } from "@/lib/api/respond";
import { currentUser } from "@/lib/auth/session";
import { CATEGORIES, DEFAULT_CENTER } from "@/lib/constants";
import { activeBanners, publishedRestaurantBases } from "@/lib/db/queries";
import { decorate, filterAndSort, filtersFromParams } from "@/lib/discovery";

/**
 * GET /api/v1/restaurants
 *
 * Sorgu parametreleri (hepsi opsiyonel):
 *   lat, lng     → kullanıcı konumu (yoksa varsayılan merkez)
 *   kategori     → all | top-rated | burger | kebap | ...
 *   q            → arama metni
 *   sirala       → recommended | rating | eta | distance | minBasket
 *   puan         → minimum restoran puanı
 *   sure         → en fazla teslimat süresi (dk)
 *   sepet        → en fazla minimum sepet tutarı
 *   acik         → 1 ise yalnızca şu an açık olanlar
 *   ucretsiz     → 1 ise yalnızca ücretsiz teslimat sunanlar
 *   bolge        → 0 ise teslimat bölgesi dışındakiler de listelenir
 */
export async function GET(request: Request) {
  return handle(async () => {
    const params = new URL(request.url).searchParams;
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    const point =
      Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)
        ? { lat, lng }
        : DEFAULT_CENTER;

    const [user, restaurants, banners] = await Promise.all([
      currentUser(request),
      publishedRestaurantBases(),
      activeBanners(),
    ]);

    const decorated = decorate(restaurants, point, user?.favoriteRestaurantIds ?? []);
    const filters = filtersFromParams(params);

    return ok({
      restaurants: filterAndSort(decorated, filters),
      total: decorated.length,
      filters,
      point,
      categories: CATEGORIES,
      banners,
      featured: decorated
        .filter((r) => r.featuredRank !== null && r.featuredRank !== undefined)
        .sort((a, b) => (a.featuredRank ?? 0) - (b.featuredRank ?? 0)),
    });
  });
}
