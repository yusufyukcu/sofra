import type {
  CategoryId,
  LatLng,
  Restaurant,
  RestaurantListItem,
  SortKey,
} from "./types";
import {
  distanceKm,
  etaForDistance,
  isOnBreak,
  isWithinWorkingHours,
} from "./utils";

/**
 * Keşif (anasayfa) filtreleme & sıralama mantığı.
 *
 * Saf fonksiyonlardır: aynı kod hem `/api/v1/restaurants` route handler'ında
 * (mobil istemci için) hem de tarayıcıda anlık filtreleme için çalışır.
 */

export interface DiscoveryFilters {
  category: CategoryId;
  query: string;
  sort: SortKey;
  /** Minimum restoran puanı */
  minRating: number;
  /** En fazla teslimat süresi (dk); 0 = sınırsız */
  maxEta: number;
  /** En fazla minimum sepet tutarı; 0 = sınırsız */
  maxMinBasket: number;
  /** Yalnızca şu an açık olanlar */
  openOnly: boolean;
  /** Yalnızca ücretsiz teslimat sunanlar */
  freeDeliveryOnly: boolean;
  /** Teslimat bölgesi dışındakileri gizle */
  deliverableOnly: boolean;
}

export const DEFAULT_FILTERS: DiscoveryFilters = {
  category: "all",
  query: "",
  sort: "recommended",
  minRating: 0,
  maxEta: 0,
  maxMinBasket: 0,
  openOnly: false,
  freeDeliveryOnly: false,
  deliverableOnly: true,
};

/** Menü ağacı olmadan taşınan restoran özeti (liste ekranları için). */
export type RestaurantBase = Omit<Restaurant, "menu" | "paymentMethods">;

/** Menü ve ödeme yöntemlerini ayıklayarak listeye uygun özet üretir. */
export function toBase(restaurant: Restaurant): RestaurantBase {
  const { menu: _menu, paymentMethods: _pm, ...rest } = restaurant;
  return rest;
}

export function decorate(
  restaurants: (Restaurant | RestaurantBase)[],
  point: LatLng,
  favoriteIds: string[] = [],
  now = new Date()
): RestaurantListItem[] {
  return restaurants.map((r) => {
    const km = distanceKm(point, r.location);
    const eta = etaForDistance(r, km);
    const open =
      !r.temporarilyClosed &&
      !isOnBreak(r.breakHours, now) &&
      isWithinWorkingHours(r.workingHours, now);
    const { menu: _menu, paymentMethods: _pm, ...rest } = r as Restaurant;
    return {
      ...rest,
      distanceKm: Math.round(km * 10) / 10,
      deliverable: km <= r.deliveryRadiusKm,
      open,
      isFavorite: favoriteIds.includes(r.id),
      etaText: `${eta.min}-${eta.max} dk`,
      etaMin: eta.min,
      etaMax: eta.max,
    } satisfies RestaurantListItem;
  });
}

function matchesCategory(item: RestaurantListItem, category: CategoryId) {
  if (category === "all") return true;
  if (category === "top-rated") return item.rating >= 4.5;
  return item.tags.includes(category);
}

function matchesQuery(item: RestaurantListItem, query: string) {
  if (!query.trim()) return true;
  const q = query.trim().toLocaleLowerCase("tr");
  return (
    item.name.toLocaleLowerCase("tr").includes(q) ||
    item.description.toLocaleLowerCase("tr").includes(q) ||
    item.district.toLocaleLowerCase("tr").includes(q) ||
    item.tags.some((t) => t.includes(q))
  );
}

export function filterAndSort(
  items: RestaurantListItem[],
  filters: DiscoveryFilters
): RestaurantListItem[] {
  const filtered = items.filter((item) => {
    if (filters.deliverableOnly && !item.deliverable) return false;
    if (!matchesCategory(item, filters.category)) return false;
    if (!matchesQuery(item, filters.query)) return false;
    if (filters.minRating && item.rating < filters.minRating) return false;
    if (filters.maxEta && item.etaMax > filters.maxEta) return false;
    if (filters.maxMinBasket && item.minBasket > filters.maxMinBasket) {
      return false;
    }
    if (filters.openOnly && !item.open) return false;
    if (filters.freeDeliveryOnly && item.freeDeliveryOver === null) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    // Kapalı restoranlar her sıralamada listenin sonuna düşer.
    if (a.open !== b.open) return Number(b.open) - Number(a.open);
    switch (filters.sort) {
      case "rating":
        return b.rating - a.rating || a.distanceKm - b.distanceKm;
      case "eta":
        return a.etaMax - b.etaMax || a.distanceKm - b.distanceKm;
      case "distance":
        return a.distanceKm - b.distanceKm;
      case "minBasket":
        return a.minBasket - b.minBasket || a.distanceKm - b.distanceKm;
      case "recommended":
      default:
        return recommendationScore(b) - recommendationScore(a);
    }
  });

  return sorted;
}

/**
 * "Önerilen" sıralaması: puan, yakınlık, hız ve favori durumunu harmanlar.
 * Gerçek sistemde bu skor bir öneri servisinden gelir.
 */
function recommendationScore(item: RestaurantListItem): number {
  const ratingScore = item.rating * 12;
  const distanceScore = Math.max(0, 10 - item.distanceKm) * 2.2;
  const speedScore = Math.max(0, 70 - item.etaMax) * 0.35;
  const popularity = Math.log10(item.ratingCount + 10) * 4;
  const favorite = item.isFavorite ? 14 : 0;
  return ratingScore + distanceScore + speedScore + popularity + favorite;
}

/* ------------------------------------------------------------------ */
/* URL <-> filtre dönüşümü                                             */
/* ------------------------------------------------------------------ */

export const FILTER_PARAM_KEYS = {
  category: "kategori",
  query: "q",
  sort: "sirala",
  minRating: "puan",
  maxEta: "sure",
  maxMinBasket: "sepet",
  openOnly: "acik",
  freeDeliveryOnly: "ucretsiz",
  deliverableOnly: "bolge",
} as const;

type ParamsLike = {
  get(key: string): string | null;
};

export function filtersFromParams(params: ParamsLike): DiscoveryFilters {
  const num = (key: string, fallback: number) => {
    const raw = params.get(key);
    const parsed = raw === null ? NaN : Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const bool = (key: string, fallback: boolean) => {
    const raw = params.get(key);
    if (raw === null) return fallback;
    return raw === "1" || raw === "true";
  };

  return {
    category: (params.get(FILTER_PARAM_KEYS.category) ??
      DEFAULT_FILTERS.category) as CategoryId,
    query: params.get(FILTER_PARAM_KEYS.query) ?? "",
    sort: (params.get(FILTER_PARAM_KEYS.sort) ?? DEFAULT_FILTERS.sort) as SortKey,
    minRating: num(FILTER_PARAM_KEYS.minRating, 0),
    maxEta: num(FILTER_PARAM_KEYS.maxEta, 0),
    maxMinBasket: num(FILTER_PARAM_KEYS.maxMinBasket, 0),
    openOnly: bool(FILTER_PARAM_KEYS.openOnly, false),
    freeDeliveryOnly: bool(FILTER_PARAM_KEYS.freeDeliveryOnly, false),
    deliverableOnly: bool(FILTER_PARAM_KEYS.deliverableOnly, true),
  };
}

export function filtersToSearchParams(
  filters: DiscoveryFilters
): URLSearchParams {
  const params = new URLSearchParams();
  const k = FILTER_PARAM_KEYS;
  if (filters.category !== "all") params.set(k.category, filters.category);
  if (filters.query.trim()) params.set(k.query, filters.query.trim());
  if (filters.sort !== "recommended") params.set(k.sort, filters.sort);
  if (filters.minRating) params.set(k.minRating, String(filters.minRating));
  if (filters.maxEta) params.set(k.maxEta, String(filters.maxEta));
  if (filters.maxMinBasket) {
    params.set(k.maxMinBasket, String(filters.maxMinBasket));
  }
  if (filters.openOnly) params.set(k.openOnly, "1");
  if (filters.freeDeliveryOnly) params.set(k.freeDeliveryOnly, "1");
  if (!filters.deliverableOnly) params.set(k.deliverableOnly, "0");
  return params;
}

export function activeFilterCount(filters: DiscoveryFilters): number {
  let count = 0;
  if (filters.minRating) count++;
  if (filters.maxEta) count++;
  if (filters.maxMinBasket) count++;
  if (filters.openOnly) count++;
  if (filters.freeDeliveryOnly) count++;
  if (!filters.deliverableOnly) count++;
  return count;
}
