import "server-only";
import { asJson, dispatchNow, sql, type Db } from "../db/client";
import {
  addOrderEvent,
  findCourier,
  findCourierRow,
  findOrderRow,
  hydrateOrders,
} from "../db/queries";
import {
  toCourierSummary,
  toEarning,
  toOffer,
  type EarningRow,
  type OfferRow,
  type OrderRow,
} from "../db/mappers";
import { appSettings, scaledMs } from "../db/settings";
import { toCourierView } from "../orders/progress";
import { DomainError } from "../errors";
import type { Courier, CourierEarning, DeliveryOffer, LatLng, Order } from "../types";
import { buildRoute, createId, dayKey, distanceKm, formatDayKey, round2 } from "../utils";
import { payoutsFor } from "./payouts";

/**
 * Kurye Uygulaması (Courier App) iş mantığı.
 *
 * Üç sorumluluk: vardiya ve konum, teklif akışı (atanan siparişi süre
 * kısıtıyla kabul/ret) ve teslimat aşamaları. Teklifleri veritabanındaki
 * dağıtım turu üretir (`app_private.dispatch_tick`); burası kuryenin
 * kararlarını uygular.
 */

/** Kuryeye ödenen paket ücreti: sabit taban + mesafe başına (dağıtım turuyla aynı). */
export function courierFee(totalKm: number): number {
  return round2(Math.max(45, 35 + totalKm * 11));
}

export { OFFER_TTL_SECONDS } from "../courier-constants";

/* ================================================================== */
/* Giriş: telefon + doğrulama kodu                                    */
/* ================================================================== */

/** Telefon numarasıyla kayıtlı kurye (giriş için). */
export async function courierByPhone(phone: string): Promise<Courier | null> {
  const normalized = phone.replace(/D/g, "").slice(-10);
  if (normalized.length !== 10) return null;
  const [row] = await sql<{ id: string }[]>`select id from public.couriers where phone = ${normalized}`;
  return row ? findCourier(row.id) : null;
}

/**
 * Demo giriş ekranındaki kurye listesi. Telefon numarası yalnızca demo
 * modunda döner (kurye kartına dokununca numara alanı dolsun diye).
 */
export async function courierPickerList(includePhone: boolean) {
  const rows = await sql<
    { id: string; name: string; emoji: string; vehicle: Courier["vehicle"]; rating: number; online: boolean; phone: string; status: Courier["status"] }[]
  >`select id, name, emoji, vehicle, rating, online, phone, status from public.couriers order by id`;
  return rows.map(({ phone, ...rest }) => (includePhone ? { ...rest, phone } : rest));
}

/* ================================================================== */
/* Vardiya ve konum                                                   */
/* ================================================================== */

const ACTIVE_STAGES = ["assigned", "at_restaurant", "picked_up"];

/** Kuryenin üzerindeki açık teslimat. İptal ve teslim edilenler sayılmaz. */
export async function activeOrderRow(courierId: string, db: Db = sql): Promise<OrderRow | null> {
  const [row] = await db<OrderRow[]>`
    select * from public.orders
     where courier_id = ${courierId}
       and courier_stage = any(${ACTIVE_STAGES}::text[])
       and status not in ('delivered', 'cancelled')
     order by created_at desc
     limit 1
  `;
  return row ?? null;
}

/**
 * Mesai aç/kapat. Kurye uygulaması mesaiyi açarken cihazın o anki konumunu
 * gönderir; konum son 5 dakikada gelmemiş kurye teklif almaz.
 */
export async function setShift(courier: Courier, online: boolean, point?: LatLng | null): Promise<Courier> {
  if (online && courier.status !== "active") {
    throw new DomainError(
      "courier_not_active",
      courier.status === "pending"
        ? "Hesabın henüz onaylanmadı. Platform ekibi aktivasyonunu tamamlayınca mesaiye başlayabilirsin."
        : "Hesabın askıya alındı. Destek ekibiyle iletişime geçmelisin."
    );
  }

  await sql.begin(async (tx) => {
    if (!online && (await activeOrderRow(courier.id, tx))) {
      throw new DomainError(
        "active_delivery",
        "Üzerinde açık bir teslimat varken mesaiyi kapatamazsın."
      );
    }

    // Tek güncelleme: ekranlara tek "kurye değişti" yayını gider
    if (online && validPoint(point)) {
      await tx`
        update public.couriers
           set online = true, shift_started_at = now(),
               lat = ${point.lat}, lng = ${point.lng}, location_updated_at = now()
         where id = ${courier.id}
      `;
    } else {
      await tx`
        update public.couriers
           set online = ${online},
               shift_started_at = ${online ? new Date() : null}
         where id = ${courier.id}
      `;
    }

    if (!online) {
      // Vardiya dışında bekleyen teklifler düşer, sipariş başka kuryeye gider
      const expired = await tx<{ orderId: string }[]>`
        update public.delivery_offers set status = 'expired', responded_at = now()
         where courier_id = ${courier.id} and status = 'pending'
        returning order_id
      `;
      if (expired.length) {
        await tx`
          update public.orders set courier_stage = 'unassigned'
           where id = any(${expired.map((e) => e.orderId)}::text[])
             and courier_stage = 'offered' and courier_id is null
        `;
      }
    }
  });

  if (online) await dispatchNow().catch((err) => console.warn("[sofra/dispatch]", err));
  return (await findCourier(courier.id))!;
}

/**
 * Cihazdan gelen konum bildirimi. Kuryenin üzerinde açık teslimat varsa
 * siparişin canlı kurye konumu da güncellenir — müşterinin takip haritası
 * bundan beslenir.
 */
function validPoint(point: LatLng | null | undefined): point is LatLng {
  return Boolean(
    point &&
      typeof point.lat === "number" &&
      typeof point.lng === "number" &&
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lng) &&
      Math.abs(point.lat) <= 90 &&
      Math.abs(point.lng) <= 180
  );
}

export async function updateLocation(courier: Courier, point: LatLng): Promise<Courier> {
  if (!validPoint(point)) {
    throw new DomainError("invalid_point", "Geçersiz konum bilgisi.");
  }

  await sql`
    update public.couriers
       set lat = ${point.lat}, lng = ${point.lng}, location_updated_at = now()
     where id = ${courier.id}
  `;
  await sql`
    update public.orders
       set courier_lat = ${point.lat}, courier_lng = ${point.lng}
     where courier_id = ${courier.id}
       and courier_stage = any(${ACTIVE_STAGES}::text[])
       and status not in ('delivered', 'cancelled')
       and (courier_lat is distinct from ${point.lat} or courier_lng is distinct from ${point.lng})
  `;
  return (await findCourier(courier.id))!;
}

/* ================================================================== */
/* Teklif akışı                                                       */
/* ================================================================== */

export async function acceptOffer(courier: Courier, offerId: string): Promise<void> {
  await sql.begin(async (tx) => {
    const [offer] = await tx<OfferRow[]>`
      select * from public.delivery_offers
       where id = ${offerId} and courier_id = ${courier.id}
       for update
    `;
    if (!offer) throw new DomainError("offer_not_found", "Teklif bulunamadı.", 404);
    if (offer.status === "expired" || (offer.status === "pending" && offer.expiresAt.getTime() <= Date.now())) {
      if (offer.status === "pending") {
        await tx`update public.delivery_offers set status = 'expired', responded_at = now() where id = ${offer.id}`;
      }
      return { error: ["offer_expired", "Teklifin süresi doldu, sipariş başka bir kuryeye gönderildi."] };
    }
    if (offer.status !== "pending") {
      throw new DomainError("offer_closed", "Bu teklif artık geçerli değil.");
    }

    const fresh = await findCourierRow(courier.id, tx);
    if (!fresh || fresh.status !== "active" || !fresh.online) {
      throw new DomainError("courier_offline", "Teklif kabul etmek için mesaide olmalısın.");
    }
    if (await activeOrderRow(courier.id, tx)) {
      throw new DomainError("already_busy", "Üzerinde açık bir teslimat var. Önce onu tamamla.");
    }

    const order = await findOrderRow(offer.orderId, tx, { forUpdate: true });
    if (!order) throw new DomainError("order_not_found", "Sipariş bulunamadı.", 404);

    // İptal edilen, teslim edilen ya da başka kuryenin aldığı sipariş kabul edilemez
    if (order.status !== "preparing" || order.courierId) {
      await tx`update public.delivery_offers set status = 'expired', responded_at = now() where id = ${offer.id}`;
      return {
        error:
          order.status === "cancelled"
            ? ["order_cancelled", "Bu sipariş iptal edildi."]
            : ["order_taken", "Bu sipariş artık müsait değil."],
      };
    }

    await tx`
      update public.delivery_offers set status = 'accepted', responded_at = now() where id = ${offer.id}
    `;
    await tx`
      update public.orders
         set courier_id = ${courier.id},
             courier = ${tx.json(asJson(toCourierSummary(fresh)))},
             courier_stage = 'assigned',
             courier_fee = ${offer.fee},
             courier_lat = ${fresh.lat},
             courier_lng = ${fresh.lng}
       where id = ${order.id}
    `;
    await addOrderEvent(tx, order.id, "preparing", `${fresh.name} siparişi üstlendi, restorana gidiyor.`);
    return { error: null };
  }).then((result) => {
    if (result.error) throw new DomainError(result.error[0], result.error[1]);
  });
}

export async function rejectOffer(courier: Courier, offerId: string): Promise<void> {
  await sql.begin(async (tx) => {
    const [offer] = await tx<OfferRow[]>`
      update public.delivery_offers set status = 'rejected', responded_at = now()
       where id = ${offerId} and courier_id = ${courier.id} and status = 'pending'
      returning *
    `;
    if (!offer) return;
    await tx`
      update public.orders set courier_stage = 'unassigned'
       where id = ${offer.orderId} and courier_stage = 'offered' and courier_id is null
    `;
  });
  // Sıradaki en yakın kuryeye hemen gönder
  await dispatchNow().catch((err) => console.warn("[sofra/dispatch]", err));
}

/* ================================================================== */
/* Teslimat aşamaları                                                 */
/* ================================================================== */

export type StageAction = "arrived" | "pickup" | "deliver";

/**
 * Aşama bildirimleri: Restorana vardım → Teslim aldım → Teslim ettim.
 * `pickup` siparişi müşteri tarafında "Yolda"ya, `deliver` ise
 * "Teslim edildi"ye çevirir.
 */
export async function advanceStage(
  courier: Courier,
  orderId: string,
  action: StageAction
): Promise<Order> {
  const settings = await appSettings();

  await sql.begin(async (tx) => {
    const order = await findOrderRow(orderId, tx, { forUpdate: true });
    if (!order || order.courierId !== courier.id) {
      throw new DomainError("order_not_found", "Sipariş bulunamadı.", 404);
    }
    if (order.status === "cancelled") {
      throw new DomainError("order_cancelled", "Bu sipariş iptal edilmiş.");
    }
    const now = new Date();

    if (action === "arrived") {
      if (order.courierStage !== "assigned") {
        throw new DomainError("invalid_stage", "Bu bildirim yalnızca restorana giderken yapılabilir.");
      }
      await tx`
        update public.orders
           set courier_stage = 'at_restaurant', courier_arrived_at = ${now},
               courier_lat = restaurant_lat, courier_lng = restaurant_lng
         where id = ${order.id}
      `;
      await addOrderEvent(tx, order.id, order.status, `${courier.name} restorana vardı.`, now);
    }

    if (action === "pickup") {
      if (order.courierStage !== "at_restaurant") {
        throw new DomainError("invalid_stage", "Önce restorana vardığını bildirmelisin.");
      }
      if (order.status !== "preparing") {
        throw new DomainError("invalid_stage", "Restoran siparişi henüz onaylamadı.");
      }
      const route = buildRoute(
        { lat: order.restaurantLat, lng: order.restaurantLng },
        order.address.point
      );
      await tx`
        update public.orders
           set courier_stage = 'picked_up', status = 'on_the_way', picked_up_at = ${now},
               courier_lat = restaurant_lat, courier_lng = restaurant_lng,
               courier_route = ${tx.json(asJson(route))},
               eta_at = ${new Date(now.getTime() + scaledMs(order.travelMinutes, settings))}
         where id = ${order.id}
      `;
      await addOrderEvent(tx, order.id, "on_the_way", `${courier.name} siparişi restorandan teslim aldı.`, now);
    }

    if (action === "deliver") {
      if (order.courierStage !== "picked_up") {
        throw new DomainError("invalid_stage", "Önce siparişi restorandan teslim almalısın.");
      }
      await tx`
        update public.orders
           set courier_stage = 'delivered', status = 'delivered', delivered_at = ${now},
               courier_lat = ${order.address.point.lat}, courier_lng = ${order.address.point.lng}
         where id = ${order.id}
      `;
      await addOrderEvent(tx, order.id, "delivered", `${courier.name} siparişi adrese teslim etti.`, now);

      const pickedUp = order.pickedUpAt ? order.pickedUpAt.getTime() : now.getTime();
      const km = distanceKm({ lat: order.restaurantLat, lng: order.restaurantLng }, order.address.point);
      await tx`
        insert into public.courier_earnings (
          id, courier_id, order_id, order_code, restaurant_name, fee, tip, distance_km,
          duration_minutes, at
        ) values (
          ${createId("ern")}, ${courier.id}, ${order.id}, ${order.code}, ${order.restaurantName},
          ${order.courierFee ?? courierFee(order.travelMinutes / 2.5)}, 0, ${Math.round(km * 10) / 10},
          ${Math.max(1, Math.round((now.getTime() - pickedUp) / 60_000))}, ${now}
        )
      `;
      await tx`
        update public.couriers
           set total_deliveries = total_deliveries + 1,
               lat = ${order.address.point.lat}, lng = ${order.address.point.lng}
         where id = ${courier.id}
      `;
    }
  });

  const [order] = await hydrateOrders([(await findOrderRow(orderId))!]);
  return toCourierView(order);
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

export async function courierStats(courier: Courier): Promise<CourierSummaryStats> {
  const [row] = await sql<
    { todayCount: number; todayTotal: number; todayTips: number; weekTotal: number }[]
  >`
    with bounds as (
      select (date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul') as day_start,
             (date_trunc('week', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul') as week_start
    )
    select
      count(*) filter (where e.at >= b.day_start)::int as today_count,
      coalesce(sum(e.fee + e.tip) filter (where e.at >= b.day_start), 0) as today_total,
      coalesce(sum(e.tip) filter (where e.at >= b.day_start), 0) as today_tips,
      coalesce(sum(e.fee + e.tip) filter (where e.at >= b.week_start), 0) as week_total
    from bounds b
    left join public.courier_earnings e on e.courier_id = ${courier.id} and e.at >= b.week_start
    group by b.day_start, b.week_start
  `;

  return {
    online: courier.online,
    shiftStartedAt: courier.shiftStartedAt,
    todayDeliveries: row?.todayCount ?? 0,
    todayEarnings: round2(row?.todayTotal ?? 0),
    todayTips: round2(row?.todayTips ?? 0),
    weekEarnings: round2(row?.weekTotal ?? 0),
    totalDeliveries: courier.totalDeliveries,
    rating: courier.rating,
  };
}

export async function courierBoard(courier: Courier): Promise<CourierBoard> {
  const fresh = (await findCourier(courier.id)) ?? courier;

  const [pending] = await sql<OfferRow[]>`
    select * from public.delivery_offers
     where courier_id = ${courier.id} and status = 'pending' and expires_at > now()
     order by created_at desc limit 1
  `;

  let offer: CourierBoard["offer"] = null;
  if (pending) {
    const row = await findOrderRow(pending.orderId);
    if (row && row.status !== "cancelled") {
      const [order] = await hydrateOrders([row]);
      offer = {
        ...toOffer(pending),
        order: toCourierView(order),
        secondsLeft: Math.max(0, Math.round((pending.expiresAt.getTime() - Date.now()) / 1000)),
      };
    }
  }

  const activeRow = await activeOrderRow(courier.id);
  const activeOrder = activeRow ? toCourierView((await hydrateOrders([activeRow]))[0]) : null;

  return { courier: fresh, offer, activeOrder, stats: await courierStats(fresh) };
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

export async function earningsReport(courier: Courier): Promise<EarningsReport> {
  const rows = await sql<EarningRow[]>`
    select * from public.courier_earnings where courier_id = ${courier.id} order by at desc
  `;
  const earnings = rows.map(toEarning);

  /* Son 14 gün (İstanbul takvimiyle) */
  const map = new Map<string, EarningsBucket>();
  for (let i = 13; i >= 0; i--) {
    const key = dayKey(new Date(Date.now() - i * DAY_MS));
    map.set(key, { key, label: formatDayKey(key), deliveries: 0, fee: 0, tip: 0, total: 0 });
  }
  for (const earning of earnings) {
    const bucket = map.get(dayKey(new Date(earning.at)));
    if (!bucket) continue;
    bucket.deliveries += 1;
    bucket.fee = round2(bucket.fee + earning.fee);
    bucket.tip = round2(bucket.tip + earning.tip);
    bucket.total = round2(bucket.fee + bucket.tip);
  }

  const payouts = (await payoutsFor("courier", courier.id)).slice(0, 6).map((p) => ({
    id: p.id,
    label: p.periodLabel,
    deliveries: p.orders,
    total: p.net,
    status: p.status,
  }));

  const fee = round2(earnings.reduce((total, e) => total + e.fee, 0));
  const tip = round2(earnings.reduce((total, e) => total + e.tip, 0));

  return {
    totals: { deliveries: earnings.length, fee, tip, total: round2(fee + tip) },
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
  /** Bu haftaki teslimat sayısı */
  weekDeliveries: number;
}

export async function performanceReport(courier: Courier): Promise<PerformanceReport> {
  const [earn] = await sql<
    { count: number; avgMinutes: number | null; fastest: number | null; avgKm: number | null; week: number }[]
  >`
    select count(*)::int as count,
           avg(duration_minutes) as avg_minutes,
           min(duration_minutes) as fastest,
           avg(distance_km) as avg_km,
           count(*) filter (
             where at >= (date_trunc('week', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul')
           )::int as week
      from public.courier_earnings where courier_id = ${courier.id}
  `;
  const [offers] = await sql<{ accepted: number; rejected: number; expired: number }[]>`
    select count(*) filter (where status = 'accepted')::int as accepted,
           count(*) filter (where status = 'rejected')::int as rejected,
           count(*) filter (where status = 'expired')::int as expired
      from public.delivery_offers where courier_id = ${courier.id}
  `;
  const answered = offers.accepted + offers.rejected + offers.expired;

  return {
    rating: courier.rating,
    ratingCount: courier.ratingCount,
    totalDeliveries: courier.totalDeliveries,
    avgDeliveryMinutes: earn.avgMinutes ? Math.round(earn.avgMinutes) : 0,
    fastestMinutes: earn.fastest,
    acceptanceRate: answered ? Math.round((offers.accepted / answered) * 100) : 100,
    offers,
    avgDistanceKm: earn.avgKm ? Math.round(earn.avgKm * 10) / 10 : 0,
    weekDeliveries: earn.week,
  };
}
