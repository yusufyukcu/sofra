import { PAYMENT_METHODS, SERVICE_FEE } from "../constants";
import { progressOf, remainingMinutes, syncOrder } from "../db/simulator";
import {
  allAdmins,
  commit,
  db,
  findCourier,
  findRestaurant,
  findUserById,
  recordAudit,
} from "../db/store";
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
import { createId, round2 } from "../utils";
import { syncOffers } from "./courier";
import { pendingMediaCount } from "./media";
import {
  applicationForRestaurant,
  syncApplicationDecision,
} from "./partner";
import { syncPayouts } from "./payouts";

export { syncPayouts };

/**
 * Yönetici paneli (Superadmin) iş mantığı.
 *
 * Dört sorumluluk:
 *   1. Kullanıcı, restoran ve kurye yönetimi (onay, aktivasyon, kara liste)
 *   2. Canlı operasyon (aktif siparişler, gecikme alarmı, manuel iptal/iade)
 *   3. Pazarlama (kampanya kodları, vitrin afişleri, push bildirimi)
 *   4. Finansal mutabakat (GMV, net gelir, ödeme geçidi, hakediş onayı)
 *
 * Tüm manuel işlemler `recordAudit` ile iz kaydına yazılır.
 */

/* ================================================================== */
/* Giriş                                                              */
/* ================================================================== */

export function adminLogin(pin: string): AdminAccount {
  const admin = allAdmins()[0];
  if (!admin) {
    throw new DomainError("admin_not_found", "Yönetici hesabı yok.", 500);
  }
  if (admin.pin !== pin.trim()) {
    throw new DomainError("invalid_pin", "PIN hatalı. Tekrar dene.", 401);
  }
  return admin;
}

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
}

function syncAll(now = Date.now()): Order[] {
  syncOffers(now);
  const orders = db().orders;
  orders.forEach((o) => syncOrder(o, now));
  return orders;
}

export function liveOrders(now = Date.now()): LiveOrder[] {
  return syncAll(now)
    .filter((o) => o.status !== "delivered" && o.status !== "cancelled")
    .map((order) => {
      const lateMinutes = Math.round(
        (now - new Date(order.etaAt).getTime()) / 60_000
      );
      return {
        order,
        progress: progressOf(order, now),
        remainingMinutes: remainingMinutes(order, now),
        lateMinutes,
        severity:
          lateMinutes >= CRITICAL_THRESHOLD_MINUTES
            ? "critical"
            : lateMinutes >= LATE_THRESHOLD_MINUTES
              ? "late"
              : "ontime",
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

export function adminOverview(now = Date.now()): AdminOverview {
  const store = db();
  const live = liveOrders(now);

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const today = store.orders.filter(
    (o) =>
      new Date(o.createdAt).getTime() >= startOfDay.getTime() &&
      o.status !== "cancelled"
  );

  const busyIds = new Set(
    live.filter((l) => l.order.courier).map((l) => l.order.courier!.id)
  );

  return {
    kpi: {
      activeOrders: live.length,
      lateOrders: live.filter((l) => l.severity !== "ontime").length,
      todayOrders: today.length,
      todayGmv: round2(
        today.reduce((sum, o) => sum + o.totals.grandTotal, 0)
      ),
      onlineCouriers: store.couriers.filter((c) => c.online).length,
      openRestaurants: store.restaurants.filter(
        (r) => r.approvalStatus === "approved" && !r.temporarilyClosed
      ).length,
      pendingRestaurants: store.restaurants.filter(
        (r) => r.approvalStatus === "pending"
      ).length,
      pendingCouriers: store.couriers.filter((c) => c.status === "pending")
        .length,
      pendingPayouts: syncPayouts().filter((p) => p.status === "pending").length,
      pendingMedia: pendingMediaCount(),
      blockedUsers: store.users.filter((u) => u.blocked).length,
    },
    live,
    couriers: store.couriers
      .filter((c) => c.online)
      .map((c) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        point: c.point,
        busy: busyIds.has(c.id),
      })),
  };
}

/** Yöneticinin manuel sipariş iptali — tutar müşterinin cüzdanına iade edilir. */
export function adminCancelOrder(
  admin: AdminAccount,
  orderId: string,
  reason: string
): Order {
  const order = db().orders.find((o) => o.id === orderId);
  if (!order) {
    throw new DomainError("order_not_found", "Sipariş bulunamadı.", 404);
  }
  if (order.status === "delivered" || order.status === "cancelled") {
    throw new DomainError("order_closed", "Bu sipariş zaten kapanmış.");
  }

  const now = new Date().toISOString();
  order.status = "cancelled";
  order.cancelledAt = now;
  order.cancelledBy = "support";
  order.cancelReason = reason.trim() || "Platform tarafından iptal edildi";
  order.timeline.push({
    status: "cancelled",
    at: now,
    note: `Platform iptali: ${order.cancelReason}`,
  });

  if (!PAYMENT_METHODS[order.paymentMethod].onDelivery) {
    const user = findUserById(order.userId);
    if (user) {
      user.walletBalance = round2(user.walletBalance + order.totals.grandTotal);
    }
  }

  commit();
  recordAudit(
    admin.name,
    "Sipariş iptali",
    order.code,
    `${order.cancelReason} · ${order.totals.grandTotal} ₺ iade`
  );
  return order;
}

/** Teslim edilmiş bir siparişe manuel iade (kısmi veya tam). */
export function adminRefund(
  admin: AdminAccount,
  orderId: string,
  amount: number,
  reason: string
): { order: Order; refunded: number; balance: number } {
  const order = db().orders.find((o) => o.id === orderId);
  if (!order) {
    throw new DomainError("order_not_found", "Sipariş bulunamadı.", 404);
  }
  const value = round2(Number(amount));
  if (!Number.isFinite(value) || value <= 0) {
    throw new DomainError("invalid_amount", "Geçerli bir iade tutarı gir.");
  }
  if (value > order.totals.grandTotal) {
    throw new DomainError(
      "amount_too_large",
      "İade tutarı sipariş tutarını aşamaz."
    );
  }

  const user = findUserById(order.userId);
  if (!user) {
    throw new DomainError("user_not_found", "Müşteri bulunamadı.", 404);
  }
  user.walletBalance = round2(user.walletBalance + value);

  order.timeline.push({
    status: order.status,
    at: new Date().toISOString(),
    note: `Platform iadesi: ${value} ₺ · ${reason || "gerekçe belirtilmedi"}`,
  });

  commit();
  recordAudit(admin.name, "Manuel iade", order.code, `${value} ₺ · ${reason}`);
  return { order, refunded: value, balance: user.walletBalance };
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

export function adminRestaurants(): AdminRestaurantRow[] {
  const orders = db().orders;

  return db()
    .restaurants.map((restaurant) => {
      const mine = orders.filter(
        (o) => o.restaurantId === restaurant.id && o.status === "delivered"
      );
      const gross = round2(mine.reduce((s, o) => s + o.totals.subtotal, 0));
      return {
        restaurant,
        orders: mine.length,
        gmv: round2(mine.reduce((s, o) => s + o.totals.grandTotal, 0)),
        commissionEarned: round2(gross * restaurant.commissionRate),
        rating: restaurant.rating,
        open: restaurant.approvalStatus === "approved" && !restaurant.temporarilyClosed,
        // Başvuruyla gelenlerde form bilgisi; tohumdan gelenlerde yok.
        application: applicationForRestaurant(restaurant.id),
      };
    })
    .sort((a, b) => {
      // Onay bekleyenler listenin başında dursun
      const rank = (r: Restaurant) =>
        r.approvalStatus === "pending" ? 0 : r.approvalStatus === "suspended" ? 1 : 2;
      return rank(a.restaurant) - rank(b.restaurant) || b.gmv - a.gmv;
    });
}

export function setRestaurantApproval(
  admin: AdminAccount,
  restaurantId: string,
  status: Restaurant["approvalStatus"],
  reason?: string
): Restaurant {
  const restaurant = findRestaurant(restaurantId);
  if (!restaurant) {
    throw new DomainError("restaurant_not_found", "Restoran bulunamadı.", 404);
  }
  restaurant.approvalStatus = status;
  if (status === "suspended") restaurant.temporarilyClosed = true;

  // Başvuruyla gelen restoranlarda form kaydı da güncellenir ve
  // onaylanan işletmeye panel girişi açılır.
  syncApplicationDecision(restaurantId, status, reason);
  commit();

  const labels = {
    approved: "Restoran onaylandı",
    suspended: "Restoran askıya alındı",
    pending: "Restoran onay beklemeye alındı",
  } as const;
  recordAudit(admin.name, labels[status], restaurant.name, reason);
  return restaurant;
}

export function setCommissionRate(
  admin: AdminAccount,
  restaurantId: string,
  rate: number
): Restaurant {
  const restaurant = findRestaurant(restaurantId);
  if (!restaurant) {
    throw new DomainError("restaurant_not_found", "Restoran bulunamadı.", 404);
  }
  const value = Number(rate);
  if (!Number.isFinite(value) || value < 0 || value > 0.4) {
    throw new DomainError(
      "invalid_rate",
      "Komisyon oranı %0 ile %40 arasında olmalı."
    );
  }
  const previous = restaurant.commissionRate;
  restaurant.commissionRate = Math.round(value * 1000) / 1000;
  commit();

  recordAudit(
    admin.name,
    "Komisyon oranı değişti",
    restaurant.name,
    `%${Math.round(previous * 100)} → %${Math.round(restaurant.commissionRate * 100)}`
  );
  return restaurant;
}

/* ================================================================== */
/* Kurye yönetimi                                                     */
/* ================================================================== */

export interface AdminCourierRow {
  courier: Omit<Courier, "pin">;
  deliveries: number;
  earnings: number;
  busy: boolean;
}

export function adminCouriers(): AdminCourierRow[] {
  const earnings = db().earnings;
  const activeIds = new Set(
    db()
      .orders.filter(
        (o) =>
          o.courier &&
          o.courierStage &&
          ["assigned", "at_restaurant", "picked_up"].includes(o.courierStage)
      )
      .map((o) => o.courier!.id)
  );

  return db()
    .couriers.map((courier) => {
      const { pin: _pin, ...rest } = courier;
      const mine = earnings.filter((e) => e.courierId === courier.id);
      return {
        courier: rest,
        deliveries: mine.length,
        earnings: round2(mine.reduce((s, e) => s + e.fee + e.tip, 0)),
        busy: activeIds.has(courier.id),
      };
    })
    .sort((a, b) => {
      const rank = (c: Omit<Courier, "pin">) =>
        c.status === "pending" ? 0 : c.status === "suspended" ? 1 : 2;
      return rank(a.courier) - rank(b.courier) || b.deliveries - a.deliveries;
    });
}

export function setCourierStatus(
  admin: AdminAccount,
  courierId: string,
  status: Courier["status"],
  reason?: string
): Courier {
  const courier = findCourier(courierId);
  if (!courier) {
    throw new DomainError("courier_not_found", "Kurye bulunamadı.", 404);
  }
  if (status !== "active" && courier.online) {
    // Askıya alınan kurye derhal mesaiden düşer
    courier.online = false;
    courier.shiftStartedAt = undefined;
  }
  courier.status = status;
  commit();

  const labels = {
    active: "Kurye aktifleştirildi",
    suspended: "Kurye askıya alındı",
    pending: "Kurye onay beklemeye alındı",
  } as const;
  recordAudit(admin.name, labels[status], courier.name, reason);
  return courier;
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

export function adminUsers(query = ""): AdminUserRow[] {
  const orders = db().orders;
  const q = query.trim().toLocaleLowerCase("tr");

  return db()
    .users.filter((user) => {
      if (!q) return true;
      return (
        user.name.toLocaleLowerCase("tr").includes(q) ||
        (user.email ?? "").toLocaleLowerCase("tr").includes(q) ||
        (user.phone ?? "").includes(q)
      );
    })
    .map((user) => {
      const mine = orders.filter(
        (o) => o.userId === user.id && o.status === "delivered"
      );
      return {
        user,
        orders: mine.length,
        spent: round2(mine.reduce((s, o) => s + o.totals.grandTotal, 0)),
        lastOrderAt: mine[0]?.createdAt,
      };
    })
    .sort((a, b) => {
      if (Boolean(a.user.blocked) !== Boolean(b.user.blocked)) {
        return a.user.blocked ? -1 : 1;
      }
      return b.spent - a.spent;
    });
}

export function setUserBlocked(
  admin: AdminAccount,
  userId: string,
  blocked: boolean,
  reason?: string
): User {
  const user = findUserById(userId);
  if (!user) {
    throw new DomainError("user_not_found", "Kullanıcı bulunamadı.", 404);
  }
  user.blocked = blocked;
  user.blockReason = blocked ? reason?.trim() || "Platform kuralları ihlali" : undefined;
  user.blockedAt = blocked ? new Date().toISOString() : undefined;
  commit();

  recordAudit(
    admin.name,
    blocked ? "Kullanıcı kara listeye alındı" : "Kara listeden çıkarıldı",
    user.name,
    user.blockReason
  );
  return user;
}

/** Manuel bakiye yükleme (jest, tazminat, düzeltme). */
export function creditWallet(
  admin: AdminAccount,
  userId: string,
  amount: number,
  reason: string
): User {
  const user = findUserById(userId);
  if (!user) {
    throw new DomainError("user_not_found", "Kullanıcı bulunamadı.", 404);
  }
  const value = round2(Number(amount));
  if (!Number.isFinite(value) || value === 0 || Math.abs(value) > 10000) {
    throw new DomainError(
      "invalid_amount",
      "Tutar sıfırdan farklı ve en fazla 10.000 ₺ olmalı."
    );
  }
  if (user.walletBalance + value < 0) {
    throw new DomainError(
      "negative_balance",
      "Bakiye eksiye düşemez."
    );
  }

  user.walletBalance = round2(user.walletBalance + value);
  commit();

  recordAudit(
    admin.name,
    value > 0 ? "Manuel bakiye yükleme" : "Manuel bakiye düşümü",
    user.name,
    `${value > 0 ? "+" : ""}${value} ₺ · ${reason || "gerekçe yok"}`
  );
  return user;
}

/* ================================================================== */
/* Pazarlama                                                          */
/* ================================================================== */

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

export function upsertCoupon(
  admin: AdminAccount,
  input: CouponInput,
  originalCode?: string
): Coupon {
  const code = (input.code ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(code)) {
    throw new DomainError(
      "invalid_code",
      "Kod 3-20 karakter, yalnızca harf ve rakam olmalı."
    );
  }
  if ((input.title ?? "").trim().length < 3) {
    throw new DomainError("invalid_title", "Başlık en az 3 karakter olmalı.");
  }
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < 0) {
    throw new DomainError("invalid_value", "Geçerli bir indirim değeri gir.");
  }
  if (input.type === "percent" && value > 100) {
    throw new DomainError("invalid_value", "Yüzde indirimi 100'ü aşamaz.");
  }
  if (!input.expiresAt || Number.isNaN(Date.parse(input.expiresAt))) {
    throw new DomainError("invalid_date", "Geçerli bir bitiş tarihi seç.");
  }

  const store = db();
  const existing = store.coupons.find(
    (c) => c.code.toUpperCase() === (originalCode ?? code).toUpperCase()
  );

  if (!existing && store.coupons.some((c) => c.code.toUpperCase() === code)) {
    throw new DomainError("code_taken", "Bu kod zaten kullanımda.");
  }

  const payload: Coupon = {
    code,
    title: input.title.trim(),
    description: (input.description ?? "").trim(),
    type: input.type,
    value: round2(value),
    minSubtotal: round2(Number(input.minSubtotal) || 0),
    maxDiscount:
      input.maxDiscount === null || input.maxDiscount === undefined
        ? undefined
        : round2(Number(input.maxDiscount)),
    restaurantIds:
      input.restaurantIds && input.restaurantIds.length
        ? input.restaurantIds
        : null,
    firstOrderOnly: Boolean(input.firstOrderOnly),
    expiresAt: new Date(input.expiresAt).toISOString(),
    active: input.active !== false,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };

  if (existing) {
    Object.assign(existing, payload);
  } else {
    store.coupons.push(payload);
  }
  commit();

  recordAudit(
    admin.name,
    existing ? "Kampanya güncellendi" : "Kampanya oluşturuldu",
    code,
    payload.title
  );
  return payload;
}

export function deleteCoupon(admin: AdminAccount, code: string): Coupon[] {
  const store = db();
  const target = store.coupons.find(
    (c) => c.code.toUpperCase() === code.trim().toUpperCase()
  );
  if (!target) {
    throw new DomainError("coupon_not_found", "Kampanya bulunamadı.", 404);
  }
  store.coupons = store.coupons.filter((c) => c !== target);
  commit();
  recordAudit(admin.name, "Kampanya silindi", target.code, target.title);
  return store.coupons;
}

export function toggleCoupon(admin: AdminAccount, code: string): Coupon {
  const coupon = db().coupons.find(
    (c) => c.code.toUpperCase() === code.trim().toUpperCase()
  );
  if (!coupon) {
    throw new DomainError("coupon_not_found", "Kampanya bulunamadı.", 404);
  }
  coupon.active = !coupon.active;
  commit();
  recordAudit(
    admin.name,
    coupon.active ? "Kampanya yayına alındı" : "Kampanya yayından kaldırıldı",
    coupon.code
  );
  return coupon;
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

export function upsertBanner(admin: AdminAccount, input: BannerInput): Banner {
  if ((input.title ?? "").trim().length < 3) {
    throw new DomainError("invalid_title", "Başlık en az 3 karakter olmalı.");
  }
  const href = (input.href ?? "/").trim();
  if (!href.startsWith("/")) {
    throw new DomainError(
      "invalid_href",
      "Bağlantı site içi bir yol olmalı (ör. /?kategori=burger)."
    );
  }

  const store = db();
  const existing = input.id
    ? store.banners.find((b) => b.id === input.id)
    : undefined;

  const payload: Banner = {
    id: existing?.id ?? createId("bn"),
    title: input.title.trim(),
    subtitle: (input.subtitle ?? "").trim(),
    code: input.code?.trim().toUpperCase() || undefined,
    emoji: input.emoji?.trim() || "🎉",
    gradient: input.gradient,
    href,
    active: input.active !== false,
  };

  if (existing) Object.assign(existing, payload);
  else store.banners.push(payload);
  commit();

  recordAudit(
    admin.name,
    existing ? "Afiş güncellendi" : "Afiş eklendi",
    payload.title
  );
  return payload;
}

export function deleteBanner(admin: AdminAccount, id: string): Banner[] {
  const store = db();
  const target = store.banners.find((b) => b.id === id);
  if (!target) {
    throw new DomainError("banner_not_found", "Afiş bulunamadı.", 404);
  }
  store.banners = store.banners.filter((b) => b.id !== id);
  commit();
  recordAudit(admin.name, "Afiş silindi", target.title);
  return store.banners;
}

export function moveBanner(
  admin: AdminAccount,
  id: string,
  direction: "up" | "down"
): Banner[] {
  const store = db();
  const index = store.banners.findIndex((b) => b.id === id);
  if (index < 0) {
    throw new DomainError("banner_not_found", "Afiş bulunamadı.", 404);
  }
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= store.banners.length) return store.banners;

  const [moved] = store.banners.splice(index, 1);
  store.banners.splice(target, 0, moved);
  commit();
  return store.banners;
}

export interface PushInput {
  title: string;
  body: string;
  segment: PushCampaign["segment"];
  districts?: string[];
}

const SEGMENT_LABEL: Record<PushCampaign["segment"], string> = {
  all: "Tüm kullanıcılar",
  active: "Son 30 günde sipariş verenler",
  lapsed: "30 gündür sipariş vermeyenler",
  new: "Henüz sipariş vermemiş olanlar",
};

/** Segment ve bölgeye göre hedef kitleyi hesaplar. */
export function pushAudience(
  segment: PushCampaign["segment"],
  districts: string[] = []
): User[] {
  const store = db();
  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  return store.users.filter((user) => {
    if (user.blocked) return false;

    const orders = store.orders.filter((o) => o.userId === user.id);
    const recent = orders.some(
      (o) => new Date(o.createdAt).getTime() >= monthAgo
    );

    if (segment === "active" && !recent) return false;
    if (segment === "lapsed" && (recent || orders.length === 0)) return false;
    if (segment === "new" && orders.length > 0) return false;

    if (districts.length) {
      const addresses = store.addresses.filter((a) => a.userId === user.id);
      if (!addresses.some((a) => districts.includes(a.district))) return false;
    }
    return true;
  });
}

export function sendPush(admin: AdminAccount, input: PushInput): PushCampaign {
  if ((input.title ?? "").trim().length < 3) {
    throw new DomainError("invalid_title", "Başlık en az 3 karakter olmalı.");
  }
  if ((input.body ?? "").trim().length < 5) {
    throw new DomainError("invalid_body", "Mesaj en az 5 karakter olmalı.");
  }

  const districts = (input.districts ?? []).filter(Boolean);
  const audience = pushAudience(input.segment, districts);

  const campaign: PushCampaign = {
    id: createId("psh"),
    title: input.title.trim(),
    body: input.body.trim().slice(0, 240),
    segment: input.segment,
    districts,
    recipientCount: audience.length,
    sentAt: new Date().toISOString(),
  };

  db().pushCampaigns.unshift(campaign);
  commit();

  recordAudit(
    admin.name,
    "Push bildirimi gönderildi",
    campaign.title,
    `${SEGMENT_LABEL[campaign.segment]} · ${campaign.recipientCount} kişi`
  );
  return campaign;
}

/** Müşteri adreslerinden türeyen bölge listesi. */
export function knownDistricts(): string[] {
  return [...new Set(db().addresses.map((a) => a.district))].sort();
}

/* ================================================================== */
/* Finansal mutabakat                                                 */
/* ================================================================== */

export function setPayoutStatus(
  admin: AdminAccount,
  payoutId: string,
  action: "approve" | "pay"
): Payout {
  const payout = db().payouts.find((p) => p.id === payoutId);
  if (!payout) {
    throw new DomainError("payout_not_found", "Hakediş kaydı bulunamadı.", 404);
  }

  if (action === "approve") {
    if (payout.status !== "pending") {
      throw new DomainError("already_approved", "Bu hakediş zaten onaylanmış.");
    }
    payout.status = "approved";
    payout.approvedAt = new Date().toISOString();
  } else {
    if (payout.status !== "approved") {
      throw new DomainError(
        "not_approved",
        "Ödeme için önce hakedişi onaylaman gerekiyor."
      );
    }
    payout.status = "paid";
    payout.paidAt = new Date().toISOString();
  }

  commit();
  recordAudit(
    admin.name,
    action === "approve" ? "Hakediş onaylandı" : "Hakediş ödendi",
    `${payout.targetName} · ${payout.periodLabel}`,
    `${payout.net} ₺`
  );
  return payout;
}

export interface GatewayRow {
  method: PaymentMethodId;
  label: string;
  orders: number;
  volume: number;
  /** Ödeme geçidinin kestiği komisyon (kapıda ödemede yok) */
  gatewayFee: number;
  /** Simüle edilen başarı oranı */
  successRate: number;
  settlement: "T+1" | "T+7" | "Kurye tahsilatı";
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
  netRevenue: number;
  orders: number;
  cancelled: number;
  avgOrderValue: number;
}

export interface AdminFinance {
  summary: FinanceSummary;
  /** Son 14 günün GMV ve net gelir kırılımı */
  buckets: {
    key: string;
    label: string;
    orders: number;
    gmv: number;
    netRevenue: number;
  }[];
  gateway: GatewayRow[];
  payouts: Payout[];
  payoutTotals: { pending: number; approved: number; paid: number };
}

export function adminFinance(): AdminFinance {
  const store = db();
  const delivered = store.orders.filter((o) => o.status === "delivered");
  const cancelled = store.orders.filter((o) => o.status === "cancelled");

  const commission = round2(
    delivered.reduce((sum, order) => {
      const restaurant = findRestaurant(order.restaurantId);
      const rate = restaurant?.commissionRate ?? 0.12;
      return sum + order.totals.subtotal * rate;
    }, 0)
  );

  const gmv = round2(delivered.reduce((s, o) => s + o.totals.grandTotal, 0));
  const productValue = round2(
    delivered.reduce((s, o) => s + o.totals.subtotal, 0)
  );
  const serviceFees = round2(
    delivered.reduce((s, o) => s + o.totals.serviceFee, 0)
  );
  const deliveryFees = round2(
    delivered.reduce((s, o) => s + o.totals.deliveryFee, 0)
  );
  const discounts = round2(delivered.reduce((s, o) => s + o.totals.discount, 0));
  const courierCost = round2(
    store.earnings
      .filter((e) => delivered.some((o) => o.id === e.orderId))
      .reduce((s, e) => s + e.fee, 0)
  );

  /* Ödeme geçidi kırılımı */
  const gateway: GatewayRow[] = (
    Object.keys(PAYMENT_METHODS) as PaymentMethodId[]
  )
    .map((method) => {
      const mine = delivered.filter((o) => o.paymentMethod === method);
      const volume = round2(mine.reduce((s, o) => s + o.totals.grandTotal, 0));
      const onDelivery = PAYMENT_METHODS[method].onDelivery;
      const isWallet = method === "wallet";

      return {
        method,
        label: PAYMENT_METHODS[method].name,
        orders: mine.length,
        volume,
        gatewayFee:
          onDelivery || isWallet
            ? 0
            : round2(volume * GATEWAY_RATE + mine.length * GATEWAY_FIXED),
        successRate: mine.length ? 100 : 100,
        settlement: onDelivery
          ? "Kurye tahsilatı"
          : method === "meal_card"
            ? "T+7"
            : "T+1",
      } satisfies GatewayRow;
    })
    .filter((row) => row.orders > 0 || row.method === "online_card");

  const gatewayCost = round2(gateway.reduce((s, r) => s + r.gatewayFee, 0));

  const netRevenue = round2(
    commission + serviceFees + deliveryFees - courierCost - discounts - gatewayCost
  );

  /* Son 14 gün */
  const buckets: AdminFinance["buckets"] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    const mine = delivered.filter(
      (o) => o.createdAt.slice(0, 10) === key
    );
    const dayGmv = round2(mine.reduce((s, o) => s + o.totals.grandTotal, 0));
    const dayCommission = round2(
      mine.reduce((sum, order) => {
        const restaurant = findRestaurant(order.restaurantId);
        return sum + order.totals.subtotal * (restaurant?.commissionRate ?? 0.12);
      }, 0)
    );
    const dayService = round2(mine.reduce((s, o) => s + o.totals.serviceFee, 0));
    const dayDelivery = round2(
      mine.reduce((s, o) => s + o.totals.deliveryFee, 0)
    );
    const dayDiscount = round2(mine.reduce((s, o) => s + o.totals.discount, 0));
    const dayCourier = round2(
      store.earnings
        .filter((e) => mine.some((o) => o.id === e.orderId))
        .reduce((s, e) => s + e.fee, 0)
    );

    buckets.push({
      key,
      label: new Intl.DateTimeFormat("tr-TR", {
        day: "numeric",
        month: "short",
      }).format(date),
      orders: mine.length,
      gmv: dayGmv,
      netRevenue: round2(
        dayCommission + dayService + dayDelivery - dayCourier - dayDiscount
      ),
    });
  }

  const payouts = syncPayouts();
  const total = (status: Payout["status"]) =>
    round2(
      payouts.filter((p) => p.status === status).reduce((s, p) => s + p.net, 0)
    );

  return {
    summary: {
      gmv,
      productValue,
      commission,
      serviceFees,
      deliveryFees,
      discounts,
      courierCost,
      gatewayCost,
      netRevenue,
      orders: delivered.length,
      cancelled: cancelled.length,
      avgOrderValue: delivered.length ? round2(gmv / delivered.length) : 0,
    },
    buckets,
    gateway,
    payouts,
    payoutTotals: {
      pending: total("pending"),
      approved: total("approved"),
      paid: total("paid"),
    },
  };
}

export { SERVICE_FEE };
