import { HANDOVER_SECONDS, liveLeg, locationStale } from "@sofra/core/route";
import type { Order } from "../types";
import { clamp } from "../utils";

/**
 * Takip ekranındaki ilerleme çubuğu ve kalan süre.
 *
 * Durum geçişlerini restoran paneli ve kurye uygulaması yapar; burası
 * yalnızca gerçekleşmiş zaman damgalarından ve kuryenin canlı konumundan
 * oran hesaplar, hiçbir şey yazmaz. Kurye yoldaysa ve konumu canlıysa kalan
 * süre önündeki gerçek yoldan bulunur; değilse tahmini teslim saatinden.
 */

/** Çubuktaki aşama sınırları (toplamın oranı). */
const PHASE = { approval: 0.06, preparing: 0.12, onTheWay: 0.55 };

/** Yoldaki kuryenin konumuna göre teslime kalan süre (ms); konum eski ya da yoksa null. */
function liveRemainingMs(order: Order, now: number): number | null {
  if (order.status !== "on_the_way" || order.courierMode !== "platform") return null;
  if (locationStale(order, now)) return null;
  const leg = liveLeg(order);
  if (!leg || leg.leg !== "dropoff") return null;
  return (leg.remainingS + HANDOVER_SECONDS) * 1000;
}

export function progressOf(order: Order, now = Date.now()): number {
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
        return Math.max(0.28, preparingProgress(order, now));
      }
      return preparingProgress(order, now);
    }
    case "on_the_way": {
      if (!order.pickedUpAt) return PHASE.onTheWay;
      const elapsed = Math.max(now - new Date(order.pickedUpAt).getTime(), 0);
      const remaining =
        liveRemainingMs(order, now) ?? Math.max(new Date(order.etaAt).getTime() - now, 0);
      const ratio = elapsed + remaining > 0 ? elapsed / (elapsed + remaining) : 1;
      return clamp(PHASE.onTheWay + (1 - PHASE.onTheWay) * ratio, PHASE.onTheWay, 0.97);
    }
  }
}

function preparingProgress(order: Order, now: number): number {
  if (!order.approvedAt) return PHASE.preparing;
  const started = new Date(order.approvedAt).getTime();
  const span = Math.max((order.prepMinutes ?? 20) * 60_000, 1);
  return clamp(
    PHASE.preparing + (PHASE.onTheWay - PHASE.preparing) * ((now - started) / span),
    PHASE.preparing,
    PHASE.onTheWay - 0.02
  );
}

/** Tahmini teslime kalan süre (dakika). */
export function remainingMinutes(order: Order, now = Date.now()): number {
  if (order.status === "delivered" || order.status === "cancelled") return 0;
  const live = liveRemainingMs(order, now);
  if (live !== null) return Math.max(1, Math.ceil(live / 60_000));
  return Math.max(0, Math.ceil((new Date(order.etaAt).getTime() - now) / 60_000));
}

/** Tahmini teslim anı: kurye yoldaysa canlı konumundan, değilse planlanan saat. */
export function arrivalAt(order: Order, now = Date.now()): string {
  const live = liveRemainingMs(order, now);
  return live !== null ? new Date(now + live).toISOString() : order.etaAt;
}

/**
 * Kurye uygulamasına giden sipariş görünümü: müşterinin gerçek telefon
 * numarası kuryeye gönderilmez. Görüşme maskeli hat üzerinden yapılır.
 */
export function toCourierView(order: Order): Order {
  const { contactPhone: _phone, ...address } = order.address;
  return { ...order, address: { ...address } };
}
