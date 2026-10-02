import "server-only";
import { PAYMENT_METHODS, SERVICE_FEE } from "../constants";
import { sql } from "../db/client";
import {
  addOrderEvent,
  findOrderRow,
  findRestaurantRow,
  hydrateOrders,
  recordAudit,
} from "../db/queries";
import {
  toBanner,
  toCoupon,
  toCourier,
  toRestaurantBase,
  toUser,
  type BannerRow,
  type CouponRow,
  type CourierRow,
  type OrderRow,
  type ProfileRow,
  type RestaurantRow,
} from "../db/mappers";
import { appSettings } from "../db/settings";
import { progressOf, remainingMinutes } from "../orders/progress";
import { DomainError } from "../errors";
import type {
  AdminAccount,
  Banner,
  Coupon,
  Courier,
  Order,
  PartnerApplication,
  PaymentMethodId,
  Payout,
  PushCampaign,
  Restaurant,
  User,
} from "../types";
import { createId, dayKey, formatDayKey, round2 } from "../utils";
import { supabaseAdmin } from "../supabase/admin";
import { cancelOrderTx } from "./lifecycle";
import { pendingMediaCount } from "./media";
import { applicationsByRestaurant, syncApplicationDecision } from "./partner";
import { listPayouts } from "./payouts";
import { applyWallet } from "./wallet";

/**
 * Yönetici paneli (Superadmin) iş mantığı.
 *
 *   1. Kullanıcı, restoran ve kurye yönetimi (onay, aktivasyon, kara liste)
 *   2. Canlı operasyon (aktif siparişler, gecikme alarmı, manuel iptal/iade)
 *   3. Pazarlama (kampanya kodları, vitrin afişleri, öne çıkanlar, push)
 *   4. Finansal mutabakat (GMV, net gelir, ödeme geçidi, hakediş onayı)
 *
 * Tüm manuel işlemler iz kaydına yazılır.
 */

/* ================================================================== */
/* Canlı operasyon                                                    */
/* ================================================================== */

/** Tahmini teslim saatini bu kadar dakika aşan sipariş "geciken" sayılır. */
export const LATE_THRESHOLD_MINUTES = 5;
/** Bu kadar aşan sipariş kritik alarm verir. */
export const CRITICAL_THRESHOLD_MINUTES = 15;

export interface LiveOrder {
  order: Order;
  progress: number;
  remainingMinutes: number;
  /** Tahmini teslim saatinin kaç dakika aşıldığı (negatifse zamanında) */
  lateMinutes: number;
  severity: "ontime" | "late" | "critical";
  /** Hazırlanıyor ama hiçbir kurye üstlenmedi (vardiyada kurye var, teklifler karşılıksız) */
  waitingCourier: boolean;
}

export async function liveOrders(now = Date.now()): Promise<LiveOrder[]> {
  const settings = await appSettings();
  const rows = await sql<OrderRow[]>`
    select * from public.orders
     where status in ('pending_approval', 'preparing', 'on_the_way')
     order by created_at
  `;
  const orders = await hydrateOrders(rows);

  return orders
    .map((order) => {
      const lateMinutes = Math.round((now - new Date(order.etaAt).getTime()) / 60_000);
      return {
        order,
        progress: progressOf(order, settings, now),
        remainingMinutes: remainingMinutes(order, now),
        lateMinutes,
        severity:
          lateMinutes >= CRITICAL_THRESHOLD_MINUTES
            ? "critical"
            : lateMinutes >= LATE_THRESHOLD_MINUTES
              ? "late"
              : "ontime",
        waitingCourier:
          order.status === "preparing" &&
          order.courierMode === "platform" &&
          !order.courier &&
          !order.simulated,
      } satisfies LiveOrder;
    })
    .sort((a, b) => b.lateMinutes - a.lateMinutes);
}

export interface AdminOverview {
  kpi: {
    activeOrders: number;
    lateOrders: number;
    todayOrders: number;
    todayGmv: number;
    onlineCouriers: number;
    openRestaurants: number;
    pendingRestaurants: number;
    pendingCouriers: number;
    pendingPayouts: number;
    /** Restoranların onaya gönderdiği fotoğraflar */
    pendingMedia: number;
    blockedUsers: number;
    /** Temsilci bekleyen destek konuşmaları */
    waitingSupport: number;
  };
  live: LiveOrder[];
  /** Haritada gösterilecek çevrimiçi kuryeler */
  couriers: {
    id: string;
    name: string;
    emoji: string;
    point: { lat: number; lng: number };
    busy: boolean;
  }[];
}

export async function adminOverview(now = Date.now()): Promise<AdminOverview> {
  const live = await liveOrders(now);

  const [kpi] = await sql<
    {
      todayOrders: number;
      todayGmv: number;
      onlineCouriers: number;
      openRestaurants: number;
      pendingRestaurants: number;
      pendingCouriers: number;
      pendingPayouts: number;
      blockedUsers: number;
      waitingSupport: number;
    }[]
  >`
    with day as (
      select (date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul') as start
    )
    select
      (select count(*)::int from public.orders, day where created_at >= day.start and status <> 'cancelled') as today_orders,
      (select coalesce(sum(grand_total), 0) from public.orders, day where created_at >= day.start and status <> 'cancelled') as today_gmv,
      (select count(*)::int from public.couriers where online) as online_couriers,
      (select count(*)::int from public.restaurants where approval_status = 'approved' and not temporarily_closed) as open_restaurants,
      (select count(*)::int from public.restaurants where approval_status = 'pending') as pending_restaurants,
      (select count(*)::int from public.couriers where status = 'pending') as pending_couriers,
      (select count(*)::int from public.payouts where status = 'pending') as pending_payouts,
      (select count(*)::int from public.profiles where blocked) as blocked_users,
      (select count(*)::int from public.support_sessions where status = 'waiting_agent') as waiting_support
  `;

  const busyIds = new Set(
    live
      .filter((l) => l.order.courier && !l.order.simulated)
      .map((l) => l.order.courier!.id)
  );
  const couriers = await sql<{ id: string; name: string; emoji: string; lat: number; lng: number }[]>`
    select id, name, emoji, lat, lng from public.couriers where online order by name
  `;

  return {
    kpi: {
      activeOrders: live.length,
      lateOrders: live.filter((l) => l.severity !== "ontime").length,
      todayOrders: kpi.todayOrders,
      todayGmv: round2(kpi.todayGmv),
      onlineCouriers: kpi.onlineCouriers,
      openRestaurants: kpi.openRestaurants,
      pendingRestaurants: kpi.pendingRestaurants,
      pendingCouriers: kpi.pendingCouriers,
      pendingPayouts: kpi.pendingPayouts,
      pendingMedia: await pendingMediaCount(),
      blockedUsers: kpi.blockedUsers,
      waitingSupport: kpi.waitingSupport,
    },
    live,
    couriers: couriers.map((c) => ({
      id: c.id,
      name: c.name,
      emoji: c.emoji,
      point: { lat: c.lat, lng: c.lng },
      busy: busyIds.has(c.id),
    })),
  };
}

/** Yöneticinin manuel sipariş iptali — online ödemede kalan tutar cüzdana iade edilir. */
export async function adminCancelOrder(admin: AdminAccount, orderId: string, reason: string): Promise<Order> {
  const result = await sql.begin(async (tx) => {
    const row = await findOrderRow(orderId, tx, { forUpdate: true });
    if (!row) throw new DomainError("order_not_found", "Sipariş bulunamadı.", 404);
    if (row.status === "delivered" || row.status === "cancelled") {
      throw new DomainError("order_closed", "Bu sipariş zaten kapanmış.");
    }
    const cleanReason = reason.trim().slice(0, 200) || "Platform tarafından iptal edildi";
    const { refunded } = await cancelOrderTx(tx, row, "support", cleanReason, `Platform iptali: ${cleanReason}`);
    return { code: row.code, reason: cleanReason, refunded };
  });

  await recordAudit(
    admin.name,
    "Sipariş iptali",
    result.code,
    `${result.reason}${result.refunded ? ` · ${result.refunded} ₺ iade` : ""}`
  );
  return (await hydrateOrders([(await findOrderRow(orderId))!]))[0];
}

/**
 * Manuel iade (kısmi veya tam). Toplam iade, siparişin henüz iade edilmemiş
 * kısmını aşamaz — aynı tutar iki kez geri ödenemez. Tahsil edilmemiş kapıda
 * ödeme için iade yapılmaz.
 */
export async function adminRefund(
  admin: AdminAccount,
  orderId: string,
  amount: number,
  reason: string
): Promise<{ order: Order; refunded: number; balance: number }> {
  const value = round2(Number(amount));
  if (!Number.isFinite(value) || value <= 0) {
    throw new DomainError("invalid_amount", "Geçerli bir iade tutarı gir.");
  }
  const cleanReason = reason.trim().slice(0, 200) || "gerekçe belirtilmedi";

  const result = await sql.begin(async (tx) => {
    const row = await findOrderRow(orderId, tx, { forUpdate: true });
    if (!row) throw new DomainError("order_not_found", "Sipariş bulunamadı.", 404);

    if (PAYMENT_METHODS[row.paymentMethod].onDelivery && row.status !== "delivered") {
      throw new DomainError(
        "not_collected",
        "Kapıda ödemeli bu siparişin tutarı henüz tahsil edilmedi; iade yapılamaz."
      );
    }
    const refundable = round2(row.grandTotal - row.refundedTotal);
    if (refundable <= 0) {
      throw new DomainError("already_refunded", "Bu siparişin tutarının tamamı zaten iade edildi.");
    }
    if (value > refundable) {
      throw new DomainError(
        "amount_too_large",
        `Bu siparişe en fazla ${refundable.toFixed(2).replace(".", ",")} ₺ daha iade edilebilir.`
      );
    }

    await tx`update public.orders set refunded_total = refunded_total + ${value} where id = ${row.id}`;
    await tx`
      update public.payments
         set refunded_amount = least(amount, refunded_amount + ${value}),
             status = case when refunded_amount + ${value} >= amount then 'refunded' else 'partially_refunded' end
       where order_id = ${row.id} and status in ('captured', 'partially_refunded', 'collected')
    `;
    const balance = await applyWallet(
      tx,
      row.userId,
      value,
      "manual_refund",
      `${row.restaurantName} — iade · ${cleanReason}`,
      row.id
    );
    await addOrderEvent(tx, row.id, row.status, `Platform iadesi: ${value} ₺ · ${cleanReason}`);
    return { code: row.code, balance };
  });

  await recordAudit(admin.name, "Manuel iade", result.code, `${value} ₺ · ${cleanReason}`);
  const order = (await hydrateOrders([(await findOrderRow(orderId))!]))[0];
  return { order, refunded: value, balance: result.balance };
}

/** Destek ve iade için sipariş arama (kod, müşteri adı ya da telefon). */
export async function searchOrders(query: string, limit = 20): Promise<Order[]> {
  const q = query.trim();
  if (q.length < 2) {
    const rows = await sql<OrderRow[]>`
      select * from public.orders where status in ('delivered', 'cancelled')
       order by created_at desc limit ${limit}
    `;
    return hydrateOrders(rows);
  }
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const digits = q.replace(/\D/g, "");
  const rows = await sql<OrderRow[]>`
    select o.* from public.orders o
      join public.profiles p on p.id = o.user_id
     where o.code ilike ${like}
        or p.name ilike ${like}
        or (${digits.length >= 4} and p.phone like ${`%${digits}%`})
     order by o.created_at desc
     limit ${limit}
  `;
  return hydrateOrders(rows);
}

/* ================================================================== */
/* Restoran yönetimi                                                  */
/* ================================================================== */

export interface AdminRestaurantRow {
  restaurant: Restaurant;
  orders: number;
  gmv: number;
  commissionEarned: number;
  rating: number;
  open: boolean;
  /** Başvuru formuyla gelenlerde yetkili ve işletme bilgileri */
  application?: PartnerApplication;
}

export async function adminRestaurants(): Promise<AdminRestaurantRow[]> {
  const rows = await sql<(RestaurantRow & { deliveredOrders: number; gmv: number; commissionEarned: number })[]>`
    select r.*,
           coalesce(s.orders, 0)::int as delivered_orders,
           coalesce(s.gmv, 0) as gmv,
           coalesce(s.commission, 0) as commission_earned
      from public.restaurants r
      left join (
        select restaurant_id, count(*) as orders, sum(grand_total) as gmv,
               sum(round(subtotal * commission_rate, 2)) as commission
          from public.orders where status = 'delivered' group by restaurant_id
      ) s on s.restaurant_id = r.id
  `;
  const applications = await applicationsByRestaurant();

  const rank = (status: Restaurant["approvalStatus"]) =>
    status === "pending" ? 0 : status === "suspended" ? 1 : 2;

  return rows
    .map((row) => ({
      restaurant: { ...toRestaurantBase(row), paymentMethods: row.paymentMethods as PaymentMethodId[], menu: [] },
      orders: row.deliveredOrders,
      gmv: round2(row.gmv),
      commissionEarned: round2(row.commissionEarned),
      rating: row.rating,
      open: row.approvalStatus === "approved" && !row.temporarilyClosed,
      application: applications.get(row.id),
    }))
    .sort((a, b) => rank(a.restaurant.approvalStatus) - rank(b.restaurant.approvalStatus) || b.gmv - a.gmv);
}

export async function setRestaurantApproval(
  admin: AdminAccount,
  restaurantId: string,
  status: Restaurant["approvalStatus"],
  reason?: string
): Promise<{ vendorMemberId: string | null }> {
  const result = await sql.begin(async (tx) => {
    const [row] = await tx<{ name: string }[]>`
      update public.restaurants
         set approval_status = ${status},
             temporarily_closed = case when ${status} = 'suspended' then true else temporarily_closed end
       where id = ${restaurantId}
      returning name
    `;
    if (!row) throw new DomainError("restaurant_not_found", "Restoran bulunamadı.", 404);
    const decision = await syncApplicationDecision(tx, restaurantId, status, reason);
    return { name: row.name, ...decision };
  });

  const labels = {
    approved: "Restoran onaylandı",
    suspended: "Restoran askıya alındı",
    pending: "Restoran onay beklemeye alındı",
  } as const;
  await recordAudit(admin.name, labels[status], result.name, reason);
  return { vendorMemberId: result.vendorMemberId };
}

export async function setCommissionRate(admin: AdminAccount, restaurantId: string, rate: number): Promise<void> {
  const value = Number(rate);
  if (!Number.isFinite(value) || value < 0 || value > 0.4) {
    throw new DomainError("invalid_rate", "Komisyon oranı %0 ile %40 arasında olmalı.");
  }
  const current = await findRestaurantRow(restaurantId);
  if (!current) throw new DomainError("restaurant_not_found", "Restoran bulunamadı.", 404);
  const next = Math.round(value * 1000) / 1000;
  await sql`update public.restaurants set commission_rate = ${next} where id = ${restaurantId}`;
  await recordAudit(
    admin.name,
    "Komisyon oranı değişti",
    current.name,
    `%${Math.round(current.commissionRate * 100)} → %${Math.round(next * 100)}`
  );
}

/** Öne çıkanlar: sıra numarası verilen restoran anasayfanın vitrininde görünür. */
export async function setFeatured(admin: AdminAccount, restaurantId: string, rank: number | null): Promise<void> {
  const value = rank === null ? null : Math.round(Number(rank));
  if (value !== null && (!Number.isFinite(value) || value < 1 || value > 99)) {
    throw new DomainError("invalid_rank", "Sıra 1 ile 99 arasında olmalı.");
  }
  const [row] = await sql<{ name: string; approvalStatus: string }[]>`
    update public.restaurants set featured_rank = ${value} where id = ${restaurantId}
    returning name, approval_status
  `;
  if (!row) throw new DomainError("restaurant_not_found", "Restoran bulunamadı.", 404);
  await recordAudit(
    admin.name,
    value === null ? "Öne çıkanlardan çıkarıldı" : "Öne çıkanlara eklendi",
    row.name,
    value === null ? undefined : `Sıra ${value}`
  );
}

/* ================================================================== */
/* Kurye yönetimi                                                     */
/* ================================================================== */

export interface AdminCourierRow {
  courier: Courier;
  deliveries: number;
  earnings: number;
  busy: boolean;
}

export async function adminCouriers(): Promise<AdminCourierRow[]> {
  const rows = await sql<(CourierRow & { deliveries: number; earnings: number; busy: boolean })[]>`
    select c.*,
           coalesce(e.deliveries, 0)::int as deliveries,
           coalesce(e.earnings, 0) as earnings,
           exists (
             select 1 from public.orders o
              where o.courier_id = c.id
                and o.courier_stage in ('assigned', 'at_restaurant', 'picked_up')
                and o.status not in ('delivered', 'cancelled')
           ) as busy
      from public.couriers c
      left join (
        select courier_id, count(*) as deliveries, sum(fee + tip) as earnings
          from public.courier_earnings group by courier_id
      ) e on e.courier_id = c.id
  `;
  const rank = (status: Courier["status"]) => (status === "pending" ? 0 : status === "suspended" ? 1 : 2);
  return rows
    .map((row) => ({ courier: toCourier(row), deliveries: row.deliveries, earnings: round2(row.earnings), busy: row.busy }))
    .sort((a, b) => rank(a.courier.status) - rank(b.courier.status) || b.deliveries - a.deliveries);
}

export async function setCourierStatus(
  admin: AdminAccount,
  courierId: string,
  status: Courier["status"],
  reason?: string
): Promise<void> {
  const name = await sql.begin(async (tx) => {
    const [row] = await tx<{ name: string }[]>`
      update public.couriers
         set status = ${status},
             online = case when ${status} = 'active' then online else false end,
             shift_started_at = case when ${status} = 'active' then shift_started_at else null end
       where id = ${courierId}
      returning name
    `;
    if (!row) throw new DomainError("courier_not_found", "Kurye bulunamadı.", 404);

    if (status !== "active") {
      // Askıya alınan kurye derhal mesaiden düşer, bekleyen teklifleri kapanır
      const expired = await tx<{ orderId: string }[]>`
        update public.delivery_offers set status = 'expired', responded_at = now()
         where courier_id = ${courierId} and status = 'pending'
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
    return row.name;
  });

  const labels = {
    active: "Kurye aktifleştirildi",
    suspended: "Kurye askıya alındı",
    pending: "Kurye onay beklemeye alındı",
  } as const;
  await recordAudit(admin.name, labels[status], name, reason);
}

/* ================================================================== */
/* Müşteri yönetimi                                                   */
/* ================================================================== */

export interface AdminUserRow {
  user: User;
  orders: number;
  spent: number;
  lastOrderAt?: string;
}

export async function adminUsers(query = ""): Promise<AdminUserRow[]> {
  const q = query.trim();
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const rows = await sql<(ProfileRow & { orders: number; spent: number; lastOrderAt: Date | null })[]>`
    select p.*,
           coalesce(s.orders, 0)::int as orders,
           coalesce(s.spent, 0) as spent,
           s.last_order_at
      from public.profiles p
      left join (
        select user_id, count(*) as orders, sum(grand_total) as spent, max(created_at) as last_order_at
          from public.orders where status = 'delivered' group by user_id
      ) s on s.user_id = p.id
     where ${q === ""} or p.name ilike ${like} or coalesce(p.email, '') ilike ${like}
        or coalesce(p.phone, '') like ${like}
     order by p.blocked desc, coalesce(s.spent, 0) desc, p.created_at desc
     limit 200
  `;
  return rows.map((row) => ({
    user: toUser(row, []),
    orders: row.orders,
    spent: round2(row.spent),
    lastOrderAt: row.lastOrderAt?.toISOString(),
  }));
}

export async function setUserBlocked(
  admin: AdminAccount,
  userId: string,
  blocked: boolean,
  reason?: string
): Promise<void> {
  const blockReason = blocked ? reason?.trim().slice(0, 200) || "Platform kuralları ihlali" : null;
  const [row] = await sql<{ name: string; authUserId: string | null }[]>`
    update public.profiles
       set blocked = ${blocked}, block_reason = ${blockReason},
           blocked_at = ${blocked ? new Date() : null}
     where id = ${userId}
    returning name, auth_user_id
  `;
  if (!row) throw new DomainError("user_not_found", "Kullanıcı bulunamadı.", 404);

  // Auth tarafında da yasakla: mevcut erişim token'ı en geç 1 saatte biter,
  // yenilenemez. (API her istekte kara listeyi zaten ayrıca denetler.)
  if (row.authUserId) {
    const { error } = await supabaseAdmin().auth.admin.updateUserById(row.authUserId, {
      ban_duration: blocked ? "876000h" : "none",
    });
    if (error) console.warn("[sofra/admin] Auth yasağı uygulanamadı:", error.message);
  }

  await recordAudit(
    admin.name,
    blocked ? "Kullanıcı kara listeye alındı" : "Kara listeden çıkarıldı",
    row.name,
    blockReason ?? undefined
  );
}

/** Manuel bakiye yükleme ya da düşümü (jest, tazminat, düzeltme). */
export async function creditWallet(
  admin: AdminAccount,
  userId: string,
  amount: number,
  reason: string
): Promise<void> {
  const value = round2(Number(amount));
  if (!Number.isFinite(value) || value === 0 || Math.abs(value) > 10000) {
    throw new DomainError("invalid_amount", "Tutar sıfırdan farklı ve en fazla 10.000 ₺ olmalı.");
  }
  const cleanReason = reason.trim().slice(0, 200) || "gerekçe yok";

  const name = await sql.begin(async (tx) => {
    const [row] = await tx<{ name: string }[]>`select name from public.profiles where id = ${userId}`;
    if (!row) throw new DomainError("user_not_found", "Kullanıcı bulunamadı.", 404);
    try {
      await applyWallet(
        tx,
        userId,
        value,
        value > 0 ? "admin_credit" : "admin_debit",
        value > 0 ? `Platform bakiye yüklemesi · ${cleanReason}` : `Platform bakiye düzeltmesi · ${cleanReason}`
      );
    } catch (err) {
      if (err instanceof DomainError && err.code === "insufficient_wallet") {
        throw new DomainError("negative_balance", "Bakiye eksiye düşemez.");
      }
      throw err;
    }
    return row.name;
  });

  await recordAudit(
    admin.name,
    value > 0 ? "Manuel bakiye yükleme" : "Manuel bakiye düşümü",
    name,
    `${value > 0 ? "+" : ""}${value} ₺ · ${cleanReason}`
  );
}

/* ================================================================== */
/* Pazarlama                                                          */
/* ================================================================== */

export interface MarketingSnapshot {
  coupons: Coupon[];
  banners: Banner[];
  campaigns: PushCampaign[];
  districts: string[];
  restaurants: { id: string; name: string; emoji: string; featuredRank: number | null; approvalStatus: string }[];
}

export async function marketingSnapshot(): Promise<MarketingSnapshot> {
  const [coupons, banners, campaigns, districts, restaurants] = await Promise.all([
    sql<CouponRow[]>`select * from public.coupons order by created_at desc`,
    sql<BannerRow[]>`select * from public.banners order by position, id`,
    sql<
      { id: string; title: string; body: string; segment: PushCampaign["segment"]; districts: string[]; recipientCount: number; sentAt: Date }[]
    >`select id, title, body, segment, districts, recipient_count, sent_at from public.push_campaigns order by sent_at desc limit 20`,
    sql<{ district: string }[]>`select distinct district from public.addresses order by district`,
    sql<{ id: string; name: string; emoji: string; featuredRank: number | null; approvalStatus: string }[]>`
      select id, name, emoji, featured_rank, approval_status from public.restaurants order by name
    `,
  ]);
  return {
    coupons: coupons.map(toCoupon),
    banners: banners.map(toBanner),
    campaigns: campaigns.map((c) => ({
      id: c.id,
      title: c.title,
      body: c.body,
      segment: c.segment,
      districts: c.districts,
      recipientCount: c.recipientCount,
      sentAt: c.sentAt.toISOString(),
    })),
    districts: districts.map((d) => d.district),
    restaurants,
  };
}

export interface CouponInput {
  code: string;
  title: string;
  description: string;
  type: Coupon["type"];
  value: number;
  minSubtotal: number;
  maxDiscount?: number | null;
  restaurantIds?: string[] | null;
  firstOrderOnly?: boolean;
  expiresAt: string;
  active?: boolean;
}

export async function upsertCoupon(admin: AdminAccount, input: CouponInput, originalCode?: string): Promise<void> {
  const code = (input.code ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(code)) {
    throw new DomainError("invalid_code", "Kod 3-20 karakter, yalnızca harf ve rakam olmalı.");
  }
  if ((input.title ?? "").trim().length < 3) {
    throw new DomainError("invalid_title", "Başlık en az 3 karakter olmalı.");
  }
  if (!["percent", "amount", "free_delivery"].includes(input.type)) {
    throw new DomainError("invalid_type", "Geçersiz kampanya türü.");
  }
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < 0) throw new DomainError("invalid_value", "Geçerli bir indirim değeri gir.");
  if (input.type === "percent" && value > 100) {
    throw new DomainError("invalid_value", "Yüzde indirimi 100'ü aşamaz.");
  }
  if (!input.expiresAt || Number.isNaN(Date.parse(input.expiresAt))) {
    throw new DomainError("invalid_date", "Geçerli bir bitiş tarihi seç.");
  }

  const original = (originalCode ?? code).trim().toUpperCase();
  const payload = {
    code,
    type: input.type,
    value: round2(value),
    title: input.title.trim().slice(0, 80),
    description: (input.description ?? "").trim().slice(0, 300),
    minSubtotal: round2(Number(input.minSubtotal) || 0),
    maxDiscount:
      input.maxDiscount === null || input.maxDiscount === undefined || input.maxDiscount === ("" as never)
        ? null
        : round2(Number(input.maxDiscount)),
    restaurantIds: input.restaurantIds && input.restaurantIds.length ? input.restaurantIds : null,
    firstOrderOnly: Boolean(input.firstOrderOnly),
    expiresAt: new Date(input.expiresAt),
    active: input.active !== false,
  };

  const existed = await sql.begin(async (tx) => {
    const [existing] = await tx<{ code: string }[]>`select code from public.coupons where code = ${original} for update`;
    if (!existing) {
      const [taken] = await tx<{ code: string }[]>`select code from public.coupons where code = ${code}`;
      if (taken) throw new DomainError("code_taken", "Bu kod zaten kullanımda.");
      await tx`insert into public.coupons ${tx(payload)}`;
      return false;
    }
    if (code !== original) {
      const [taken] = await tx<{ code: string }[]>`select code from public.coupons where code = ${code}`;
      if (taken) throw new DomainError("code_taken", "Bu kod zaten kullanımda.");
    }
    await tx`update public.coupons set ${tx(payload)} where code = ${original}`;
    return true;
  });

  await recordAudit(admin.name, existed ? "Kampanya güncellendi" : "Kampanya oluşturuldu", code, payload.title);
}

export async function deleteCoupon(admin: AdminAccount, code: string): Promise<void> {
  const [row] = await sql<{ code: string; title: string }[]>`
    delete from public.coupons where code = ${code.trim().toUpperCase()} returning code, title
  `;
  if (!row) throw new DomainError("coupon_not_found", "Kampanya bulunamadı.", 404);
  await recordAudit(admin.name, "Kampanya silindi", row.code, row.title);
}

export async function toggleCoupon(admin: AdminAccount, code: string): Promise<void> {
  const [row] = await sql<{ code: string; active: boolean }[]>`
    update public.coupons set active = not active where code = ${code.trim().toUpperCase()}
    returning code, active
  `;
  if (!row) throw new DomainError("coupon_not_found", "Kampanya bulunamadı.", 404);
  await recordAudit(admin.name, row.active ? "Kampanya yayına alındı" : "Kampanya yayından kaldırıldı", row.code);
}

export interface BannerInput {
  id?: string;
  title: string;
  subtitle: string;
  code?: string;
  emoji: string;
  gradient: [string, string];
  href: string;
  active?: boolean;
}

const COLOR = /^#[0-9a-fA-F]{6}$/;

export async function upsertBanner(admin: AdminAccount, input: BannerInput): Promise<void> {
  if ((input.title ?? "").trim().length < 3) {
    throw new DomainError("invalid_title", "Başlık en az 3 karakter olmalı.");
  }
  const href = (input.href ?? "/").trim();
  if (!href.startsWith("/") || href.startsWith("//")) {
    throw new DomainError("invalid_href", "Bağlantı site içi bir yol olmalı (ör. /?kategori=burger).");
  }
  const gradient = Array.isArray(input.gradient) ? input.gradient : [];
  if (gradient.length !== 2 || !gradient.every((c) => COLOR.test(c))) {
    throw new DomainError("invalid_gradient", "İki renk kodu seç (#RRGGBB).");
  }

  const payload = {
    title: input.title.trim().slice(0, 80),
    subtitle: (input.subtitle ?? "").trim().slice(0, 140),
    code: input.code?.trim().toUpperCase() || null,
    emoji: input.emoji?.trim() || "🎉",
    gradient,
    href,
    active: input.active !== false,
  };

  let existed = false;
  if (input.id) {
    const updated = await sql`update public.banners set ${sql(payload)} where id = ${input.id} returning id`;
    existed = updated.length > 0;
  }
  if (!existed) {
    await sql`
      insert into public.banners (id, title, subtitle, code, emoji, gradient, href, active, position)
      values (
        ${createId("bn")}, ${payload.title}, ${payload.subtitle}, ${payload.code}, ${payload.emoji},
        ${payload.gradient}, ${payload.href}, ${payload.active},
        (select coalesce(max(position), -1) + 1 from public.banners)
      )
    `;
  }
  await recordAudit(admin.name, existed ? "Afiş güncellendi" : "Afiş eklendi", payload.title);
}

export async function deleteBanner(admin: AdminAccount, id: string): Promise<void> {
  const [row] = await sql<{ title: string }[]>`delete from public.banners where id = ${id} returning title`;
  if (!row) throw new DomainError("banner_not_found", "Afiş bulunamadı.", 404);
  await recordAudit(admin.name, "Afiş silindi", row.title);
}

export async function moveBanner(admin: AdminAccount, id: string, direction: "up" | "down"): Promise<void> {
  await sql.begin(async (tx) => {
    const banners = await tx<{ id: string }[]>`select id from public.banners order by position, id for update`;
    const index = banners.findIndex((b) => b.id === id);
    if (index < 0) throw new DomainError("banner_not_found", "Afiş bulunamadı.", 404);
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= banners.length) return;
    const order = banners.map((b) => b.id);
    [order[index], order[target]] = [order[target], order[index]];
    for (const [position, bannerId] of order.entries()) {
      await tx`update public.banners set position = ${position} where id = ${bannerId}`;
    }
  });
}

export interface PushInput {
  title: string;
  body: string;
  segment: PushCampaign["segment"];
  districts?: string[];
  href?: string;
}

const SEGMENT_LABEL: Record<PushCampaign["segment"], string> = {
  all: "Tüm kullanıcılar",
  active: "Son 30 günde sipariş verenler",
  lapsed: "30 gündür sipariş vermeyenler",
  new: "Henüz sipariş vermemiş olanlar",
};

const SEGMENTS: PushCampaign["segment"][] = ["all", "active", "lapsed", "new"];

/** Segment ve bölgeye göre hedef kitle (kara listedekiler hariç). */
export async function pushAudience(segment: PushCampaign["segment"], districts: string[] = []): Promise<string[]> {
  if (!SEGMENTS.includes(segment)) throw new DomainError("invalid_segment", "Geçersiz hedef kitle.");
  const list = districts.filter(Boolean);
  const rows = await sql<{ id: string }[]>`
    select p.id from public.profiles p
     where not p.blocked
       and (
         ${segment} = 'all'
         or (${segment} = 'active' and exists (
               select 1 from public.orders o where o.user_id = p.id and o.created_at >= now() - interval '30 days'))
         or (${segment} = 'lapsed' and exists (select 1 from public.orders o where o.user_id = p.id)
             and not exists (
               select 1 from public.orders o where o.user_id = p.id and o.created_at >= now() - interval '30 days'))
         or (${segment} = 'new' and not exists (select 1 from public.orders o where o.user_id = p.id))
       )
       and (${list.length === 0} or exists (
             select 1 from public.addresses a where a.user_id = p.id and a.district = any(${list}::text[])))
  `;
  return rows.map((r) => r.id);
}

/**
 * Kampanya gönderimi: hedef kitledeki her müşterinin uygulama içi bildirim
 * kutusuna düşer (push izni vermemiş olsa bile görür). Tarayıcı bildirimi
 * aboneliği olanlara ayrıca push gönderilir.
 */
export async function sendPush(admin: AdminAccount, input: PushInput): Promise<PushCampaign> {
  const title = (input.title ?? "").trim();
  const body = (input.body ?? "").trim();
  if (title.length < 3) throw new DomainError("invalid_title", "Başlık en az 3 karakter olmalı.");
  if (body.length < 5) throw new DomainError("invalid_body", "Mesaj en az 5 karakter olmalı.");
  const href = input.href?.trim() || null;
  if (href && (!href.startsWith("/") || href.startsWith("//"))) {
    throw new DomainError("invalid_href", "Bağlantı site içi bir yol olmalı.");
  }

  const districts = (input.districts ?? []).filter(Boolean);
  const audience = await pushAudience(input.segment, districts);
  const id = createId("psh");

  await sql.begin(async (tx) => {
    await tx`
      insert into public.push_campaigns (id, title, body, href, segment, districts, recipient_count, sent_by)
      values (${id}, ${title.slice(0, 80)}, ${body.slice(0, 240)}, ${href}, ${input.segment},
              ${districts}, ${audience.length}, ${admin.name})
    `;
    if (audience.length) {
      await tx`
        insert into public.notifications (id, user_id, title, body, href, campaign_id, kind)
        select 'ntf_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 14), u, ${title.slice(0, 80)},
               ${body.slice(0, 240)}, ${href}, ${id}, 'campaign'
          from unnest(${audience}::text[]) as u
      `;
    }
  });

  await recordAudit(
    admin.name,
    "Push bildirimi gönderildi",
    title,
    `${SEGMENT_LABEL[input.segment]} · ${audience.length} kişi`
  );

  return {
    id,
    title,
    body,
    segment: input.segment,
    districts,
    recipientCount: audience.length,
    sentAt: new Date().toISOString(),
  };
}

/* ================================================================== */
/* Finansal mutabakat                                                 */
/* ================================================================== */

export async function setPayoutStatus(admin: AdminAccount, payoutId: string, action: "approve" | "pay"): Promise<void> {
  const [row] =
    action === "approve"
      ? await sql<{ targetName: string; periodLabel: string; net: number }[]>`
          update public.payouts set status = 'approved', approved_at = now(), approved_by = ${admin.name}
           where id = ${payoutId} and status = 'pending'
          returning target_name, period_label, net
        `
      : await sql<{ targetName: string; periodLabel: string; net: number }[]>`
          update public.payouts set status = 'paid', paid_at = now()
           where id = ${payoutId} and status = 'approved'
          returning target_name, period_label, net
        `;

  if (!row) {
    const [existing] = await sql<{ status: string }[]>`select status from public.payouts where id = ${payoutId}`;
    if (!existing) throw new DomainError("payout_not_found", "Hakediş kaydı bulunamadı.", 404);
    throw action === "approve"
      ? new DomainError("already_approved", "Bu hakediş zaten onaylanmış.")
      : new DomainError("not_approved", "Ödeme için önce hakedişi onaylaman gerekiyor.");
  }

  await recordAudit(
    admin.name,
    action === "approve" ? "Hakediş onaylandı" : "Hakediş ödendi",
    `${row.targetName} · ${row.periodLabel}`,
    `${row.net} ₺`
  );
}

export interface GatewayRow {
  method: PaymentMethodId;
  label: string;
  orders: number;
  volume: number;
  /** Ödeme geçidinin kestiği komisyon (kapıda ödemede ve cüzdanda yok) */
  gatewayFee: number;
  /** Başarılı / (başarılı + başarısız) işlem oranı */
  successRate: number;
  /** İade edilen tutar */
  refunded: number;
  settlement: "T+1" | "T+7" | "Kurye tahsilatı" | "Anında";
}

/** Online ödemelerde geçidin kestiği oran + işlem başı sabit ücret. */
const GATEWAY_RATE = 0.018;
const GATEWAY_FIXED = 0.25;

export interface FinanceSummary {
  gmv: number;
  productValue: number;
  commission: number;
  serviceFees: number;
  deliveryFees: number;
  discounts: number;
  courierCost: number;
  gatewayCost: number;
  /** Platformun karşıladığı manuel iadeler (teslim edilmiş siparişlerde) */
  refunds: number;
  netRevenue: number;
  orders: number;
  cancelled: number;
  avgOrderValue: number;
}

export interface AdminFinance {
  summary: FinanceSummary;
  /** Son 14 günün GMV ve net gelir kırılımı */
  buckets: { key: string; label: string; orders: number; gmv: number; netRevenue: number }[];
  gateway: GatewayRow[];
  payouts: Payout[];
  payoutTotals: { pending: number; approved: number; paid: number };
}

export async function adminFinance(): Promise<AdminFinance> {
  const [totals] = await sql<
    {
      orders: number;
      cancelled: number;
      gmv: number;
      productValue: number;
      commission: number;
      serviceFees: number;
      deliveryFees: number;
      discounts: number;
      refunds: number;
      courierCost: number;
    }[]
  >`
    select count(*) filter (where status = 'delivered')::int as orders,
           count(*) filter (where status = 'cancelled')::int as cancelled,
           coalesce(sum(grand_total) filter (where status = 'delivered'), 0) as gmv,
           coalesce(sum(subtotal) filter (where status = 'delivered'), 0) as product_value,
           coalesce(sum(round(subtotal * commission_rate, 2)) filter (where status = 'delivered'), 0) as commission,
           coalesce(sum(service_fee) filter (where status = 'delivered'), 0) as service_fees,
           coalesce(sum(delivery_fee) filter (where status = 'delivered' and courier_mode = 'platform'), 0) as delivery_fees,
           coalesce(sum(discount) filter (where status = 'delivered'), 0) as discounts,
           coalesce(sum(refunded_total) filter (where status = 'delivered'), 0) as refunds,
           (select coalesce(sum(fee), 0) from public.courier_earnings) as courier_cost
      from public.orders
  `;

  const gatewayRows = await sql<
    { method: PaymentMethodId; orders: number; volume: number; failed: number; succeeded: number; refunded: number }[]
  >`
    select method,
           count(*) filter (where status <> 'failed' and status <> 'voided')::int as orders,
           coalesce(sum(amount) filter (where status in ('captured', 'refunded', 'partially_refunded', 'collected')), 0) as volume,
           count(*) filter (where status = 'failed')::int as failed,
           count(*) filter (where status in ('captured', 'refunded', 'partially_refunded', 'collected'))::int as succeeded,
           coalesce(sum(refunded_amount), 0) as refunded
      from public.payments
     where purpose = 'order' or method = 'online_card'
     group by method
  `;
  const byMethod = new Map(gatewayRows.map((g) => [g.method, g]));

  const gateway: GatewayRow[] = (Object.keys(PAYMENT_METHODS) as PaymentMethodId[])
    .map((method) => {
      const row = byMethod.get(method);
      const onDelivery = PAYMENT_METHODS[method].onDelivery;
      const throughGateway = method === "online_card" || method === "meal_card";
      const volume = round2(row?.volume ?? 0);
      const attempts = (row?.succeeded ?? 0) + (row?.failed ?? 0);
      return {
        method,
        label: PAYMENT_METHODS[method].name,
        orders: row?.orders ?? 0,
        volume,
        gatewayFee: throughGateway ? round2(volume * GATEWAY_RATE + (row?.succeeded ?? 0) * GATEWAY_FIXED) : 0,
        successRate: attempts ? Math.round(((row?.succeeded ?? 0) / attempts) * 1000) / 10 : 100,
        refunded: round2(row?.refunded ?? 0),
        settlement: onDelivery ? "Kurye tahsilatı" : method === "meal_card" ? "T+7" : method === "wallet" ? "Anında" : "T+1",
      } satisfies GatewayRow;
    })
    .filter((row) => row.orders > 0 || row.method === "online_card");

  const gatewayCost = round2(gateway.reduce((s, r) => s + r.gatewayFee, 0));

  const commission = round2(totals.commission);
  const serviceFees = round2(totals.serviceFees);
  const deliveryFees = round2(totals.deliveryFees);
  const discounts = round2(totals.discounts);
  const courierCost = round2(totals.courierCost);
  const refunds = round2(totals.refunds);
  const netRevenue = round2(commission + serviceFees + deliveryFees - courierCost - discounts - gatewayCost - refunds);

  /* Son 14 gün (İstanbul takvimiyle) */
  const daily = await sql<
    { key: string; orders: number; gmv: number; commission: number; service: number; delivery: number; discount: number; refunds: number; courier: number }[]
  >`
    select to_char(coalesce(o.delivered_at, o.created_at) at time zone 'Europe/Istanbul', 'YYYY-MM-DD') as key,
           count(*)::int as orders,
           sum(o.grand_total) as gmv,
           sum(round(o.subtotal * o.commission_rate, 2)) as commission,
           sum(o.service_fee) as service,
           sum(case when o.courier_mode = 'platform' then o.delivery_fee else 0 end) as delivery,
           sum(o.discount) as discount,
           sum(o.refunded_total) as refunds,
           coalesce(sum(e.fee), 0) as courier
      from public.orders o
      left join public.courier_earnings e on e.order_id = o.id
     where o.status = 'delivered' and coalesce(o.delivered_at, o.created_at) >= now() - interval '15 days'
     group by 1
  `;
  const dailyByKey = new Map(daily.map((d) => [d.key, d]));
  const buckets: AdminFinance["buckets"] = [];
  for (let i = 13; i >= 0; i--) {
    const key = dayKey(new Date(Date.now() - i * 86_400_000));
    const d = dailyByKey.get(key);
    buckets.push({
      key,
      label: formatDayKey(key),
      orders: d?.orders ?? 0,
      gmv: round2(d?.gmv ?? 0),
      netRevenue: d
        ? round2(d.commission + d.service + d.delivery - d.courier - d.discount - d.refunds)
        : 0,
    });
  }

  const payouts = await listPayouts();
  const total = (status: Payout["status"]) =>
    round2(payouts.filter((p) => p.status === status).reduce((s, p) => s + p.net, 0));

  return {
    summary: {
      gmv: round2(totals.gmv),
      productValue: round2(totals.productValue),
      commission,
      serviceFees,
      deliveryFees,
      discounts,
      courierCost,
      gatewayCost,
      refunds,
      netRevenue,
      orders: totals.orders,
      cancelled: totals.cancelled,
      avgOrderValue: totals.orders ? round2(totals.gmv / totals.orders) : 0,
    },
    buckets,
    gateway,
    payouts,
    payoutTotals: { pending: total("pending"), approved: total("approved"), paid: total("paid") },
  };
}

export { SERVICE_FEE };
