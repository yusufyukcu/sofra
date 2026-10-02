import { fail, handle, ok, readJson } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/session";
import { db, findCoupon, findRestaurant, ordersOf } from "@/lib/db/store";
import { computeTotals, validateCart } from "@/lib/pricing";
import type { CartLine, PaymentMethodId } from "@/lib/types";

/**
 * POST /api/v1/coupons/validate
 * Body: { restaurantId, lines, code?, paymentMethod? }
 *
 * Kupon geçerliliğini kontrol eder ve güncel sepet toplamlarını döner.
 * Checkout ekranı "ne kadar ödeyeceğim" sorusunu her zaman buradan alır:
 * fiyatlar istemcide değil, sunucuda hesaplanır.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request);
    const body = await readJson<{
      restaurantId?: string;
      lines?: CartLine[];
      code?: string;
      paymentMethod?: PaymentMethodId;
    }>(request);

    const restaurant = findRestaurant(body.restaurantId ?? "");
    if (!restaurant) {
      return fail("restaurant_not_found", "Restoran bulunamadı.", 404);
    }

    const cart = validateCart(restaurant, body.lines ?? []);
    if (!cart.valid) return fail(cart.code, cart.message);

    const coupon = body.code ? findCoupon(body.code) : undefined;
    const couponAlreadyUsed = Boolean(
      coupon &&
        db().couponUsage.some(
          (u) =>
            u.userId === user.id &&
            u.code.toUpperCase() === coupon.code.toUpperCase()
        )
    );

    const { totals, couponCheck } = computeTotals({
      lines: cart.lines,
      restaurant,
      restaurantId: restaurant.id,
      coupon,
      isFirstOrder: ordersOf(user.id).length === 0,
      couponAlreadyUsed,
      paymentMethod: body.paymentMethod ?? "online_card",
      walletBalance: user.walletBalance,
    });

    if (body.code && !coupon) {
      return fail("coupon_not_found", "Bu promosyon kodu bulunamadı.");
    }
    if (couponCheck && !couponCheck.valid) {
      return fail(couponCheck.code, couponCheck.message);
    }

    return ok({
      totals,
      coupon: couponCheck?.valid ? couponCheck.coupon : null,
      meetsMinBasket: totals.subtotal >= restaurant.minBasket,
      minBasket: restaurant.minBasket,
    });
  });
}
