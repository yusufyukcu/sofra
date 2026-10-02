import { handle, ok } from "@/lib/api/respond";
import { currentUser } from "@/lib/auth/session";
import { CATEGORIES, DEFAULT_CENTER } from "@/lib/constants";
import { activeBanners, publishedRestaurants } from "@/lib/db/store";
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
 *
 * Web istemcisi anasayfayı sunucuda render ettiği için bu uç noktayı esas
 * olarak mobil uygulama kullanacak; filtreleme mantığı (`lib/discovery.ts`)
 * her iki tarafta ortaktır.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const url = new URL(request.url);
    const params = url.searchParams;

    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    const point =
      Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)
        ? { lat, lng }
        : DEFAULT_CENTER;

    const user = await currentUser(request);
    const filters = filtersFromParams(params);

    const decorated = decorate(
      publishedRestaurants(),
      point,
      user?.favoriteRestaurantIds ?? []
    );
    const restaurants = filterAndSort(decorated, filters);

    return ok({
      restaurants,
      total: decorated.length,
      filters,
      point,
      categories: CATEGORIES,
      banners: activeBanners(),
    });
  });
}
