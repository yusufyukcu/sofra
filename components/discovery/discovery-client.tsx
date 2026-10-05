"use client";

import { Search, SearchX, Sparkles, UtensilsCrossed, X } from "lucide-react";
import Image from "next/image";
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
import { cn } from "@/lib/utils";
import { Button, EmptyState } from "@/components/ui/primitives";
import { ActiveOrdersStrip } from "@/components/order/active-orders-strip";
import { PartnerBanner } from "@/components/partner/partner-banner";
import { BannerSlider } from "./banner-slider";
import { CategoryRail, FilterBar, FilterPanel } from "./filters";
import { HeroArt } from "./hero-art";
import { RestaurantCard } from "./restaurant-card";

/** Vitrindeki hızlı mutfak kısayolları */
const POPULAR = ["burger", "pizza", "kebap", "tatli", "kahvalti", "uzakdogu"];

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
  /** Şu an sipariş verilebilenler: adrese teslim ediyor ve açık */
  const orderableCount = deliverable.filter((r) => r.open).length;
  const avgEta = deliverable.length
    ? Math.round(
        deliverable.reduce((sum, r) => sum + (r.etaMin + r.etaMax) / 2, 0) /
          deliverable.length
      )
    : 0;

  const activeCategory = CATEGORIES.find((c) => c.id === filters.category);
  const activeQuery = debouncedQuery.trim();

  // Yönetimin öne çıkardıkları (sıra yönetici panelinden) — yalnızca bu adrese teslim edenler
  const featured = useMemo(
    () =>
      decorated
        .filter((r) => r.featuredRank !== null && r.featuredRank !== undefined && r.deliverable)
        .sort((a, b) => (a.featuredRank ?? 0) - (b.featuredRank ?? 0)),
    [decorated]
  );
  const showFeatured = featured.length > 0 && filters.category === "all" && !activeQuery;

  return (
    <>
      {/* Vitrin — koyu bant üstünde yemek fotoğrafları */}
      <section className="band-deep relative isolate overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 -top-40 -z-10 size-[30rem] rounded-full bg-brand/30 blur-[110px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-48 right-[8%] -z-10 size-[26rem] rounded-full bg-saffron/25 blur-[120px]"
        />
        <div className="mx-auto grid max-w-7xl gap-6 px-4 pb-7 pt-6 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-center lg:gap-12 lg:px-6 lg:py-10 xl:grid-cols-[minmax(0,1fr)_28rem]">
          <div className="min-w-0">
            <p className="tabular inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-on-deep ring-1 ring-white/10">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-pistachio opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex size-2 rounded-full bg-pistachio" />
              </span>
              {orderableCount} restoran şu an sipariş alıyor
            </p>

            <h1 className="font-display mt-4 max-w-[15ch] text-[2rem] font-extrabold leading-[1.04] text-on-deep sm:text-5xl lg:text-[3.4rem]">
              Bugün canın ne çekiyor?
            </h1>

            <p className="tabular mt-3 max-w-xl text-sm leading-relaxed text-balance text-on-deep-muted sm:text-base">
              {hasLocation ? (
                <>
                  <span className="font-semibold text-on-deep">{label}</span>{" "}
                  adresine {deliverable.length} restoran teslimat yapıyor
                  {avgEta > 0 && <> · ortalama {avgEta} dakikada kapında</>}
                </>
              ) : (
                <>
                  Şu an Kadıköy merkez için listeliyoruz. Üstteki adres alanından
                  kendi konumunu seç, süreler sana göre hesaplansın.
                </>
              )}
            </p>

            <form onSubmit={(e) => e.preventDefault()} className="mt-5 max-w-xl lg:hidden">
              <label className="flex h-12 items-center gap-2.5 rounded-full bg-surface px-4 shadow-float transition-shadow focus-within:ring-2 focus-within:ring-brand">
                <Search className="size-[18px] shrink-0 text-muted" />
                <input
                  value={filters.query}
                  onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                  placeholder="Restoran, yemek ya da mutfak ara"
                  aria-label="Restoran ara"
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-text placeholder:text-muted focus:outline-none"
                />
                {filters.query && (
                  <button
                    type="button"
                    onClick={() => setFilters({ ...filters, query: "" })}
                    aria-label="Aramayı temizle"
                    className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-surface-2"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </label>
            </form>

            <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
              {POPULAR.map((id) => {
                const category = CATEGORIES.find((c) => c.id === id);
                if (!category?.image) return null;
                const active = filters.category === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setFilters({ ...filters, category: active ? "all" : (id as CategoryId) })
                    }
                    className={cn(
                      "inline-flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-sm font-semibold transition-colors",
                      active
                        ? "bg-brand text-brand-contrast"
                        : "bg-white/10 text-on-deep ring-1 ring-white/12 hover:bg-white/16"
                    )}
                  >
                    <span className="relative size-7 overflow-hidden rounded-full">
                      <Image src={category.image} alt="" fill sizes="28px" className="object-cover" />
                    </span>
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>

          <HeroArt className="hidden lg:block" />
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="space-y-6 pt-6 lg:space-y-8 lg:pt-8">
          <ActiveOrdersStrip />
          <BannerSlider banners={banners} />
          <PartnerBanner />

          {showFeatured && (
            <section aria-labelledby="featured-title">
              <h2
                id="featured-title"
                className="font-display mb-4 flex items-center gap-2 text-xl font-extrabold text-ink sm:text-2xl"
              >
                <Sparkles className="size-5 text-saffron" aria-hidden />
                Öne çıkanlar
              </h2>
              <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
                {featured.map((item) => (
                  <div key={item.id} className="w-[18rem] shrink-0 snap-start sm:w-[20rem]">
                    <RestaurantCard item={item} />
                  </div>
                ))}
              </div>
            </section>
          )}
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
                  icon={UtensilsCrossed}
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
