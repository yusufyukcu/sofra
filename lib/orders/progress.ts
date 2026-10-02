import type { Order } from "../types";
import { clamp } from "../utils";

/**
 * Takip ekranındaki ilerleme çubuğu ve kalan süre.
 *
 * Eskiden zaman tabanlı simülatör siparişi okurken ilerletiyordu. Artık
 * durum geçişlerini restoran paneli, kurye uygulaması ya da (demo modunda)
 * veritabanındaki dağıtım turu yapar; burası yalnızca gerçekleşmiş zaman
 * damgalarından oran hesaplar ve hiçbir şey yazmaz.
 */

/** Çubuktaki aşama sınırları (toplamın oranı). */
const PHASE = { approval: 0.06, preparing: 0.12, onTheWay: 0.55 };

/** Demo süre çarpanı (restoran hazırlık/yol süresini ekrana ölçekler). */
export interface ProgressContext {
  simSpeed: number;
  demoMode: boolean;
}

function scaled(minutes: number, ctx: ProgressContext): number {
  return (minutes * 60_000) / (ctx.demoMode ? ctx.simSpeed : 1);
}

export function progressOf(order: Order, ctx: ProgressContext, now = Date.now()): number {
  switch (order.status) {
    case "delivered":
      return 1;
    case "cancelled":
      return 0;
    case "pending_approval":
      return PHASE.approval;
    case "preparing": {
      // Kurye aşamaları mutfak süresinden bağımsız olarak çubuğu ilerletir
      if (order.courierStage === "at_restaurant") return 0.45;
      if (order.courierStage === "assigned") {
        return Math.max(0.28, preparingProgress(order, ctx, now));
      }
      return preparingProgress(order, ctx, now);
    }
    case "on_the_way": {
      if (!order.pickedUpAt) return PHASE.onTheWay;
      const started = new Date(order.pickedUpAt).getTime();
      const span = Math.max(new Date(order.etaAt).getTime() - started, 1);
      return clamp(
        PHASE.onTheWay + (1 - PHASE.onTheWay) * ((now - started) / span),
        PHASE.onTheWay,
        0.97
      );
    }
  }
}

function preparingProgress(order: Order, ctx: ProgressContext, now: number): number {
  if (!order.approvedAt) return PHASE.preparing;
  const started = new Date(order.approvedAt).getTime();
  const span = Math.max(scaled(order.prepMinutes ?? 20, ctx), 1);
  return clamp(
    PHASE.preparing + (PHASE.onTheWay - PHASE.preparing) * ((now - started) / span),
    PHASE.preparing,
    PHASE.onTheWay - 0.02
  );
}

/** Tahmini teslime kalan süre (dakika). */
export function remainingMinutes(order: Order, now = Date.now()): number {
  if (order.status === "delivered" || order.status === "cancelled") return 0;
  return Math.max(0, Math.ceil((new Date(order.etaAt).getTime() - now) / 60_000));
}

/**
 * Kurye uygulamasına giden sipariş görünümü: müşterinin gerçek telefon
 * numarası kuryeye gönderilmez. Görüşme maskeli hat üzerinden yapılır.
 */
export function toCourierView(order: Order): Order {
  const { contactPhone: _phone, ...address } = order.address;
  return { ...order, address: { ...address } };
}
