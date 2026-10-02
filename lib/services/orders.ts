import { PAYMENT_METHODS, CANCELLABLE_STATUSES } from "../constants";
import {
  commit,
  db,
  findAddress,
  findCoupon,
  findOrder,
  findRestaurant,
  ordersOf,
} from "../db/store";
import { toCartMeta, type CartRestaurantMeta } from "@sofra/core/cart";
import { simulatedDurationMs, syncOrder } from "../db/simulator";
import { computeTotals, validateCart } from "../pricing";
import type {
  CartLine,
  DeliveryPreferences,
  MealCardBrand,
  Order,
  OrderRating,
  PaymentMethodId,
  Review,
  User,
} from "../types";
import {
  buildRoute,
  createId,
  createOrderCode,
  distanceKm,
  etaForDistance,
  isRestaurantOpen,
} from "../utils";

import { DomainError } from "../errors";
import { addTip, applyCourierRating, syncOffers } from "./courier";

export { DomainError };

export interface CreateOrderInput {
  restaurantId: string;
  addressId: string;
  lines: CartLine[];
  couponCode?: string;
  paymentMethod: PaymentMethodId;
  mealCardBrand?: MealCardBrand;
  cardId?: string;
  preferences: DeliveryPreferences;
}

/* ------------------------------------------------------------------ */
/* Sipariş oluşturma                                                   */
/* ------------------------------------------------------------------ */

export function createOrder(user: User, input: CreateOrderInput): Order {
  if (user.blocked) {
    throw new DomainError(
      "account_blocked",
      user.blockReason
        ? `Hesabın askıya alındı: ${user.blockReason}`
        : "Hesabın askıya alındığı için sipariş veremezsin.",
      403
    );
  }

  const restaurant = findRestaurant(input.restaurantId);
  if (!restaurant) {
    throw new DomainError("restaurant_not_found", "Restoran bulunamadı.", 404);
  }
  if (restaurant.approvalStatus !== "approved") {
    throw new DomainError(
      "restaurant_unavailable",
      `${restaurant.name} şu anda platformda yayında değil.`
    );
  }
  if (!isRestaurantOpen(restaurant)) {
    throw new DomainError(
      "restaurant_closed",
      `${restaurant.name} şu anda siparişe kapalı.`
    );
  }

  const address = findAddress(user.id, input.addressId);
  if (!address) {
    throw new DomainError("address_not_found", "Teslimat adresi bulunamadı.", 404);
  }

  const km = distanceKm(address.point, restaurant.location);
  if (km > restaurant.deliveryRadiusKm) {
    throw new DomainError(
      "out_of_delivery_zone",
      `${restaurant.name} bu adrese teslimat yapmıyor.`
    );
  }

  const cart = validateCart(restaurant, input.lines);
  if (!cart.valid) throw new DomainError(cart.code, cart.message);

  if (!restaurant.paymentMethods.includes(input.paymentMethod)) {
    throw new DomainError(
      "payment_method_unsupported",
      `${restaurant.name} bu ödeme yöntemini kabul etmiyor.`
    );
  }
  if (input.paymentMethod === "meal_card" && !input.mealCardBrand) {
    throw new DomainError("meal_card_required", "Yemek kartı markası seçmelisin.");
  }

  const previousOrders = ordersOf(user.id);
  const coupon = input.couponCode ? findCoupon(input.couponCode) : undefined;
  if (input.couponCode && !coupon) {
    throw new DomainError("coupon_not_found", "Bu promosyon kodu bulunamadı.");
  }

  const couponAlreadyUsed = db().couponUsage.some(
    (u) =>
      u.userId === user.id &&
      coupon &&
      u.code.toUpperCase() === coupon.code.toUpperCase()
  );

  const { totals, couponCheck } = computeTotals({
    lines: cart.lines,
    restaurant,
    restaurantId: restaurant.id,
    coupon,
    isFirstOrder: previousOrders.length === 0,
    couponAlreadyUsed,
    paymentMethod: input.paymentMethod,
    walletBalance: user.walletBalance,
  });

  if (coupon && couponCheck && !couponCheck.valid) {
    throw new DomainError(couponCheck.code, couponCheck.message);
  }

  if (totals.subtotal < restaurant.minBasket) {
    throw new DomainError(
      "below_min_basket",
      `Minimum sepet tutarı ${restaurant.minBasket} ₺. Biraz daha ürün eklemelisin.`
    );
  }

  if (
    input.paymentMethod === "wallet" &&
    user.walletBalance < totals.grandTotal
  ) {
    throw new DomainError(
      "insufficient_wallet",
      "Cüzdan bakiyen bu sipariş için yeterli değil."
    );
  }

  // "Ödeme geçidi" burada devreye girer. Prototipte online ödemeler her zaman
  // başarılı kabul edilir; gerçek entegrasyonda 3D Secure akışı eklenecek.
  if (input.paymentMethod === "wallet") {
    user.walletBalance = Math.round((user.walletBalance - totals.grandTotal) * 100) / 100;
  }

  const etaRange = etaForDistance(restaurant, km);
  const durationMs = simulatedDurationMs(etaRange.max);
  // Kuryenin yol süresi mesafeden türetilir; hazırlık süresinden bağımsızdır.
  const travelMinutes = Math.max(5, Math.round(km * 2.5 + 6));
  const createdAt = new Date();
  const etaAt = new Date(createdAt.getTime() + durationMs);

  const order: Order = {
    id: createId("ord"),
    code: createOrderCode(),
    userId: user.id,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    restaurantSlug: restaurant.slug,
    restaurantEmoji: restaurant.emoji,
    restaurantImage: restaurant.image,
    restaurantLocation: restaurant.location,
    address,
    lines: cart.lines,
    totals,
    paymentMethod: input.paymentMethod,
    paymentLabel: paymentLabelFor(input.paymentMethod, input.mealCardBrand),
    couponCode: couponCheck?.valid ? coupon?.code : undefined,
    preferences: {
      contactless: Boolean(input.preferences?.contactless),
      ringDoorbell: input.preferences?.ringDoorbell !== false,
      cutlery: Boolean(input.preferences?.cutlery),
      note: input.preferences?.note?.slice(0, 300) || undefined,
    },
    status: "pending_approval",
    // Restoran otomatik onayı kapattıysa sipariş panelde elle onaylanır.
    controlMode: restaurant.autoAccept ? "auto" : "manual",
    travelMinutes,
    timeline: [
      {
        status: "pending_approval",
        at: createdAt.toISOString(),
        note: "Siparişin restorana iletildi.",
      },
    ],
    courierMode: restaurant.courierMode,
    courierRoute:
      restaurant.courierMode === "platform"
        ? buildRoute(restaurant.location, address.point)
        : undefined,
    courierPoint:
      restaurant.courierMode === "platform" ? restaurant.location : undefined,
    createdAt: createdAt.toISOString(),
    etaAt: etaAt.toISOString(),
  };

  db().orders.push(order);
  if (couponCheck?.valid && coupon) {
    db().couponUsage.push({
      userId: user.id,
      code: coupon.code,
      at: createdAt.toISOString(),
    });
  }
  commit();

  return order;
}

export function paymentLabelFor(
  method: PaymentMethodId,
  mealCardBrand?: MealCardBrand
): string {
  const base = PAYMENT_METHODS[method].name;
  if (method === "meal_card" && mealCardBrand) {
    const pretty = mealCardBrand.charAt(0).toUpperCase() + mealCardBrand.slice(1);
    return `${base} · ${pretty}`;
  }
  return base;
}

/* ------------------------------------------------------------------ */
/* Okuma                                                               */
/* ------------------------------------------------------------------ */

export function getOrder(user: User, orderId: string): Order {
  const order = findOrder(orderId);
  if (!order || order.userId !== user.id) {
    throw new DomainError("order_not_found", "Sipariş bulunamadı.", 404);
  }
  // Teklif akışı da okuma anında ilerler; müşteri takip ekranı açıkken
  // vardiyadaki kuryeye teklif gitmesi için yeterli.
  syncOffers();
  syncOrder(order);
  return order;
}

export function listOrders(user: User): Order[] {
  syncOffers();
  const orders = ordersOf(user.id);
  orders.forEach((o) => syncOrder(o));
  return orders;
}

/** Devam eden (takip edilebilir) siparişler. */
export function activeOrders(user: User): Order[] {
  return listOrders(user).filter(
    (o) => o.status !== "delivered" && o.status !== "cancelled"
  );
}

/* ------------------------------------------------------------------ */
/* İptal                                                               */
/* ------------------------------------------------------------------ */

export function cancelOrder(user: User, orderId: string, reason: string): Order {
  const order = getOrder(user, orderId);

  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw new DomainError(
      "not_cancellable",
      order.status === "on_the_way"
        ? "Kurye yola çıktığı için sipariş uygulamadan iptal edilemiyor. Canlı destekten yardım alabilirsin."
        : "Bu sipariş artık iptal edilemez."
    );
  }

  const now = new Date().toISOString();
  order.status = "cancelled";
  order.cancelledAt = now;
  order.cancelReason = reason || "Kullanıcı iptali";
  order.timeline.push({
    status: "cancelled",
    at: now,
    note: `İptal nedeni: ${order.cancelReason}`,
  });

  // Online ödemelerde iade cüzdana yansır (gerçekte ödeme geçidine iade
  // isteği gider ve 1-7 iş günü sürer).
  if (!PAYMENT_METHODS[order.paymentMethod].onDelivery) {
    user.walletBalance =
      Math.round((user.walletBalance + order.totals.grandTotal) * 100) / 100;
  }

  commit();
  return order;
}

/* ------------------------------------------------------------------ */
/* Değerlendirme                                                       */
/* ------------------------------------------------------------------ */

export interface RatingInput {
  restaurantScore: number;
  restaurantComment?: string;
  courierScore?: number;
  courierComment?: string;
  /** Kuryeye bırakılan bahşiş (cüzdandan düşer) */
  courierTip?: number;
}

export function rateOrder(
  user: User,
  orderId: string,
  input: RatingInput
): { order: Order; review: Review | null } {
  const order = getOrder(user, orderId);

  if (order.status !== "delivered") {
    throw new DomainError(
      "not_deliverable_yet",
      "Yalnızca teslim edilmiş siparişleri değerlendirebilirsin."
    );
  }
  if (order.rating) {
    throw new DomainError(
      "already_rated",
      "Bu siparişi zaten değerlendirdin. Teşekkürler!"
    );
  }

  const clampScore = (n: number) => Math.min(5, Math.max(1, Math.round(n)));
  const restaurantScore = clampScore(input.restaurantScore);

  const courierScore =
    order.courier && input.courierScore
      ? clampScore(input.courierScore)
      : undefined;

  // Bahşiş cüzdandan düşer, kuryenin kazancına eklenir.
  const tip =
    order.courier && input.courierTip
      ? addTip(order, Number(input.courierTip))
      : 0;

  if (order.courier && courierScore) {
    applyCourierRating(order.courier.id, courierScore);
  }

  const rating: OrderRating = {
    restaurantScore,
    restaurantComment: input.restaurantComment?.slice(0, 500) || undefined,
    courierScore,
    courierComment: input.courierComment?.slice(0, 500) || undefined,
    courierTip: tip || undefined,
    createdAt: new Date().toISOString(),
  };
  order.rating = rating;

  let review: Review | null = null;
  if (rating.restaurantComment) {
    review = {
      id: createId("rev"),
      restaurantId: order.restaurantId,
      orderId: order.id,
      userName: maskName(user.name),
      score: restaurantScore,
      comment: rating.restaurantComment,
      at: rating.createdAt,
    };
    db().reviews.unshift(review);
  }

  commit();
  return { order, review };
}

/** "Yusuf Eren" → "Yusuf E." */
function maskName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

/* ------------------------------------------------------------------ */
/* Tekrar sipariş                                                      */
/* ------------------------------------------------------------------ */

export interface ReorderResult {
  /** İstemci sepetini doğrudan kurabilmek için restoran özeti */
  restaurant: CartRestaurantMeta;
  lines: CartLine[];
  /** Menüden kalkmış veya tükenmiş ürünler */
  removed: string[];
}

export function reorder(user: User, orderId: string): ReorderResult {
  const order = getOrder(user, orderId);
  const restaurant = findRestaurant(order.restaurantId);
  if (!restaurant) {
    throw new DomainError(
      "restaurant_not_found",
      "Bu restoran artık platformda değil.",
      404
    );
  }

  const removed: string[] = [];
  const kept: CartLine[] = [];

  for (const line of order.lines) {
    const single = validateCart(restaurant, [line]);
    if (single.valid) {
      kept.push({ ...single.lines[0], lineId: createId("ln") });
    } else {
      removed.push(line.name);
    }
  }

  if (!kept.length) {
    throw new DomainError(
      "reorder_unavailable",
      "Bu siparişteki ürünlerin hiçbiri şu an satışta değil."
    );
  }

  return {
    restaurant: toCartMeta(restaurant),
    lines: kept,
    removed,
  };
}
