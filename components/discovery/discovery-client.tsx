"use client";

import { Search, SearchX, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES } from "@/lib/constants";
import {
  DEFAULT_FILTERS,
  decorate,
  filterAndSort,
  filtersFromParams,
  filtersToSearchParams,
  type DiscoveryFilters,
  type RestaurantBase,
} from "@/lib/discovery";
import { useDebounced } from "@/lib/hooks";
import { deliveryLabel, deliveryPoint, useSession } from "@/lib/store/session";
import type { Banner, CategoryId } from "@/lib/types";
import { Button, EmptyState } from "@/components/ui/primitives";
import { ActiveOrdersStrip } from "@/components/order/active-orders-strip";
import { BannerSlider } from "./banner-slider";
import { CategoryRail, FilterBar, FilterPanel } from "./filters";
import { RestaurantCard } from "./restaurant-card";

/**
 * Anasayfa keşif deneyimi.
 *
 * Restoran listesi sunucuda render edilir; mesafe hesabı, filtreleme ve
 * sıralama kullanıcının seçtiği adrese göre istemcide anlık yapılır.
 * Filtreler `history.replaceState` ile URL'e yazılır: derin bağlantılar
 * çalışır, her tuşta sunucuya gidilmez.
 *
 * Masaüstünde filtreler listenin solunda yapışkan bir panelde durur;
 * mobilde sıralama, filtre penceresi ve hızlı filtreler tek bir yapışkan
 * çubukta toplanır.
 */
export function DiscoveryClient({
  restaurants,
  banners,
  initialFilters,
}: {
  restaurants: RestaurantBase[];
  banners: Banner[];
  initialFilters: DiscoveryFilters;
}) {
  const [filters, setFilters] = useState<DiscoveryFilters>(initialFilters);
  const debouncedQuery = useDebounced(filters.query, 250);

  const searchParams = useSearchParams();
  /** URL'e en son bizim yazdığımız sorgu — dışarıdan gelen gezinmeyi ayırır */
  const writtenQuery = useRef(searchParams.toString());

  const point = useSession(deliveryPoint);
  const label = useSession(deliveryLabel);
  const favoriteIds = useSession((s) => s.user?.favoriteRestaurantIds);
  const hasLocation = useSession((s) =>
    Boolean(s.selectedAddressId || s.guestPoint)
  );

  // Anasayfadayken başlıktaki arama ya da alt bilgideki bağlantılar URL'i
  // değiştirir ama bileşen yeniden kurulmaz; filtreleri URL'den tazele.
  useEffect(() => {
    const current = searchParams.toString();
    if (current === writtenQuery.current) return;
    writtenQuery.current = current;
    setFilters(filtersFromParams(searchParams));
  }, [searchParams]);

  useEffect(() => {
    // Yazım sürerken bekle; gecikmeli sorgu yetişince tek seferde yaz
    if (filters.query !== debouncedQuery) return;
    const query = filtersToSearchParams(filters).toString();
    if (query === writtenQuery.current) return;
    writtenQuery.current = query;
    window.history.replaceState(null, "", query ? `/?${query}` : "/");
  }, [filters, debouncedQuery]);

  const decorated = useMemo(
    () => decorate(restaurants, point, favoriteIds ?? []),
    [restaurants, point, favoriteIds]
  );

  const results = useMemo(
    () => filterAndSort(decorated, { ...filters, query: debouncedQuery }),
    [decorated, filters, debouncedQuery]
  );

  const counts = useMemo(() => {
    const base = filterAndSort(decorated, {
      ...filters,
      query: debouncedQuery,
      category: "all",
    });
    const map: Record<string, number> = { all: base.length };
    for (const category of CATEGORIES) {
      if (category.id === "all") continue;
      map[category.id] =
        category.id === "top-rated"
          ? base.filter((r) => r.rating >= 4.5).length
          : base.filter((r) => r.tags.includes(category.id as never)).length;
    }
    return map;
  }, [decorated, filters, debouncedQuery]);

  const deliverable = decorated.filter((r) => r.deliverable);
  const avgEta = deliverable.length
    ? Math.round(
        deliverable.reduce((sum, r) => sum + (r.etaMin + r.etaMax) / 2, 0) /
          deliverable.length
      )
    : 0;

  const activeCategory = CATEGORIES.find((c) => c.id === filters.category);
  const activeQuery = debouncedQuery.trim();

  return (
    <>
      {/* Koyu bant — başlıktan devam eder, tek işi burada karşılar */}
      <section className="band-deep">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 pb-6 pt-5 lg:flex-row lg:items-end lg:justify-between lg:gap-10 lg:px-6 lg:py-8">
          <h1 className="font-display max-w-[16ch] text-[1.75rem] font-extrabold leading-[1.08] text-on-deep sm:text-4xl lg:max-w-none">
            Bugün canın ne çekiyor?
          </h1>

          <form onSubmit={(e) => e.preventDefault()} className="max-w-xl lg:hidden">
            <label className="flex h-12 items-center gap-2.5 rounded-2xl border border-white/12 bg-white/10 px-4 transition-colors focus-within:border-white/30 focus-within:bg-white/15">
              <Search className="size-[18px] shrink-0 text-on-deep-muted" />
              <input
                value={filters.query}
                onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                placeholder="Restoran veya mutfak ara"
                aria-label="Restoran ara"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-on-deep placeholder:text-on-deep-muted focus:outline-none"
              />
              {filters.query && (
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, query: "" })}
                  aria-label="Aramayı temizle"
                >
                  <X className="size-4 text-on-deep-muted" />
                </button>
              )}
            </label>
          </form>

          <p className="tabular text-sm leading-relaxed text-balance text-on-deep-muted lg:max-w-md lg:pb-1 lg:text-right">
            {hasLocation ? (
              <>
                <span className="font-semibold text-on-deep">{label}</span>{" "}
                adresine {deliverable.length} restoran teslimat yapıyor
                {avgEta > 0 && <> · ortalama {avgEta} dakika</>}
              </>
            ) : (
              <>
                Şu an Kadıköy merkez için listeliyoruz. Üstteki adres alanından
                kendi konumunu seç, süreler sana göre hesaplansın.
              </>
            )}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="space-y-6 pt-6 lg:space-y-8 lg:pt-8">
          <ActiveOrdersStrip />
          <BannerSlider banners={banners} />
        </div>

        <div className="mt-8 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-6">
          <aside
            aria-label="Filtreler"
            className="hidden lg:sticky lg:top-24 lg:-m-1 lg:block lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:overscroll-contain lg:p-1 lg:[scrollbar-width:thin]"
          >
            <FilterPanel filters={filters} onChange={setFilters} />
          </aside>

          <div className="min-w-0">
            <section aria-labelledby="cuisines-title">
              <h2
                id="cuisines-title"
                className="font-display mb-4 text-xl font-extrabold text-ink sm:text-2xl"
              >
                Mutfaklar
              </h2>
              <CategoryRail
                value={filters.category}
                onChange={(category: CategoryId) =>
                  setFilters({ ...filters, category })
                }
                counts={counts}
              />
            </section>

            <div className="sticky top-16 z-30 -mx-4 mt-6 border-y border-border bg-paper/92 px-4 py-3 backdrop-blur lg:hidden">
              <FilterBar
                filters={filters}
                onChange={setFilters}
                resultCount={results.length}
              />
            </div>

            <section aria-labelledby="results-title" className="mt-6 lg:mt-8">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                  <h2
                    id="results-title"
                    className="font-display text-xl font-extrabold text-ink sm:text-2xl"
                  >
                    {filters.category === "all"
                      ? "Sana yakın restoranlar"
                      : activeCategory?.name}
                  </h2>
                  {activeQuery && (
                    <button
                      type="button"
                      onClick={() => setFilters({ ...filters, query: "" })}
                      aria-label={`"${activeQuery}" aramasını temizle`}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand transition-colors hover:bg-brand hover:text-brand-contrast"
                    >
                      <Search className="size-3.5 shrink-0" />
                      <span className="truncate">{activeQuery}</span>
                      <X className="size-3.5 shrink-0" />
                    </button>
                  )}
                </div>
                <span className="tabular shrink-0 text-sm text-muted">
                  {results.length} restoran
                </span>
              </div>

              {results.length === 0 ? (
                <EmptyState
                  emoji="🔍"
                  title="Bu kriterlerde restoran çıkmadı"
                  description="Filtreleri gevşet ya da başka bir mutfak dene."
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => setFilters({ ...DEFAULT_FILTERS })}
                    >
                      <SearchX className="size-4" />
                      Filtreleri temizle
                    </Button>
                  }
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-6 xl:grid-cols-3">
                  {results.map((item, index) => (
                    <RestaurantCard
                      key={item.id}
                      item={item}
                      featured={index === 0 && results.length > 2}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
