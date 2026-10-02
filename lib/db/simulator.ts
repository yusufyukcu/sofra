import type { LatLng, Order, OrderStatus } from "../types";
import { clamp, hashString, lerpPoint } from "../utils";
import { commit, couriers, db, toCourierSummary } from "./store";

/**
 * Sipariş yaşam döngüsü simülatörü — artık yalnızca yedek.
 *
 * Mutfak bacağını Restoran Paneli (`controlMode: "manual"`), teslimat
 * bacağını Courier App (`courierStage`) yönetir. Simülatör yalnızca o
 * modüller devrede değilken çalışır: restoran otomatik onaydaysa ve
 * vardiyada hiç kurye yoksa sipariş yine de uçtan uca ilerler, böylece
 * müşteri uygulaması tek başına da denenebilir.
 *
 * Geçişler timer ile değil, okuma anında (lazy) hesaplanır: sunucu yeniden
 * başlasa bile sipariş doğru duruma ilerler.
 */

/** Simülasyon hız çarpanı. 1 = gerçek zaman, 12 = 12 kat hızlı. */
export const SIM_SPEED = Math.max(
  1,
  Number(process.env.SOFRA_SIM_SPEED ?? 12) || 12
);

/** Faz sınırları (toplam sürenin oranı olarak). */
const PHASE = {
  preparing: 0.12,
  onTheWay: 0.55,
  delivered: 1,
};

/** Gerçek dakika cinsinden ETA'yı simülasyon süresine çevirir. */
export function simulatedDurationMs(etaMinutes: number): number {
  return Math.round((etaMinutes * 60_000) / SIM_SPEED);
}

interface Schedule {
  start: number;
  total: number;
  preparingAt: number;
  onTheWayAt: number;
  deliveredAt: number;
}

const COURIER_OWNED: string[] = [
  "assigned",
  "at_restaurant",
  "picked_up",
  "delivered",
];

/**
 * Teslimat bacağını gerçek bir kurye mi yönetiyor?
 * Kurye teklifi kabul ettiği andan itibaren `on_the_way` ve `delivered`
 * geçişleri yalnızca Courier App'ten gelir; zamanlayıcı devreye girmez.
 */
export function courierDriven(order: Order): boolean {
  return (
    order.courierMode === "platform" &&
    order.courierStage !== undefined &&
    COURIER_OWNED.includes(order.courierStage)
  );
}

export function scheduleOf(order: Order): Schedule {
  const start = new Date(order.createdAt).getTime();
  const end = new Date(order.etaAt).getTime();
  const total = Math.max(end - start, 30_000);

  const prepMs = simulatedDurationMs(order.prepMinutes ?? 20);
  const travelMs = simulatedDurationMs(order.travelMinutes ?? 12);

  /* 1) Mutfak bacağı — restoran paneli devredeyse gerçek onay anı. */
  const preparingAt =
    order.controlMode === "manual"
      ? order.approvedAt
        ? new Date(order.approvedAt).getTime()
        : Number.POSITIVE_INFINITY
      : start + total * PHASE.preparing;

  /* 2) Teslimat bacağı */
  let onTheWayAt: number;
  let deliveredAt: number;

  if (courierDriven(order)) {
    // Kurye bildirene kadar bekle — otomatik ilerleme yok.
    onTheWayAt = order.pickedUpAt
      ? new Date(order.pickedUpAt).getTime()
      : Number.POSITIVE_INFINITY;
    deliveredAt = order.deliveredAt
      ? new Date(order.deliveredAt).getTime()
      : Number.POSITIVE_INFINITY;
  } else if (order.pickedUpAt) {
    onTheWayAt = new Date(order.pickedUpAt).getTime();
    deliveredAt = onTheWayAt + travelMs;
  } else if (order.controlMode === "manual") {
    onTheWayAt = preparingAt + prepMs;
    deliveredAt = onTheWayAt + travelMs;
  } else {
    onTheWayAt = start + total * PHASE.onTheWay;
    deliveredAt = start + total * PHASE.delivered;
  }

  return { start, total, preparingAt, onTheWayAt, deliveredAt };
}

function statusAt(order: Order, now: number): OrderStatus {
  const s = scheduleOf(order);
  if (now >= s.deliveredAt) return "delivered";
  if (now >= s.onTheWayAt) return "on_the_way";
  if (now >= s.preparingAt) return "preparing";
  return "pending_approval";
}

const TIMELINE_NOTES: Record<OrderStatus, string> = {
  pending_approval: "Siparişin restorana iletildi.",
  preparing: "Restoran siparişini onayladı ve hazırlamaya başladı.",
  on_the_way: "Kurye siparişi restorandan teslim aldı.",
  delivered: "Sipariş adresine teslim edildi.",
  cancelled: "Sipariş iptal edildi.",
};

function pushTimeline(order: Order, status: OrderStatus, at: number) {
  if (order.timeline.some((t) => t.status === status)) return;
  order.timeline.push({
    status,
    at: new Date(at).toISOString(),
    note: TIMELINE_NOTES[status],
  });
  order.timeline.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );
}

function assignCourier(order: Order) {
  if (order.courier || order.courierMode !== "platform") return;
  const pool = couriers();
  // Vardiyada kurye varsa atama Courier App'in teklif akışından yapılır.
  if (pool.some((c) => c.online)) return;
  if (!pool.length) return;
  order.courier = toCourierSummary(pool[hashString(order.id) % pool.length]);
  order.courierPoint = order.restaurantLocation;
}

/** Kuryeyi rota üzerinde `t` (0..1) oranına taşır. */
function courierPointAt(route: LatLng[], t: number): LatLng {
  if (route.length === 0) return { lat: 0, lng: 0 };
  if (route.length === 1) return route[0];
  const scaled = clamp(t, 0, 1) * (route.length - 1);
  const i = Math.min(Math.floor(scaled), route.length - 2);
  return lerpPoint(route[i], route[i + 1], scaled - i);
}

/**
 * Siparişi güncel zamana göre ilerletir. Değişiklik olduysa `true` döner.
 * Çağıran taraf `commit()` etmek zorunda değildir; burada hallediyoruz.
 */
export function syncOrder(order: Order, now = Date.now()): boolean {
  if (order.status === "cancelled" || order.status === "delivered") return false;

  const target = statusAt(order, now);
  const s = scheduleOf(order);
  let changed = false;

  if (target !== order.status) {
    // Atlanan ara durumları da zaman çizelgesine yaz.
    const flow: OrderStatus[] = [
      "pending_approval",
      "preparing",
      "on_the_way",
      "delivered",
    ];
    const targetIndex = flow.indexOf(target);
    for (let i = 0; i <= targetIndex; i++) {
      const st = flow[i];
      const at =
        st === "pending_approval"
          ? s.start
          : st === "preparing"
            ? s.preparingAt
            : st === "on_the_way"
              ? s.onTheWayAt
              : s.deliveredAt;
      pushTimeline(order, st, at);
    }
    order.status = target;
    changed = true;
  }

  if (order.status === "preparing" || order.status === "on_the_way") {
    assignCourier(order);
  }

  if (
    order.courierMode === "platform" &&
    order.courierRoute?.length &&
    !courierDriven(order)
  ) {
    if (order.status === "on_the_way") {
      const t = (now - s.onTheWayAt) / (s.deliveredAt - s.onTheWayAt);
      order.courierPoint = courierPointAt(order.courierRoute, t);
      changed = true;
    } else if (order.status === "delivered") {
      order.courierPoint = order.courierRoute[order.courierRoute.length - 1];
    } else {
      order.courierPoint = order.restaurantLocation;
    }
  }

  if (order.status === "delivered" && !order.deliveredAt) {
    order.deliveredAt = new Date(Math.min(now, s.deliveredAt)).toISOString();
    changed = true;
  }

  if (changed) commit();
  return changed;
}

/** Kullanıcının tüm siparişlerini senkronlar. */
export function syncOrdersOf(userId: string): void {
  db()
    .orders.filter((o) => o.userId === userId)
    .forEach((o) => syncOrder(o));
}

/** Takip ekranındaki ilerleme çubuğu için 0..1 oranı. */
export function progressOf(order: Order, now = Date.now()): number {
  if (order.status === "delivered") return 1;
  if (order.status === "cancelled") return 0;

  const s = scheduleOf(order);

  // Teslimatı kurye yönetiyorsa ilerleme, bildirdiği aşamalardan okunur.
  if (courierDriven(order)) {
    if (!order.pickedUpAt) {
      const byStage: Record<string, number> = {
        assigned: 0.28,
        at_restaurant: 0.45,
      };
      return byStage[order.courierStage ?? ""] ?? PHASE.preparing;
    }
    const started = new Date(order.pickedUpAt).getTime();
    const span = Math.max(simulatedDurationMs(order.travelMinutes ?? 12), 1);
    return clamp(
      PHASE.onTheWay + (1 - PHASE.onTheWay) * ((now - started) / span),
      PHASE.onTheWay,
      0.97
    );
  }

  // Elle yönetilen siparişte ilerleme, gerçekleşen aşamalardan hesaplanır:
  // restoran onaylamadan çubuk ilerlemez.
  if (order.controlMode === "manual") {
    if (!Number.isFinite(s.preparingAt)) return 0.06;
    if (now < s.onTheWayAt) {
      const span = Math.max(s.onTheWayAt - s.preparingAt, 1);
      return clamp(
        PHASE.preparing +
          (PHASE.onTheWay - PHASE.preparing) * ((now - s.preparingAt) / span),
        PHASE.preparing,
        PHASE.onTheWay
      );
    }
    const span = Math.max(s.deliveredAt - s.onTheWayAt, 1);
    return clamp(
      PHASE.onTheWay + (1 - PHASE.onTheWay) * ((now - s.onTheWayAt) / span),
      PHASE.onTheWay,
      1
    );
  }

  return clamp((now - s.start) / s.total, 0, 1);
}

/** Kalan süre (dakika, gerçek dünya saatine göre). */
export function remainingMinutes(order: Order, now = Date.now()): number {
  const s = scheduleOf(order);
  // Teslim anı belirsizse (restoran onaylamadı ya da kuryeyi bekliyoruz)
  // müşteriye vaat edilen ETA üzerinden tahmin veririz.
  const target = Number.isFinite(s.deliveredAt)
    ? s.deliveredAt
    : new Date(order.etaAt).getTime();
  return Math.max(0, Math.ceil((target - now) / 60_000));
}
