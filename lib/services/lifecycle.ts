import "server-only";
import { PAYMENT_METHODS } from "../constants";
import type { Db } from "../db/client";
import type { OrderRow } from "../db/mappers";
import { addOrderEvent } from "../db/queries";
import { round2 } from "../utils";
import { applyWallet } from "./wallet";

/**
 * Siparişin kapanış yolları tek yerde: müşteri iptali, restoran reddi ve
 * platform iptali aynı fonksiyondan geçer. Böylece üçü de aynı şeyi yapar:
 *
 *  - bekleyen kurye teklifi kapanır (kurye iptal edilmiş siparişe takılmaz),
 *  - atanmış kurye serbest kalır (aktif sipariş sorguları iptali saymaz),
 *  - online ödemede kalan tutar cüzdana bir kez iade edilir,
 *  - kullanılan kupon kullanıcıya geri verilir.
 */

export type CancelledBy = "user" | "vendor" | "support";

export interface CancelResult {
  /** Bu iptalde cüzdana iade edilen tutar (kapıda ödemede 0) */
  refunded: number;
}

export async function cancelOrderTx(
  tx: Db,
  order: OrderRow,
  by: CancelledBy,
  reason: string,
  timelineNote: string
): Promise<CancelResult> {
  await tx`
    update public.orders
       set status = 'cancelled', cancelled_at = now(), cancel_reason = ${reason},
           cancelled_by = ${by},
           courier_stage = case when courier_id is null then null else courier_stage end
     where id = ${order.id}
  `;
  await addOrderEvent(tx, order.id, "cancelled", timelineNote);

  // Kuryede bekleyen teklif varsa kapanır
  await tx`
    update public.delivery_offers
       set status = 'expired', responded_at = now()
     where order_id = ${order.id} and status = 'pending'
  `;

  // Kupon geri verilir
  await tx`
    update public.coupon_redemptions set released_at = now()
     where order_id = ${order.id} and released_at is null
  `;

  if (PAYMENT_METHODS[order.paymentMethod].onDelivery) {
    await tx`update public.payments set status = 'voided' where order_id = ${order.id}`;
    return { refunded: 0 };
  }

  // Online ödeme: daha önce kısmi iade yapıldıysa yalnızca kalanı döner
  const remaining = round2(order.grandTotal - order.refundedTotal);
  if (remaining <= 0) return { refunded: 0 };

  await applyWallet(
    tx,
    order.userId,
    remaining,
    "order_refund",
    `${order.restaurantName} — iptal iadesi`,
    order.id
  );
  await tx`
    update public.orders set refunded_total = grand_total where id = ${order.id}
  `;
  await tx`
    update public.payments
       set refunded_amount = amount, status = 'refunded'
     where order_id = ${order.id}
  `;
  return { refunded: remaining };
}

/** Kapıda ödenen siparişte ödeme durumu (iptal mesajı için). */
export function isPaidOnDelivery(order: Pick<OrderRow, "paymentMethod">): boolean {
  return PAYMENT_METHODS[order.paymentMethod].onDelivery;
}
