import { SERVICE_FEE } from "./constants";
import type {
  CartLine,
  Coupon,
  OrderTotals,
  PaymentMethodId,
  Restaurant,
} from "./types";
import { cartSubtotal, round2 } from "./utils";

/**
 * Fiyatlandırma kuralları — hem istemcide (anlık önizleme) hem sunucuda
 * (nihai, güvenilir hesap) aynı fonksiyonlar kullanılır. Saf fonksiyonlardır:
 * Node API'si kullanmaz, bu yüzden mobil istemciye de taşınabilir.
 */

/* ------------------------------------------------------------------ */
/* Teslimat ücreti                                                     */
/* ------------------------------------------------------------------ */

export function deliveryFeeFor(
  restaurant: Pick<Restaurant, "deliveryFee" | "freeDeliveryOver">,
  subtotal: number
): number {
  if (
    restaurant.freeDeliveryOver !== null &&
    subtotal >= restaurant.freeDeliveryOver
  ) {
    return 0;
  }
  return restaurant.deliveryFee;
}

/* ------------------------------------------------------------------ */
/* Kupon                                                               */
/* ------------------------------------------------------------------ */

export type CouponCheck =
  | { valid: true; discount: number; freeDelivery: boolean; coupon: Coupon }
  | { valid: false; code: string; message: string };

export interface CouponContext {
  subtotal: number;
  deliveryFee: number;
  restaurantId: string;
  isFirstOrder: boolean;
  alreadyUsed: boolean;
  now?: number;
}

export function checkCoupon(
  coupon: Coupon | undefined,
  ctx: CouponContext
): CouponCheck {
  const now = ctx.now ?? Date.now();

  if (!coupon) {
    return {
      valid: false,
      code: "coupon_not_found",
      message: "Bu promosyon kodu bulunamadı.",
    };
  }
  if (!coupon.active) {
    return {
      valid: false,
      code: "coupon_inactive",
      message: "Bu kampanya şu anda yayında değil.",
    };
  }
  if (new Date(coupon.expiresAt).getTime() < now) {
    return {
      valid: false,
      code: "coupon_expired",
      message: "Bu kampanyanın süresi dolmuş.",
    };
  }
  if (coupon.restaurantIds && !coupon.restaurantIds.includes(ctx.restaurantId)) {
    return {
      valid: false,
      code: "coupon_restaurant",
      message: "Bu kod seçtiğin restoranda geçerli değil.",
    };
  }
  if (coupon.firstOrderOnly && !ctx.isFirstOrder) {
    return {
      valid: false,
      code: "coupon_first_order_only",
      message: "Bu kampanya yalnızca ilk siparişte kullanılabilir.",
    };
  }
  if (ctx.alreadyUsed) {
    return {
      valid: false,
      code: "coupon_used",
      message: "Bu kodu daha önce kullandın.",
    };
  }
  if (ctx.subtotal < coupon.minSubtotal) {
    const missing = round2(coupon.minSubtotal - ctx.subtotal);
    return {
      valid: false,
      code: "coupon_min_subtotal",
      message: `Bu kod için ${missing.toFixed(2).replace(".", ",")} ₺ daha ürün eklemelisin.`,
    };
  }

  if (coupon.type === "free_delivery") {
    return {
      valid: true,
      discount: round2(ctx.deliveryFee),
      freeDelivery: true,
      coupon,
    };
  }

  let discount =
    coupon.type === "percent"
      ? (ctx.subtotal * coupon.value) / 100
      : coupon.value;

  if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.min(discount, ctx.subtotal);

  return { valid: true, discount: round2(discount), freeDelivery: false, coupon };
}

/* ------------------------------------------------------------------ */
/* Toplamlar                                                           */
/* ------------------------------------------------------------------ */

export interface TotalsInput {
  lines: CartLine[];
  restaurant: Pick<Restaurant, "deliveryFee" | "freeDeliveryOver">;
  coupon?: Coupon;
  couponContextOverrides?: Partial<CouponContext>;
  restaurantId: string;
  isFirstOrder: boolean;
  couponAlreadyUsed?: boolean;
  paymentMethod: PaymentMethodId;
  walletBalance: number;
}

export interface TotalsResult {
  totals: OrderTotals;
  couponCheck?: CouponCheck;
}

export function computeTotals(input: TotalsInput): TotalsResult {
  const subtotal = cartSubtotal(input.lines);
  const baseDeliveryFee = deliveryFeeFor(input.restaurant, subtotal);

  let couponCheck: CouponCheck | undefined;
  let discount = 0;
  let deliveryFee = baseDeliveryFee;

  if (input.coupon) {
    couponCheck = checkCoupon(input.coupon, {
      subtotal,
      deliveryFee: baseDeliveryFee,
      restaurantId: input.restaurantId,
      isFirstOrder: input.isFirstOrder,
      alreadyUsed: input.couponAlreadyUsed ?? false,
      ...input.couponContextOverrides,
    });
    if (couponCheck.valid) {
      if (couponCheck.freeDelivery) {
        deliveryFee = 0;
      } else {
        discount = couponCheck.discount;
      }
    }
  }

  const serviceFee = subtotal > 0 ? SERVICE_FEE : 0;
  const payable = round2(
    Math.max(0, subtotal - discount + deliveryFee + serviceFee)
  );

  const walletUsed =
    input.paymentMethod === "wallet"
      ? round2(Math.min(input.walletBalance, payable))
      : 0;

  return {
    totals: {
      subtotal,
      deliveryFee: round2(deliveryFee),
      discount: round2(discount),
      serviceFee: round2(serviceFee),
      walletUsed,
      grandTotal: payable,
    },
    couponCheck,
  };
}

/* ------------------------------------------------------------------ */
/* Sepet doğrulama (sunucu tarafı)                                     */
/* ------------------------------------------------------------------ */

export type CartValidation =
  | { valid: true; lines: CartLine[] }
  | { valid: false; code: string; message: string };

/**
 * İstemciden gelen sepeti menüye karşı yeniden doğrular ve fiyatları
 * menüden yeniden hesaplar. Fiyat/opsiyon manipülasyonuna karşı zorunlu.
 */
export function validateCart(
  restaurant: Restaurant,
  lines: CartLine[]
): CartValidation {
  if (!lines.length) {
    return { valid: false, code: "cart_empty", message: "Sepetin boş." };
  }

  const products = new Map(
    restaurant.menu.flatMap((c) => c.products.map((p) => [p.id, p] as const))
  );

  const rebuilt: CartLine[] = [];

  for (const line of lines) {
    const product = products.get(line.productId);
    if (!product) {
      return {
        valid: false,
        code: "product_not_found",
        message: `"${line.name}" artık menüde bulunmuyor.`,
      };
    }
    if (product.soldOut) {
      return {
        valid: false,
        code: "product_sold_out",
        message: `"${product.name}" tükendi. Sepetinden çıkarman gerekiyor.`,
      };
    }
    if (line.quantity < 1 || line.quantity > 30) {
      return {
        valid: false,
        code: "invalid_quantity",
        message: `"${product.name}" için geçersiz adet.`,
      };
    }

    let unitPrice = product.price;
    const selections = [];

    for (const group of product.optionGroups) {
      const picked = line.selections.find((s) => s.groupId === group.id);
      const ids = picked?.optionIds ?? [];
      const options = ids
        .map((id) => group.options.find((o) => o.id === id))
        .filter((o): o is NonNullable<typeof o> => Boolean(o));

      if (options.length !== ids.length) {
        return {
          valid: false,
          code: "invalid_option",
          message: `"${product.name}" için geçersiz seçenek.`,
        };
      }
      if (options.some((o) => o.soldOut)) {
        return {
          valid: false,
          code: "option_sold_out",
          message: `"${product.name}" için seçtiğin bir malzeme tükendi.`,
        };
      }
      if (group.required && options.length === 0) {
        return {
          valid: false,
          code: "option_required",
          message: `"${product.name}" için "${group.name}" seçimi zorunlu.`,
        };
      }
      if (group.type === "single" && options.length > 1) {
        return {
          valid: false,
          code: "option_single",
          message: `"${group.name}" için tek seçim yapabilirsin.`,
        };
      }
      if (group.maxSelect && options.length > group.maxSelect) {
        return {
          valid: false,
          code: "option_max",
          message: `"${group.name}" için en fazla ${group.maxSelect} seçim yapabilirsin.`,
        };
      }
      if (group.minSelect && options.length < group.minSelect) {
        return {
          valid: false,
          code: "option_min",
          message: `"${group.name}" için en az ${group.minSelect} seçim yapmalısın.`,
        };
      }

      if (options.length) {
        const priceDelta = round2(
          options.reduce((sum, o) => sum + o.priceDelta, 0)
        );
        unitPrice += priceDelta;
        selections.push({
          groupId: group.id,
          groupName: group.name,
          optionIds: options.map((o) => o.id),
          optionNames: options.map((o) => o.name),
          priceDelta,
        });
      }
    }

    rebuilt.push({
      lineId: line.lineId,
      productId: product.id,
      name: product.name,
      emoji: product.emoji,
      image: product.image,
      basePrice: product.price,
      unitPrice: round2(Math.max(0, unitPrice)),
      quantity: line.quantity,
      selections,
      note: line.note?.slice(0, 200) || undefined,
    });
  }

  return { valid: true, lines: rebuilt };
}
