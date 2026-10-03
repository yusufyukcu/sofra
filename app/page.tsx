import { connection } from "next/server";
import { activeBanners, publishedRestaurantBases } from "@/lib/db/queries";
import { filtersFromParams } from "@/lib/discovery";
import { DiscoveryClient } from "@/components/discovery/discovery-client";

/**
 * Anasayfa (Keşif).
 *
 * Restoran kataloğu sunucuda veritabanından okunur (menüsüz) ve istemciye
 * aktarılır; mesafe/teslimat hesapları kullanıcının seçtiği adrese göre
 * istemcide yapılır. Derin bağlantılar (`/?kategori=burger`) sunucuda
 * çözümlenir, böylece ilk boyama doğru filtreyle gelir.
 */
export default async function HomePage(props: PageProps<"/">) {
  // Katalog her istekte güncel okunur (restoran paneli anında değiştirebilir)
  await connection();
  const searchParams = await props.searchParams;

  const params = {
    get(key: string) {
      const value = searchParams[key];
      if (Array.isArray(value)) return value[0] ?? null;
      return value ?? null;
    },
  };

  const [restaurants, banners] = await Promise.all([publishedRestaurantBases(), activeBanners()]);

  return (
    <DiscoveryClient
      restaurants={restaurants}
      banners={banners}
      initialFilters={filtersFromParams(params)}
    />
  );
}
