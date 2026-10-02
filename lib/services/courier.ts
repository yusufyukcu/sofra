import { courierDriven, syncOrder } from "../db/simulator";
import {
  commit,
  db,
  earningsOf,
  findCourier,
  findUserById,
  offersOf,
  toCourierSummary,
} from "../db/store";
import { DomainError } from "../errors";
import type {
  Courier,
  CourierEarning,
  DeliveryOffer,
  LatLng,
  Order,
} from "../types";
import { buildRoute, createId, distanceKm, round2 } from "../utils";
import { OFFER_TTL_SECONDS } from "../courier-constants";
import { payoutsFor } from "./payouts";

/**
 * Kurye Uygulaması (Courier App) iş mantığı.
 *
 * Üç sorumluluk: vardiya ve konum, teklif akışı (atanan siparişi süre
 * kısıtıyla kabul/ret) ve teslimat aşamaları. Kazanç ve performans
 * metrikleri tamamlanan teslimatlardan türetilir.
 */

/* ================================================================== */
/* Ücretlendirme                                                      */
/* ================================================================== */

/** Kuryeye ödenen paket ücreti: sabit taban + mesafe başına. */
const FEE_BASE = 35;
const FEE_PER_KM = 11;
const FEE_MIN = 45;

export function courierFee(totalKm: number): number {
  return round2(Math.max(FEE_MIN, FEE_BASE + totalKm * FEE_PER_KM));
}

/** Teklifin kuryede kalma süresi — "süre kısıtlı" kabul penceresi. */
export { OFFER_TTL_SECONDS } from "../courier-constants";

/* ================================================================== */
/* Giriş                                                              */
/* ================================================================== */

export function courierLogin(courierId: string, pin: string): Courier {
  const courier = findCourier(courierId);
  if (!courier) {
    throw new DomainError("courier_not_found", "Kurye hesabı bulunamadı.", 404);
  }
  if (courier.pin !== pin.trim()) {
    throw new DomainError("invalid_pin", "PIN hatalı. Tekrar dene.", 401);
  }
  return courier;
}

/* ================================================================== */
/* Vardiya ve konum                                                   */
/* ================================================================== */

export function setShift(courier: Courier, online: boolean): Courier {
  if (online && courier.status !== "active") {
    throw new DomainError(
      "courier_not_active",
      courier.status === "pending"
        ? "Hesabın henüz onaylanmadı. Platform ekibi aktivasyonunu tamamlayınca mesaiye başlayabilirsin."
        : "Hesabın askıya alındı. Destek ekibiyle iletişime geçmelisin."
    );
  }
  if (!online && activeOrderOf(courier.id)) {
    throw new DomainError(
      "active_delivery",
      "Üzerinde açık bir teslimat varken mesaiyi kapatamazsın."
    );
  }

  courier.online = online;
  if (online) {
    courier.shiftStartedAt = new Date().toISOString();
  } else {
    courier.shiftStartedAt = undefined;
    // Vardiya dışında bekleyen teklifleri düşür
    db()
      .offers.filter((o) => o.courierId === courier.id && o.status === "pending")
      .forEach((o) => {
        o.status = "expired";
        const order = db().orders.find((x) => x.id === o.orderId);
        if (order && order.courierStage === "offered") {
          order.courierStage = "unassigned";
        }
      });
  }

  commit();
  return courier;
}

/**
 * Cihazdan gelen konum bildirimi.
 * Kuryenin üzerinde açık bir teslimat varsa siparişin canlı kurye konumu
 * da güncellenir — müşterinin takip haritası bundan beslenir.
 */
export function updateLocation(courier: Courier, point: LatLng): Courier {
  if (
    !point ||
    typeof point.lat !== "number" ||
    typeof point.lng !== "number" ||
    Math.abs(point.lat) > 90 ||
    Math.abs(point.lng) > 180
  ) {
    throw new DomainError("invalid_point", "Geçersiz konum bilgisi.");
  }

  courier.point = { lat: point.lat, lng: point.lng };

  const order = activeOrderOf(courier.id);
  if (order) order.courierPoint = courier.point;

  commit();
  return courier;
}

/* ================================================================== */
/* Teklif akışı (dispatcher)                                          */
/* ================================================================== */

const ACTIVE_STAGES = ["assigned", "at_restaurant", "picked_up"];

export function activeOrderOf(courierId: string): Order | undefined {
  return db().orders.find(
    (o) =>
      o.courier?.id === courierId &&
      o.courierStage !== undefined &&
      ACTIVE_STAGES.includes(o.courierStage)
  );
}

/**
 * Teklif senkronizasyonu.
 *
 * Simülatörle aynı mantıkla okuma anında (lazy) çalışır: süresi dolan
 * teklifleri kapatır, kurye bekleyen siparişler için en yakın uygun
 * kuryeye yeni teklif üretir. Reddeden veya süresi dolan kuryeye aynı
 * sipariş ikinci kez gönderilmez.
 */
export function syncOffers(now = Date.now()): void {
  const store = db();

  /*
   * 0) Teklif verebilmek için siparişlerin durumu güncel olmalı.
   * Bir sipariş ancak "Hazırlanıyor"a geçtiğinde kurye aranır; bu geçişi
   * simülatör veya restoran paneli yapar, dolayısıyla önce senkronlarız.
   */
  store.orders
    .filter(
      (o) =>
        o.courierMode === "platform" &&
        o.status !== "delivered" &&
        o.status !== "cancelled"
    )
    .forEach((o) => syncOrder(o, now));

  let changed = false;

  /* 1) Süresi dolanlar */
  for (const offer of store.offers) {
    if (offer.status !== "pending") continue;
    if (new Date(offer.expiresAt).getTime() > now) continue;

    offer.status = "expired";
    const order = store.orders.find((o) => o.id === offer.orderId);
    if (order && order.courierStage === "offered") {
      order.courierStage = "unassigned";
    }
    changed = true;
  }

  /* 2) Kurye bekleyen siparişler */
  const online = store.couriers.filter((c) => c.online);
  if (online.length) {
    const busy = new Set(
      store.orders
        .filter(
          (o) =>
            o.courier &&
            o.courierStage !== undefined &&
            ACTIVE_STAGES.includes(o.courierStage)
        )
        .map((o) => o.courier!.id)
    );
    // Aynı turda bir kuryeye iki teklif gitmesin
    store.offers
      .filter((o) => o.status === "pending")
      .forEach((o) => busy.add(o.courierId));

    const waiting = store.orders.filter(
      (o) =>
        o.courierMode === "platform" &&
        o.status === "preparing" &&
        !o.courier &&
        (!o.courierStage || o.courierStage === "unassigned")
    );

    for (const order of waiting) {
      const seen = new Set(
        store.offers
          .filter((f) => f.orderId === order.id)
          .map((f) => f.courierId)
      );

      const candidate = online
        .filter((c) => !busy.has(c.id) && !seen.has(c.id))
        .map((c) => ({
          courier: c,
          km: distanceKm(c.point, order.restaurantLocation),
        }))
        .sort((a, b) => a.km - b.km)[0];

      if (!candidate) continue;

      const dropoffKm = distanceKm(
        order.restaurantLocation,
        order.address.point
      );

      store.offers.push({
        id: createId("ofr"),
        orderId: order.id,
        courierId: candidate.courier.id,
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + OFFER_TTL_SECONDS * 1000).toISOString(),
        status: "pending",
        fee: courierFee(candidate.km + dropoffKm),
        pickupKm: Math.round(candidate.km * 10) / 10,
        dropoffKm: Math.round(dropoffKm * 10) / 10,
      });

      order.courierStage = "offered";
      busy.add(candidate.courier.id);
      changed = true;
    }
  }

  if (changed) commit();
}

function ownedOffer(courierId: string, offerId: string): DeliveryOffer {
  const offer = db().offers.find(
    (o) => o.id === offerId && o.courierId === courierId
  );
  if (!offer) {
    throw new DomainError("offer_not_found", "Teklif bulunamadı.", 404);
  }
  return offer;
}

export function acceptOffer(courier: Courier, offerId: string): Order {
  syncOffers();
  const offer = ownedOffer(courier.id, offerId);

  if (offer.status === "expired") {
    throw new DomainError(
      "offer_expired",
      "Teklifin süresi doldu, sipariş başka bir kuryeye gönderildi."
    );
  }
  if (offer.status !== "pending") {
    throw new DomainError("offer_closed", "Bu teklif artık geçerli değil.");
  }
  if (activeOrderOf(courier.id)) {
    throw new DomainError(
      "already_busy",
      "Üzerinde açık bir teslimat var. Önce onu tamamla."
    );
  }

  const order = db().orders.find((o) => o.id === offer.orderId);
  if (!order) {
    throw new DomainError("order_not_found", "Sipariş bulunamadı.", 404);
  }
  if (order.courier) {
    offer.status = "expired";
    commit();
    throw new DomainError(
      "order_taken",
      "Bu siparişi başka bir kurye aldı."
    );
  }

  offer.status = "accepted";
  order.courier = toCourierSummary(courier);
  order.courierStage = "assigned";
  order.courierFee = offer.fee;
  order.courierPoint = courier.point;
  order.timeline.push({
    status: order.status,
    at: new Date().toISOString(),
    note: `${courier.name} siparişi üstlendi, restorana gidiyor.`,
  });

  commit();
  return order;
}

export function rejectOffer(courier: Courier, offerId: string): void {
  const offer = ownedOffer(courier.id, offerId);
  if (offer.status !== "pending") return;

  offer.status = "rejected";
  const order = db().orders.find((o) => o.id === offer.orderId);
  if (order && order.courierStage === "offered") {
    order.courierStage = "unassigned";
  }
  commit();

  // Sıradaki en yakın kuryeye hemen gönder
  syncOffers();
}

/* ================================================================== */
/* Teslimat aşamaları                                                 */
/* ================================================================== */

export type StageAction = "arrived" | "pickup" | "deliver";

function ownedOrder(courierId: string, orderId: string): Order {
  const order = db().orders.find(
    (o) => o.id === orderId && o.courier?.id === courierId
  );
  if (!order) {
    throw new DomainError("order_not_found", "Sipariş bulunamadı.", 404);
  }
  return order;
}

/**
 * Aşama bildirimleri: Restorana vardım → Teslim aldım → Teslim ettim.
 * `pickup` siparişi müşteri tarafında "Yolda"ya, `deliver` ise
 * "Teslim edildi"ye çevirir.
 */
export function advanceStage(
  courier: Courier,
  orderId: string,
  action: StageAction
): Order {
  const order = ownedOrder(courier.id, orderId);
  const now = new Date();

  if (order.status === "cancelled") {
    throw new DomainError("order_cancelled", "Bu sipariş iptal edilmiş.");
  }

  if (action === "arrived") {
    if (order.courierStage !== "assigned") {
      throw new DomainError(
        "invalid_stage",
        "Bu bildirim yalnızca restorana giderken yapılabilir."
      );
    }
    order.courierStage = "at_restaurant";
    order.courierArrivedAt = now.toISOString();
    order.courierPoint = order.restaurantLocation;
    order.timeline.push({
      status: order.status,
      at: now.toISOString(),
      note: `${courier.name} restorana vardı.`,
    });
  }

  if (action === "pickup") {
    if (order.courierStage !== "at_restaurant") {
      throw new DomainError(
        "invalid_stage",
        "Önce restorana vardığını bildirmelisin."
      );
    }
    order.courierStage = "picked_up";
    order.pickedUpAt = now.toISOString();
    order.status = "on_the_way";
    order.courierPoint = order.restaurantLocation;
    // Rota her ihtimale karşı yeniden kurulur (adres güncellenmiş olabilir)
    order.courierRoute = buildRoute(
      order.restaurantLocation,
      order.address.point
    );
    order.timeline.push({
      status: "on_the_way",
      at: now.toISOString(),
      note: `${courier.name} siparişi restorandan teslim aldı.`,
    });
  }

  if (action === "deliver") {
    if (order.courierStage !== "picked_up") {
      throw new DomainError(
        "invalid_stage",
        "Önce siparişi restorandan teslim almalısın."
      );
    }
    order.courierStage = "delivered";
    order.status = "delivered";
    order.deliveredAt = now.toISOString();
    order.courierPoint = order.address.point;
    order.timeline.push({
      status: "delivered",
      at: now.toISOString(),
      note: `${courier.name} siparişi adrese teslim etti.`,
    });

    recordEarning(courier, order, now);
    courier.totalDeliveries += 1;
    courier.point = order.address.point;
  }

  commit();
  return order;
}

function recordEarning(courier: Courier, order: Order, now: Date) {
  const pickedUp = order.pickedUpAt
    ? new Date(order.pickedUpAt).getTime()
    : now.getTime();
  const durationMinutes = Math.max(
    1,
    Math.round((now.getTime() - pickedUp) / 60_000)
  );

  db().earnings.push({
    id: createId("ern"),
    courierId: courier.id,
    orderId: order.id,
    orderCode: order.code,
    restaurantName: order.restaurantName,
    fee: order.courierFee ?? courierFee(order.travelMinutes / 2.5),
    tip: 0,
    distanceKm:
      Math.round(
        distanceKm(order.restaurantLocation, order.address.point) * 10
      ) / 10,
    durationMinutes,
    at: now.toISOString(),
  });
}

/**
 * Müşteri değerlendirme ekranından bahşiş bırakıldığında çağrılır.
 * Tutar müşterinin cüzdanından düşer, kuryenin kazancına eklenir.
 */
export function addTip(order: Order, amount: number): number {
  if (!order.courier) return 0;
  const tip = round2(Math.min(Math.max(amount, 0), 500));
  if (tip <= 0) return 0;

  const user = findUserById(order.userId);
  if (!user) return 0;
  if (user.walletBalance < tip) {
    throw new DomainError(
      "insufficient_wallet",
      "Cüzdan bakiyen bahşiş için yeterli değil."
    );
  }

  const earning = db().earnings.find((e) => e.orderId === order.id);
  if (!earning) return 0;

  user.walletBalance = round2(user.walletBalance - tip);
  earning.tip = round2(earning.tip + tip);
  commit();
  return tip;
}

/** Kurye puanı — müşteri değerlendirmesinden gelir. */
export function applyCourierRating(courierId: string, score: number): void {
  const courier = findCourier(courierId);
  if (!courier) return;
  courier.ratingSum += score;
  courier.ratingCount += 1;
  courier.rating = Math.round((courier.ratingSum / courier.ratingCount) * 10) / 10;
  commit();
}

/* ================================================================== */
/* Panel verisi                                                       */
/* ================================================================== */

export interface CourierSummaryStats {
  online: boolean;
  shiftStartedAt?: string;
  /** Bugünkü teslimat sayısı */
  todayDeliveries: number;
  /** Bugünkü kazanç (ücret + bahşiş) */
  todayEarnings: number;
  todayTips: number;
  /** Bu haftaki kazanç */
  weekEarnings: number;
  totalDeliveries: number;
  rating: number;
}

export interface CourierBoard {
  courier: Courier;
  /** Yanıt bekleyen teklif (varsa) */
  offer: (DeliveryOffer & { order: Order; secondsLeft: number }) | null;
  /** Üzerinde açık teslimat */
  activeOrder: Order | null;
  stats: CourierSummaryStats;
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeek(): number {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function courierStats(courier: Courier): CourierSummaryStats {
  const earnings = earningsOf(courier.id);
  const dayStart = startOfToday();
  const weekStart = startOfWeek();

  const today = earnings.filter((e) => new Date(e.at).getTime() >= dayStart);
  const week = earnings.filter((e) => new Date(e.at).getTime() >= weekStart);

  const sum = (list: CourierEarning[]) =>
    round2(list.reduce((total, e) => total + e.fee + e.tip, 0));

  return {
    online: courier.online,
    shiftStartedAt: courier.shiftStartedAt,
    todayDeliveries: today.length,
    todayEarnings: sum(today),
    todayTips: round2(today.reduce((total, e) => total + e.tip, 0)),
    weekEarnings: sum(week),
    totalDeliveries: courier.totalDeliveries,
    rating: courier.rating,
  };
}

export function courierBoard(courier: Courier): CourierBoard {
  syncOffers();

  // Aktif siparişin mutfak bacağı hâlâ simülatörden ilerleyebilir
  db()
    .orders.filter((o) => o.courier?.id === courier.id)
    .forEach((o) => syncOrder(o));

  const now = Date.now();
  const pending = offersOf(courier.id).find(
    (o) => o.status === "pending" && new Date(o.expiresAt).getTime() > now
  );

  const offerOrder = pending
    ? db().orders.find((o) => o.id === pending.orderId)
    : undefined;

  const active = activeOrderOf(courier.id) ?? null;

  return {
    courier,
    offer:
      pending && offerOrder
        ? {
            ...pending,
            order: offerOrder,
            secondsLeft: Math.max(
              0,
              Math.round((new Date(pending.expiresAt).getTime() - now) / 1000)
            ),
          }
        : null,
    activeOrder: active,
    stats: courierStats(courier),
  };
}

/* ================================================================== */
/* Kazanç ve performans                                               */
/* ================================================================== */

export interface EarningsBucket {
  key: string;
  label: string;
  deliveries: number;
  fee: number;
  tip: number;
  total: number;
}

export interface EarningsReport {
  totals: { deliveries: number; fee: number; tip: number; total: number };
  buckets: EarningsBucket[];
  recent: CourierEarning[];
  /** Haftalık hakediş satırları */
  payouts: {
    id: string;
    label: string;
    deliveries: number;
    total: number;
    status: "pending" | "approved" | "paid";
  }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function weekKey(date: Date) {
  const monday = new Date(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

export function earningsReport(courier: Courier): EarningsReport {
  const earnings = earningsOf(courier.id);

  /* Son 14 gün */
  const map = new Map<string, EarningsBucket>();
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const key = dayKey(date);
    map.set(key, {
      key,
      label: new Intl.DateTimeFormat("tr-TR", {
        day: "numeric",
        month: "short",
      }).format(date),
      deliveries: 0,
      fee: 0,
      tip: 0,
      total: 0,
    });
  }

  for (const earning of earnings) {
    const bucket = map.get(dayKey(new Date(earning.at)));
    if (!bucket) continue;
    bucket.deliveries += 1;
    bucket.fee = round2(bucket.fee + earning.fee);
    bucket.tip = round2(bucket.tip + earning.tip);
    bucket.total = round2(bucket.fee + bucket.tip);
  }

  /*
   * Haftalık hakedişler ortak defterden okunur: yönetici panelinde
   * onaylanan tutar ve durum burada birebir görünür.
   */
  const payouts = payoutsFor("courier", courier.id)
    .slice(0, 6)
    .map((p) => ({
      id: p.id,
      label: p.periodLabel,
      deliveries: p.orders,
      total: p.net,
      status: p.status,
    }));

  const fee = round2(earnings.reduce((total, e) => total + e.fee, 0));
  const tip = round2(earnings.reduce((total, e) => total + e.tip, 0));

  return {
    totals: {
      deliveries: earnings.length,
      fee,
      tip,
      total: round2(fee + tip),
    },
    buckets: [...map.values()],
    recent: earnings.slice(0, 20),
    payouts,
  };
}

export interface PerformanceReport {
  rating: number;
  ratingCount: number;
  totalDeliveries: number;
  /** Ortalama teslimat süresi (teslim alma → teslim etme, dk) */
  avgDeliveryMinutes: number;
  /** En hızlı teslimat */
  fastestMinutes: number | null;
  /** Kabul oranı (%) */
  acceptanceRate: number;
  offers: { accepted: number; rejected: number; expired: number };
  avgDistanceKm: number;
  /** Bu haftaki çevrimiçi teslimat sayısı */
  weekDeliveries: number;
}

export function performanceReport(courier: Courier): PerformanceReport {
  const earnings = earningsOf(courier.id);
  const offers = offersOf(courier.id);

  const accepted = offers.filter((o) => o.status === "accepted").length;
  const rejected = offers.filter((o) => o.status === "rejected").length;
  const expired = offers.filter((o) => o.status === "expired").length;
  const answered = accepted + rejected + expired;

  const durations = earnings.map((e) => e.durationMinutes);
  const weekStart = startOfWeek();

  return {
    rating: courier.rating,
    ratingCount: courier.ratingCount,
    totalDeliveries: courier.totalDeliveries,
    avgDeliveryMinutes: durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0,
    fastestMinutes: durations.length ? Math.min(...durations) : null,
    acceptanceRate: answered ? Math.round((accepted / answered) * 100) : 100,
    offers: { accepted, rejected, expired },
    avgDistanceKm: earnings.length
      ? Math.round(
          (earnings.reduce((a, e) => a + e.distanceKm, 0) / earnings.length) * 10
        ) / 10
      : 0,
    weekDeliveries: earnings.filter((e) => new Date(e.at).getTime() >= weekStart)
      .length,
  };
}

/** Kurye listesi — giriş ekranındaki seçici için. */
export function courierPickerList() {
  return db().couriers.map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    vehicle: c.vehicle,
    rating: c.rating,
    online: c.online,
  }));
}

export { courierDriven };
