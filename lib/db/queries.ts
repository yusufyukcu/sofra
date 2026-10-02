import "server-only";
import type {
  Address,
  AdminAccount,
  Banner,
  Coupon,
  Courier,
  MenuCategory,
  Order,
  OrderStatus,
  Restaurant,
  Review,
  SavedCard,
  User,
  VendorAccount,
} from "../types";
import type { RestaurantBase } from "../discovery";
import { sql, type Db } from "./client";
import * as m from "./mappers";

/**
 * Servislerin ortak okuma sorguları. Her fonksiyon isteğe bağlı bir `db`
 * alır: bir işlemin (transaction) içinden çağrıldığında aynı bağlantıyı
 * kullanır, böylece işlem kendi yazdığını okur.
 */

/* ------------------------------------------------------------------ */
/* Restoran ve menü                                                    */
/* ------------------------------------------------------------------ */

export async function findRestaurantRow(
  idOrSlug: string,
  db: Db = sql
): Promise<m.RestaurantRow | null> {
  if (!idOrSlug) return null;
  const [row] = await db<m.RestaurantRow[]>`
    select * from public.restaurants where id = ${idOrSlug} or slug = ${idOrSlug} limit 1
  `;
  return row ?? null;
}

export async function loadMenu(restaurantId: string, db: Db = sql): Promise<MenuCategory[]> {
  const categories = await db<m.CategoryRow[]>`
    select * from public.menu_categories where restaurant_id = ${restaurantId}
  `;
  const products = await db<m.ProductRow[]>`
    select * from public.products where restaurant_id = ${restaurantId}
  `;
  return m.buildMenu(categories, products);
}

/** Menüsüyle birlikte restoran (kimlik ya da slug ile). */
export async function findRestaurant(idOrSlug: string, db: Db = sql): Promise<Restaurant | null> {
  const row = await findRestaurantRow(idOrSlug, db);
  if (!row) return null;
  return m.toRestaurant(row, await loadMenu(row.id, db));
}

/** Müşteri uygulamasının gördüğü katalog: yalnızca onaylı restoranlar. */
export async function publishedRestaurantBases(db: Db = sql): Promise<RestaurantBase[]> {
  const rows = await db<m.RestaurantRow[]>`
    select * from public.restaurants where approval_status = 'approved' order by name
  `;
  return rows.map(m.toRestaurantBase);
}

export async function publishedRestaurantCount(db: Db = sql): Promise<number> {
  const [row] = await db<{ n: number }[]>`
    select count(*)::int as n from public.restaurants where approval_status = 'approved'
  `;
  return row.n;
}

export async function allRestaurantRows(db: Db = sql): Promise<m.RestaurantRow[]> {
  return db<m.RestaurantRow[]>`select * from public.restaurants order by name`;
}

/**
 * Müşteriye gösterilen menü: restoran "tükeneni gizle" dediyse tükenen
 * ürünler ve boşalan kategoriler listeden çıkar.
 */
export function customerMenu(restaurant: Restaurant): Restaurant {
  if (restaurant.soldOutDisplay !== "hide") return restaurant;
  const menu = restaurant.menu
    .map((category) => ({
      ...category,
      products: category.products.filter((p) => !p.soldOut),
    }))
    .filter((category) => category.products.length > 0);
  return { ...restaurant, menu };
}

/* ------------------------------------------------------------------ */
/* Müşteri                                                             */
/* ------------------------------------------------------------------ */

export async function favoriteIds(userId: string, db: Db = sql): Promise<string[]> {
  const rows = await db<{ restaurantId: string }[]>`
    select restaurant_id from public.favorites where user_id = ${userId} order by created_at
  `;
  return rows.map((r) => r.restaurantId);
}

async function userFromRow(row: m.ProfileRow | undefined, db: Db): Promise<User | null> {
  if (!row) return null;
  return m.toUser(row, await favoriteIds(row.id, db));
}

export async function findUser(id: string, db: Db = sql): Promise<User | null> {
  const [row] = await db<m.ProfileRow[]>`select * from public.profiles where id = ${id}`;
  return userFromRow(row, db);
}

export async function findUserByPhone(phone: string, db: Db = sql): Promise<User | null> {
  const normalized = phone.replace(/\D/g, "").slice(-10);
  if (!normalized) return null;
  const [row] = await db<m.ProfileRow[]>`select * from public.profiles where phone = ${normalized}`;
  return userFromRow(row, db);
}

export async function findUserByEmail(email: string, db: Db = sql): Promise<User | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const [row] = await db<m.ProfileRow[]>`select * from public.profiles where email = ${normalized}`;
  return userFromRow(row, db);
}

export async function findProfileRow(id: string, db: Db = sql): Promise<m.ProfileRow | null> {
  const [row] = await db<m.ProfileRow[]>`select * from public.profiles where id = ${id}`;
  return row ?? null;
}

export async function listAddresses(userId: string, db: Db = sql): Promise<Address[]> {
  const rows = await db<m.AddressRow[]>`
    select * from public.addresses where user_id = ${userId}
    order by is_default desc, created_at
  `;
  return rows.map(m.toAddress);
}

export async function findAddress(
  userId: string,
  addressId: string,
  db: Db = sql
): Promise<Address | null> {
  const [row] = await db<m.AddressRow[]>`
    select * from public.addresses where id = ${addressId} and user_id = ${userId}
  `;
  return row ? m.toAddress(row) : null;
}

export async function cardsOf(userId: string, db: Db = sql): Promise<SavedCard[]> {
  const rows = await db<m.CardRow[]>`
    select * from public.saved_cards where user_id = ${userId} order by created_at
  `;
  return rows.map(m.toCard);
}

/* ------------------------------------------------------------------ */
/* Kurye, işletme, yönetici                                            */
/* ------------------------------------------------------------------ */

export async function findCourierRow(id: string, db: Db = sql): Promise<m.CourierRow | null> {
  const [row] = await db<m.CourierRow[]>`select * from public.couriers where id = ${id}`;
  return row ?? null;
}

export async function findCourier(id: string, db: Db = sql): Promise<Courier | null> {
  const row = await findCourierRow(id, db);
  return row ? m.toCourier(row) : null;
}

export async function findVendorMember(id: string, db: Db = sql): Promise<VendorAccount | null> {
  const [row] = await db<m.VendorMemberRow[]>`select * from public.vendor_members where id = ${id}`;
  return row ? m.toVendorAccount(row) : null;
}

export async function findAdmin(id: string, db: Db = sql): Promise<AdminAccount | null> {
  const [row] = await db<m.AdminRow[]>`select * from public.admins where id = ${id}`;
  return row ? m.toAdmin(row) : null;
}

/* ------------------------------------------------------------------ */
/* Sipariş                                                             */
/* ------------------------------------------------------------------ */

/** Satırları zaman çizelgeleriyle birlikte siparişe çevirir (tek sorguda). */
export async function hydrateOrders(rows: m.OrderRow[], db: Db = sql): Promise<Order[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const events = await db<m.OrderEventRow[]>`
    select order_id, status, note, at from public.order_events
    where order_id = any(${ids}::text[]) order by at, id
  `;
  const byOrder = new Map<string, m.OrderEventRow[]>();
  for (const event of events) {
    const list = byOrder.get(event.orderId) ?? [];
    list.push(event);
    byOrder.set(event.orderId, list);
  }
  return rows.map((row) => m.toOrder(row, byOrder.get(row.id) ?? []));
}

export async function findOrderRow(
  id: string,
  db: Db = sql,
  options: { forUpdate?: boolean } = {}
): Promise<m.OrderRow | null> {
  const [row] = options.forUpdate
    ? await db<m.OrderRow[]>`select * from public.orders where id = ${id} for update`
    : await db<m.OrderRow[]>`select * from public.orders where id = ${id}`;
  return row ?? null;
}

export async function findOrder(id: string, db: Db = sql): Promise<Order | null> {
  const row = await findOrderRow(id, db);
  if (!row) return null;
  const [order] = await hydrateOrders([row], db);
  return order;
}

export async function ordersOfUser(userId: string, db: Db = sql, limit = 100): Promise<Order[]> {
  const rows = await db<m.OrderRow[]>`
    select * from public.orders where user_id = ${userId}
    order by created_at desc limit ${limit}
  `;
  return hydrateOrders(rows, db);
}

export async function ordersOfRestaurant(
  restaurantId: string,
  options: { statuses?: OrderStatus[]; since?: Date; limit?: number; offset?: number } = {},
  db: Db = sql
): Promise<Order[]> {
  const statuses = options.statuses ?? null;
  const since = options.since ?? null;
  const rows = await db<m.OrderRow[]>`
    select * from public.orders
     where restaurant_id = ${restaurantId}
       and (${statuses}::text[] is null or status = any(${statuses}::text[]))
       and (${since}::timestamptz is null or created_at >= ${since}::timestamptz)
     order by created_at desc
     limit ${options.limit ?? 200} offset ${options.offset ?? 0}
  `;
  return hydrateOrders(rows, db);
}

/** Bir sipariş zaman çizelgesine olay ekler. */
export async function addOrderEvent(
  db: Db,
  orderId: string,
  status: OrderStatus,
  note: string,
  at: Date = new Date()
): Promise<void> {
  await db`
    insert into public.order_events (order_id, status, note, at)
    values (${orderId}, ${status}, ${note}, ${at})
  `;
}

/* ------------------------------------------------------------------ */
/* Kupon, afiş, yorum                                                  */
/* ------------------------------------------------------------------ */

export async function allCoupons(db: Db = sql): Promise<Coupon[]> {
  const rows = await db<m.CouponRow[]>`select * from public.coupons order by created_at desc`;
  return rows.map(m.toCoupon);
}

export async function findCoupon(code: string, db: Db = sql): Promise<Coupon | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const [row] = await db<m.CouponRow[]>`select * from public.coupons where code = ${normalized}`;
  return row ? m.toCoupon(row) : null;
}

export async function allBanners(db: Db = sql): Promise<Banner[]> {
  const rows = await db<m.BannerRow[]>`select * from public.banners order by position, id`;
  return rows.map(m.toBanner);
}

export async function activeBanners(db: Db = sql): Promise<Banner[]> {
  const rows = await db<m.BannerRow[]>`
    select * from public.banners where active order by position, id
  `;
  return rows.map(m.toBanner);
}

/** Restoran sayfasında gösterilen yorumlar: yalnızca yazılı olanlar. */
export async function reviewsOf(restaurantId: string, limit = 24, db: Db = sql): Promise<Review[]> {
  const rows = await db<m.ReviewRow[]>`
    select * from public.reviews
     where restaurant_id = ${restaurantId} and coalesce(comment, '') <> ''
     order by at desc limit ${limit}
  `;
  return rows.map(m.toReview);
}

/* ------------------------------------------------------------------ */
/* İz kaydı                                                            */
/* ------------------------------------------------------------------ */

export async function recordAudit(
  actor: string,
  action: string,
  target: string,
  detail?: string,
  db: Db = sql
): Promise<void> {
  await db`
    insert into public.audit_log (actor, action, target, detail)
    values (${actor}, ${action}, ${target}, ${detail ?? null})
  `;
}

export async function recentAudit(limit = 12, db: Db = sql) {
  const rows = await db<{ id: number; actor: string; action: string; target: string; detail: string | null; at: Date }[]>`
    select * from public.audit_log order by at desc limit ${limit}
  `;
  return rows.map((r) => ({
    id: String(r.id),
    actor: r.actor,
    action: r.action,
    target: r.target,
    detail: r.detail ?? undefined,
    at: r.at.toISOString(),
  }));
}
