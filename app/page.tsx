import { activeBanners, publishedRestaurants } from "@/lib/db/store";
import { filtersFromParams, toBase } from "@/lib/discovery";
import { DiscoveryClient } from "@/components/discovery/discovery-client";
import { PartnerPopup } from "@/components/partner/partner-popup";

/**
 * Anasayfa (Keşif).
 *
 * Restoran kataloğu sunucuda okunur ve menüler ayıklanarak istemciye
 * aktarılır; mesafe/teslimat hesapları kullanıcının seçtiği adrese göre
 * istemcide yapılır. Derin bağlantılar (`/?kategori=burger`) sunucuda
 * çözümlenir, böylece ilk boyama doğru filtreyle gelir.
 */
export default async function HomePage(props: PageProps<"/">) {
  const searchParams = await props.searchParams;

  const params = {
    get(key: string) {
      const value = searchParams[key];
      if (Array.isArray(value)) return value[0] ?? null;
      return value ?? null;
    },
  };

  const filters = filtersFromParams(params);
  const restaurants = publishedRestaurants().map(toBase);

  return (
    <>
      <DiscoveryClient
        restaurants={restaurants}
        banners={activeBanners()}
        initialFilters={filters}
      />
      {/* Restoran katılım daveti — ilk ziyarette bir kez görünür */}
      <PartnerPopup />
    </>
  );
}
