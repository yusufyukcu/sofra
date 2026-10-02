import "server-only";
import { sql } from "../db/client";
import { findCoupon, findRestaurant } from "../db/queries";
import { toCoupon, type CouponRow } from "../db/mappers";
import { computeTotals, validateCart } from "../pricing";
import type { CartLine, Coupon, OrderTotals, PaymentMethodId, User } from "../types";
import { DomainError } from "../errors";

/**
 * Ödeme adımındaki kampanya önerileri ve tutar hesabı. Tutarlar her zaman
 * sunucuda, menüden yeniden hesaplanır; istemci yalnızca gösterir.
 */

/** Kullanıcının şu an kullanabileceği kampanyalar. */
export async function availableCoupons(user: User | null): Promise<Coupon[]> {
  const rows = await sql<CouponRow[]>`
    select c.* from public.coupons c
     where c.active and c.expires_at > now()
       and (${user?.id ?? null}::text is null or not exists (
             select 1 from public.coupon_redemptions r
              where r.user_id = ${user?.id ?? null}::text and r.code = c.code and r.released_at is null))
       and (not c.first_order_only or ${user?.id ?? null}::text is null or not exists (
             select 1 from public.orders o
              where o.user_id = ${user?.id ?? null}::text and o.status <> 'cancelled'))
     order by c.created_at desc
  `;
  return rows.map(toCoupon);
}

export interface QuoteInput {
  restaurantId?: string;
  lines?: CartLine[];
  code?: string;
  paymentMethod?: PaymentMethodId;
}

export interface Quote {
  totals: OrderTotals;
  coupon: Coupon | null;
  meetsMinBasket: boolean;
  minBasket: number;
}

export async function quoteOrder(user: User, input: QuoteInput): Promise<Quote> {
  const restaurant = await findRestaurant(input.restaurantId ?? "");
  if (!restaurant || restaurant.approvalStatus !== "approved") {
    throw new DomainError("restaurant_not_found", "Restoran bulunamadı.", 404);
  }

  const cart = validateCart(restaurant, input.lines ?? []);
  if (!cart.valid) throw new DomainError(cart.code, cart.message);

  const coupon = input.code ? await findCoupon(input.code) : null;
  if (input.code && !coupon) throw new DomainError("coupon_not_found", "Bu promosyon kodu bulunamadı.");

  const [usage] = await sql<{ used: boolean; placed: number }[]>`
    select exists (
             select 1 from public.coupon_redemptions
              where user_id = ${user.id} and code = ${coupon?.code ?? ""} and released_at is null
           ) as used,
           (select count(*)::int from public.orders where user_id = ${user.id} and status <> 'cancelled') as placed
  `;

  const { totals, couponCheck } = computeTotals({
    lines: cart.lines,
    restaurant,
    restaurantId: restaurant.id,
    coupon: coupon ?? undefined,
    isFirstOrder: usage.placed === 0,
    couponAlreadyUsed: coupon ? usage.used : false,
    paymentMethod: input.paymentMethod ?? "online_card",
    walletBalance: user.walletBalance,
  });

  if (couponCheck && !couponCheck.valid) throw new DomainError(couponCheck.code, couponCheck.message);

  return {
    totals,
    coupon: couponCheck?.valid ? couponCheck.coupon : null,
    meetsMinBasket: totals.subtotal >= restaurant.minBasket,
    minBasket: restaurant.minBasket,
  };
}
