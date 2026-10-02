import type {
  CartLine,
  CartSelection,
  Product,
  Restaurant,
} from "./types";
import { round2 } from "./utils";

/**
 * Sepet kuralları — saf, istemciden bağımsız.
 *
 * Sepet tek restorana aittir (sektör standardı). Hangi iki satırın
 * birleştirileceği, bir üründen sepet satırı nasıl üretileceği ve varyantların
 * hangi varsayılanlarla açılacağı burada tanımlı. Web ve mobil aynı
 * fonksiyonları çağırdığı için iki istemcide sepet davranışı birebir aynıdır.
 *
 * Buradaki fiyat yalnızca önizleme içindir; sunucu siparişi alırken her şeyi
 * menüden yeniden hesaplar (`pricing.validateCart`).
 */

export interface CartRestaurantMeta {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  image?: string;
  minBasket: number;
  deliveryFee: number;
  freeDeliveryOver: number | null;
}

/** Restoran nesnesinden sepet meta bilgisini türetir. */
export function toCartMeta(restaurant: Restaurant): CartRestaurantMeta {
  return {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    emoji: restaurant.emoji,
    image: restaurant.image,
    minBasket: restaurant.minBasket,
    deliveryFee: restaurant.deliveryFee,
    freeDeliveryOver: restaurant.freeDeliveryOver,
  };
}

/** İki satırın aynı ürün + aynı seçenekler + aynı not olup olmadığı. */
export function sameLine(
  a: Omit<CartLine, "lineId">,
  b: CartLine
): boolean {
  if (a.productId !== b.productId) return false;
  if ((a.note ?? "") !== (b.note ?? "")) return false;
  const key = (selections: CartSelection[]) =>
    selections
      .map((s) => `${s.groupId}:${[...s.optionIds].sort().join(",")}`)
      .sort()
      .join("|");
  return key(a.selections) === key(b.selections);
}

/** Bir satırın en fazla kaç adet olabileceği. */
export const MAX_LINE_QUANTITY = 30;

/**
 * Ürün + seçili opsiyonlardan sepet satırı üretir.
 * Fiyat sunucuda tekrar hesaplanır; buradaki değer yalnızca önizleme içindir.
 */
export function buildLine(
  product: Product,
  selectionMap: Record<string, string[]>,
  quantity: number,
  note?: string
): Omit<CartLine, "lineId"> {
  const selections: CartSelection[] = [];
  let unitPrice = product.price;

  for (const group of product.optionGroups) {
    const ids = selectionMap[group.id] ?? [];
    if (!ids.length) continue;
    const options = group.options.filter((o) => ids.includes(o.id));
    const priceDelta = round2(options.reduce((s, o) => s + o.priceDelta, 0));
    unitPrice += priceDelta;
    selections.push({
      groupId: group.id,
      groupName: group.name,
      optionIds: options.map((o) => o.id),
      optionNames: options.map((o) => o.name),
      priceDelta,
    });
  }

  return {
    productId: product.id,
    name: product.name,
    emoji: product.emoji,
    image: product.image,
    basePrice: product.price,
    unitPrice: round2(Math.max(0, unitPrice)),
    quantity,
    selections,
    note: note?.trim() || undefined,
  };
}

/** Ürünün varsayılan seçeneklerini hazırlar. */
export function defaultSelections(
  product: Product
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const group of product.optionGroups) {
    const defaults = group.options
      .filter((o) => o.default && !o.soldOut)
      .map((o) => o.id);
    if (defaults.length) {
      map[group.id] = group.type === "single" ? [defaults[0]] : defaults;
    } else if (group.type === "single" && group.required) {
      const first = group.options.find((o) => !o.soldOut);
      map[group.id] = first ? [first.id] : [];
    } else {
      map[group.id] = [];
    }
  }
  return map;
}
