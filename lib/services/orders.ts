import "server-only";
import { CANCELLABLE_STATUSES, PAYMENT_METHODS } from "../constants";
import { asJson, dispatchNow, sql, type Db } from "../db/client";
import {
  addOrderEvent,
  findAddress,
  findCoupon,
  findOrder,
  findOrderRow,
  findRestaurant,
  ordersOfUser,
} from "../db/queries";
import type { OrderRow } from "../db/mappers";
import { appSettings, scaledMs } from "../db/settings";
import { toCartMeta, type CartRestaurantMeta } from "@sofra/core/cart";
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
  isInDeliveryZone,
  isRestaurantOpen,
  round2,
} from "../utils";
import { DomainError } from "../errors";
import { chargeCard } from "./cards";
import { cancelOrderTx } from "./lifecycle";
import { applyWallet } from "./wallet";

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

const MEAL_CARD_BRANDS: MealCardBrand[] = ["multinet", "sodexo", "ticket", "setcard", "metropol"];

/* ------------------------------------------------------------------ */
/* Sipariş oluşturma                                                   */
/* ------------------------------------------------------------------ */

/** Kullanıcının teslim edilmiş ya da devam eden (iptal edilmemiş) sipariş sayısı */
async function placedOrderCount(userId: string): Promise<number> {
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from public.orders
     where user_id = ${userId} and status <> 'cancelled'
  `;
  return row.n;
}

async function couponAlreadyUsed(userId: string, code: string): Promise<boolean> {
  const [row] = await sql<{ used: boolean }[]>`
    select exists (
      select 1 from public.coupon_redemptions
       where user_id = ${userId} and code = ${code} and released_at is null
    ) as used
  `;
  return row.used;
}

export async function createOrder(
  user: User,
  input: CreateOrderInput
): Promise<{ order: Order; walletBalance: number }> {
  if (user.blocked) {
    throw new DomainError(
      "account_blocked",
      user.blockReason
        ? `Hesabın askıya alındı: ${user.blockReason}`
        : "Hesabın askıya alındığı için sipariş veremezsin.",
      403
    );
  }

  const restaurant = await findRestaurant(input.restaurantId ?? "");
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
    throw new DomainError("restaurant_closed", `${restaurant.name} şu anda siparişe kapalı.`);
  }

  const address = await findAddress(user.id, input.addressId ?? "");
  if (!address) {
    throw new DomainError("address_not_found", "Teslimat adresi bulunamadı.", 404);
  }
  if (!isInDeliveryZone(restaurant, address.point)) {
    throw new DomainError("out_of_delivery_zone", `${restaurant.name} bu adrese teslimat yapmıyor.`);
  }

  const cart = validateCart(restaurant, input.lines ?? []);
  if (!cart.valid) throw new DomainError(cart.code, cart.message);

  if (!restaurant.paymentMethods.includes(input.paymentMethod)) {
    throw new DomainError(
      "payment_method_unsupported",
      `${restaurant.name} bu ödeme yöntemini kabul etmiyor.`
    );
  }
  if (input.paymentMethod === "meal_card" && !MEAL_CARD_BRANDS.includes(input.mealCardBrand as MealCardBrand)) {
    throw new DomainError("meal_card_required", "Yemek kartı markası seçmelisin.");
  }

  // Online ödeme kayıtlı kartla yapılır (simülasyonda test kartı)
  const card = input.paymentMethod === "online_card" ? await chargeCard(user.id, input.cardId) : null;

  const coupon = input.couponCode ? await findCoupon(input.couponCode) : null;
  if (input.couponCode && !coupon) {
    throw new DomainError("coupon_not_found", "Bu promosyon kodu bulunamadı.");
  }

  const { totals, couponCheck } = computeTotals({
    lines: cart.lines,
    restaurant,
    restaurantId: restaurant.id,
    coupon: coupon ?? undefined,
    isFirstOrder: (await placedOrderCount(user.id)) === 0,
    couponAlreadyUsed: coupon ? await couponAlreadyUsed(user.id, coupon.code) : false,
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

  const settings = await appSettings();
  const km = distanceKm(address.point, restaurant.location);
  const eta = etaForDistance(restaurant, km);
  // Kuryenin yol süresi mesafeden türetilir; hazırlık süresinden bağımsızdır
  const travelMinutes = Math.max(5, Math.round(km * 2.5 + 6));
  const now = new Date();
  const autoApprove = restaurant.autoAccept;
  const prepMinutes = restaurant.defaultPrepMinutes ?? 20;

  const id = createId("ord");
  const preferences: DeliveryPreferences = {
    contactless: Boolean(input.preferences?.contactless),
    ringDoorbell: input.preferences?.ringDoorbell !== false,
    cutlery: Boolean(input.preferences?.cutlery),
    note: input.preferences?.note?.trim().slice(0, 300) || undefined,
  };
  const paymentLabel = paymentLabelFor(input.paymentMethod, input.mealCardBrand);
  const etaAt = new Date(
    now.getTime() +
      (autoApprove ? scaledMs(prepMinutes + travelMinutes, settings) : scaledMs(eta.max, settings))
  );

  const walletBalance = await sql.begin(async (tx) => {
    // Sipariş kodu kısa ve okunur; çakışırsa yeniden üretilir
    let inserted = false;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      const rows = await tx`
        insert into public.orders (
          id, code, user_id, restaurant_id, restaurant_name, restaurant_slug,
          restaurant_emoji, restaurant_image, restaurant_lat, restaurant_lng, commission_rate,
          address, lines, subtotal, delivery_fee, discount, service_fee, wallet_used,
          grand_total, payment_method, payment_label, coupon_code, preferences, status,
          courier_mode, courier_stage, courier_lat, courier_lng, courier_route,
          approved_at, prep_minutes, travel_minutes, eta_at, created_at
        ) values (
          ${id}, ${createOrderCode()}, ${user.id}, ${restaurant.id}, ${restaurant.name},
          ${restaurant.slug}, ${restaurant.emoji}, ${restaurant.image ?? null},
          ${restaurant.location.lat}, ${restaurant.location.lng}, ${restaurant.commissionRate},
          ${tx.json(asJson(address))}, ${tx.json(asJson(cart.lines))}, ${totals.subtotal},
          ${totals.deliveryFee}, ${totals.discount}, ${totals.serviceFee}, ${totals.walletUsed},
          ${totals.grandTotal}, ${input.paymentMethod}, ${paymentLabel},
          ${couponCheck?.valid ? coupon!.code : null}, ${tx.json(asJson(preferences))},
          ${autoApprove ? "preparing" : "pending_approval"}, ${restaurant.courierMode},
          ${restaurant.courierMode === "platform" ? "unassigned" : null},
          ${restaurant.courierMode === "platform" ? restaurant.location.lat : null},
          ${restaurant.courierMode === "platform" ? restaurant.location.lng : null},
          ${
            restaurant.courierMode === "platform"
              ? tx.json(asJson(buildRoute(restaurant.location, address.point)))
              : null
          },
          ${autoApprove ? now : null}, ${autoApprove ? prepMinutes : null},
          ${travelMinutes}, ${etaAt}, ${now}
        )
        on conflict (code) do nothing
        returning id
      `;
      inserted = rows.length > 0;
    }
    if (!inserted) throw new Error("Sipariş kodu üretilemedi.");

    await addOrderEvent(tx, id, "pending_approval", "Siparişin restorana iletildi.", now);
    if (autoApprove) {
      await addOrderEvent(
        tx,
        id,
        "preparing",
        `Restoran siparişi onayladı · hazırlık ${prepMinutes} dk.`,
        new Date(now.getTime() + 1)
      );
    }

    if (couponCheck?.valid && coupon) {
      // Aynı anda iki siparişte aynı kupon: veritabanındaki tekil dizin durdurur
      await tx`
        insert into public.coupon_redemptions (user_id, code, order_id)
        values (${user.id}, ${coupon.code}, ${id})
      `.catch((err: unknown) => {
        if ((err as { code?: string }).code === "23505") {
          throw new DomainError("coupon_used", "Bu kodu daha önce kullandın.");
        }
        throw err;
      });
    }

    // Ödeme kaydı. Geçit şimdilik simüle: online ödemeler başarılı sayılır.
    const onDelivery = PAYMENT_METHODS[input.paymentMethod].onDelivery;
    await tx`
      insert into public.payments (
        id, order_id, user_id, provider, method, purpose, amount, status,
        card_brand, card_last4, meal_card_brand
      ) values (
        ${createId("pmt")}, ${id}, ${user.id}, 'simulated', ${input.paymentMethod}, 'order',
        ${totals.grandTotal}, ${onDelivery ? "pending_collection" : "captured"},
        ${card?.brand ?? null}, ${card?.last4 ?? null},
        ${input.paymentMethod === "meal_card" ? input.mealCardBrand ?? null : null}
      )
    `;

    if (input.paymentMethod === "wallet") {
      return applyWallet(
        tx,
        user.id,
        -totals.grandTotal,
        "order_payment",
        `${restaurant.name} siparişi`,
        id
      );
    }
    const [row] = await tx<{ walletBalance: number }[]>`
      select wallet_balance from public.profiles where id = ${user.id}
    `;
    return row.walletBalance;
  });

  // Otomatik onaylanan platform siparişine teklif hemen gitsin
  if (autoApprove && restaurant.courierMode === "platform") {
    await dispatchNow().catch((err) => console.warn("[sofra/dispatch]", err));
  }

  return { order: (await findOrder(id))!, walletBalance };
}

export function paymentLabelFor(method: PaymentMethodId, mealCardBrand?: MealCardBrand): string {
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

export async function getOrder(user: User, orderId: string): Promise<Order> {
  const order = await findOrder(orderId);
  if (!order || order.userId !== user.id) {
    throw new DomainError("order_not_found", "Sipariş bulunamadı.", 404);
  }
  return order;
}

export async function listOrders(user: User): Promise<Order[]> {
  return ordersOfUser(user.id);
}

/** Devam eden (takip edilebilir) siparişler. */
export async function activeOrders(user: User): Promise<Order[]> {
  const orders = await ordersOfUser(user.id, sql, 20);
  return orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
}

/* ------------------------------------------------------------------ */
/* İptal                                                               */
/* ------------------------------------------------------------------ */

async function ownedOrderForUpdate(tx: Db, user: User, orderId: string) {
  const row = await findOrderRow(orderId, tx, { forUpdate: true });
  if (!row || row.userId !== user.id) {
    throw new DomainError("order_not_found", "Sipariş bulunamadı.", 404);
  }
  return row;
}

export async function cancelOrder(
  user: User,
  orderId: string,
  reason: string
): Promise<{ order: Order; walletBalance: number; refunded: number }> {
  const result = await sql.begin(async (tx) => {
    const row = await ownedOrderForUpdate(tx, user, orderId);

    if (!CANCELLABLE_STATUSES.includes(row.status)) {
      throw new DomainError(
        "not_cancellable",
        row.status === "on_the_way"
          ? "Kurye yola çıktığı için sipariş uygulamadan iptal edilemiyor. Canlı destekten yardım alabilirsin."
          : "Bu sipariş artık iptal edilemez."
      );
    }

    const cleanReason = (reason || "Kullanıcı iptali").trim().slice(0, 200);
    const { refunded } = await cancelOrderTx(
      tx,
      row,
      "user",
      cleanReason,
      `İptal nedeni: ${cleanReason}`
    );
    const [profile] = await tx<{ walletBalance: number }[]>`
      select wallet_balance from public.profiles where id = ${user.id}
    `;
    return { refunded, walletBalance: profile.walletBalance };
  });

  return { order: (await findOrder(orderId))!, ...result };
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

/** "Yusuf Eren" → "Yusuf E." */
function maskName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

const clampScore = (n: number) => Math.min(5, Math.max(1, Math.round(Number(n) || 0)));

export async function rateOrder(
  user: User,
  orderId: string,
  input: RatingInput
): Promise<{ order: Order; review: Review | null; walletBalance: number }> {
  const result = await sql.begin(async (tx) => {
    const row = await ownedOrderForUpdate(tx, user, orderId);

    if (row.status !== "delivered") {
      throw new DomainError(
        "not_deliverable_yet",
        "Yalnızca teslim edilmiş siparişleri değerlendirebilirsin."
      );
    }
    if (row.rating) {
      throw new DomainError("already_rated", "Bu siparişi zaten değerlendirdin. Teşekkürler!");
    }

    const restaurantScore = clampScore(input.restaurantScore);
    // Simüle teslimatta gerçek kurye yok: puan ve bahşiş yalnızca gerçek kuryeye
    const realCourier = row.courierId && !row.simulated ? row.courierId : null;
    const courierScore = realCourier && input.courierScore ? clampScore(input.courierScore) : undefined;

    let tip = 0;
    const requestedTip = round2(Math.min(Math.max(Number(input.courierTip) || 0, 0), 500));
    if (realCourier && requestedTip > 0) {
      const [earning] = await tx<{ id: string }[]>`
        select id from public.courier_earnings where order_id = ${row.id} for update
      `;
      if (earning) {
        await applyWallet(tx, user.id, -requestedTip, "tip", `Kurye bahşişi · ${row.code}`, row.id);
        await tx`update public.courier_earnings set tip = tip + ${requestedTip} where id = ${earning.id}`;
        tip = requestedTip;
      }
    }

    if (realCourier && courierScore) {
      await tx`
        update public.couriers
           set rating_sum = rating_sum + ${courierScore},
               rating_count = rating_count + 1,
               rating = round((rating_sum + ${courierScore}) / (rating_count + 1), 1)
         where id = ${realCourier}
      `;
    }

    // Restoran puanı artık gerçekten değerlendirmelerden hesaplanır
    await tx`
      update public.restaurants
         set rating_sum = rating_sum + ${restaurantScore},
             rating_count = rating_count + 1,
             rating = round((rating_sum + ${restaurantScore}) / (rating_count + 1), 1)
       where id = ${row.restaurantId}
    `;

    const restaurantComment = input.restaurantComment?.trim().slice(0, 500) || undefined;
    const rating: OrderRating = {
      restaurantScore,
      restaurantComment,
      courierScore,
      courierComment: realCourier ? input.courierComment?.trim().slice(0, 500) || undefined : undefined,
      courierTip: tip || undefined,
      createdAt: new Date().toISOString(),
    };
    await tx`update public.orders set rating = ${tx.json(asJson(rating))} where id = ${row.id}`;

    const reviewId = createId("rev");
    await tx`
      insert into public.reviews (id, restaurant_id, order_id, user_id, user_name, score, comment, at)
      values (${reviewId}, ${row.restaurantId}, ${row.id}, ${user.id}, ${maskName(user.name)},
              ${restaurantScore}, ${restaurantComment ?? null}, ${rating.createdAt})
    `;

    const [profile] = await tx<{ walletBalance: number }[]>`
      select wallet_balance from public.profiles where id = ${user.id}
    `;

    const review: Review | null = restaurantComment
      ? {
          id: reviewId,
          restaurantId: row.restaurantId,
          orderId: row.id,
          userName: maskName(user.name),
          score: restaurantScore,
          comment: restaurantComment,
          at: rating.createdAt,
        }
      : null;
    return { review, walletBalance: profile.walletBalance };
  });

  return { order: (await findOrder(orderId))!, ...result };
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

export async function reorder(user: User, orderId: string): Promise<ReorderResult> {
  const order = await getOrder(user, orderId);
  const restaurant = await findRestaurant(order.restaurantId);
  if (!restaurant || restaurant.approvalStatus !== "approved") {
    throw new DomainError("restaurant_not_found", "Bu restoran artık platformda değil.", 404);
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

  return { restaurant: toCartMeta(restaurant), lines: kept, removed };
}

/** Sipariş satırının (iptal/iade mesajları için) ödeme şeklini döner. */
export function paidOnDelivery(order: Pick<OrderRow, "paymentMethod"> | Order): boolean {
  return PAYMENT_METHODS[order.paymentMethod].onDelivery;
}
