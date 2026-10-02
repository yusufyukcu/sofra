import "server-only";
import { PAYMENT_METHODS } from "../constants";
import { asJson, dispatchNow, sql, type Changes, type Db } from "../db/client";
import {
  addOrderEvent,
  allRestaurantRows,
  findOrderRow,
  findRestaurant,
  findRestaurantRow,
  hydrateOrders,
  loadMenu,
} from "../db/queries";
import { toReview, type OrderRow, type ProductRow, type ReviewRow } from "../db/mappers";
import { appSettings, scaledMs } from "../db/settings";
import { VENDOR_PIN } from "../db/seed";
import { DomainError } from "../errors";
import type {
  LatLng,
  MenuCategory,
  OptionGroup,
  Order,
  OrderStatus,
  PaymentMethodId,
  Restaurant,
  Review,
  VendorAccount,
} from "../types";
import {
  createId,
  dayKey,
  formatDayKey,
  formatMonthKey,
  formatWeekKey,
  monthKey,
  round2,
  weekKey,
} from "../utils";
import { cancelOrderTx } from "./lifecycle";
import { discardPendingMedia } from "./media";
import { payoutsFor } from "./payouts";

/**
 * Restoran paneli (Vendor Dashboard) iş mantığı.
 *
 * Dört sorumluluk: sipariş yönetimi, menü & stok, mağaza ayarları ve
 * finans/değerlendirme. Tüm fonksiyonlar oturumdaki `restaurantId` ile
 * sınırlanır — bir işletme başka bir işletmenin verisine erişemez.
 */

/* ================================================================== */
/* Giriş (geçici: Supabase Auth'a geçişte e-posta + parolayla değişecek) */
/* ================================================================== */

export async function vendorLogin(
  restaurantId: string,
  pin: string
): Promise<{ vendor: VendorAccount; restaurant: Restaurant }> {
  const restaurant = await findRestaurant(restaurantId);
  if (!restaurant) throw new DomainError("restaurant_not_found", "Restoran bulunamadı.", 404);
  const [vendor] = await sql<VendorAccount[]>`
    select id, restaurant_id, name, email, role, created_at::text as created_at
      from public.vendor_members where restaurant_id = ${restaurant.id} order by created_at limit 1
  `;
  if (!vendor) {
    throw new DomainError("vendor_not_found", "Bu restoran için işletme hesabı tanımlı değil.", 404);
  }
  if (pin.trim() !== VENDOR_PIN) throw new DomainError("invalid_pin", "PIN hatalı. Tekrar dene.", 401);
  return { vendor, restaurant };
}

export async function vendorLoginRestaurants() {
  const rows = await allRestaurantRows();
  return rows.map((r) => ({ id: r.id, name: r.name, emoji: r.emoji, district: r.district, tags: r.tags }));
}

/* ================================================================== */
/* Sipariş yönetimi                                                   */
/* ================================================================== */

export interface VendorOrderBoard {
  /** Onay bekleyenler — panelde zil çalar */
  incoming: Order[];
  /** Hazırlananlar */
  preparing: Order[];
  /** Yolda olanlar */
  onTheWay: Order[];
  /** Son 24 saatte tamamlananlar ve iptaller */
  closed: Order[];
}

export async function orderBoard(restaurantId: string): Promise<VendorOrderBoard> {
  const rows = await sql<OrderRow[]>`
    select * from public.orders
     where restaurant_id = ${restaurantId}
       and (status in ('pending_approval', 'preparing', 'on_the_way')
            or created_at > now() - interval '24 hours')
     order by created_at desc
     limit 300
  `;
  const orders = await hydrateOrders(rows);
  return {
    incoming: orders.filter((o) => o.status === "pending_approval"),
    preparing: orders.filter((o) => o.status === "preparing"),
    onTheWay: orders.filter((o) => o.status === "on_the_way"),
    closed: orders.filter((o) => o.status === "delivered" || o.status === "cancelled"),
  };
}

export interface OrderHistoryQuery {
  status?: "all" | "delivered" | "cancelled" | "active";
  /** İstanbul takvim günü, "2026-10-01" */
  from?: string;
  to?: string;
  page?: number;
}

export interface OrderHistoryPage {
  orders: Order[];
  page: number;
  pageSize: number;
  total: number;
  totals: { delivered: number; cancelled: number; gross: number };
}

const HISTORY_PAGE_SIZE = 25;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Geçmiş siparişler ve iptaller — tarih aralığı ve duruma göre, sayfalı. */
export async function orderHistory(
  restaurantId: string,
  query: OrderHistoryQuery = {}
): Promise<OrderHistoryPage> {
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const statuses: OrderStatus[] | null =
    query.status === "delivered"
      ? ["delivered"]
      : query.status === "cancelled"
        ? ["cancelled"]
        : query.status === "active"
          ? ["pending_approval", "preparing", "on_the_way"]
          : null;
  const from = query.from && DAY_PATTERN.test(query.from) ? query.from : null;
  const to = query.to && DAY_PATTERN.test(query.to) ? query.to : null;

  const filter = () => sql`
    restaurant_id = ${restaurantId}
    and (${statuses}::text[] is null or status = any(${statuses}::text[]))
    and (${from}::date is null or created_at >= (${from}::date::timestamp at time zone 'Europe/Istanbul'))
    and (${to}::date is null or created_at < ((${to}::date + 1)::timestamp at time zone 'Europe/Istanbul'))
  `;

  const [summary] = await sql<{ total: number; delivered: number; cancelled: number; gross: number }[]>`
    select count(*)::int as total,
           count(*) filter (where status = 'delivered')::int as delivered,
           count(*) filter (where status = 'cancelled')::int as cancelled,
           coalesce(sum(subtotal) filter (where status = 'delivered'), 0) as gross
      from public.orders where ${filter()}
  `;
  const rows = await sql<OrderRow[]>`
    select * from public.orders where ${filter()}
     order by created_at desc
     limit ${HISTORY_PAGE_SIZE} offset ${(page - 1) * HISTORY_PAGE_SIZE}
  `;

  return {
    orders: await hydrateOrders(rows),
    page,
    pageSize: HISTORY_PAGE_SIZE,
    total: summary.total,
    totals: { delivered: summary.delivered, cancelled: summary.cancelled, gross: round2(summary.gross) },
  };
}

async function ownedOrderForUpdate(tx: Db, restaurantId: string, orderId: string): Promise<OrderRow> {
  const row = await findOrderRow(orderId, tx, { forUpdate: true });
  if (!row || row.restaurantId !== restaurantId) {
    throw new DomainError("order_not_found", "Sipariş bulunamadı.", 404);
  }
  return row;
}

async function loadOrder(orderId: string): Promise<Order> {
  return (await hydrateOrders([(await findOrderRow(orderId))!]))[0];
}

function validPrep(prepMinutes: number): number {
  const minutes = Math.round(Number(prepMinutes));
  if (!Number.isFinite(minutes) || minutes < 5 || minutes > 120) {
    throw new DomainError("invalid_prep_time", "Hazırlık süresi 5 ile 120 dakika arasında olmalı.");
  }
  return minutes;
}

/** Siparişi onaylar ve hazırlık süresini bildirir. */
export async function approveOrder(
  restaurantId: string,
  orderId: string,
  prepMinutes: number
): Promise<Order> {
  const minutes = validPrep(prepMinutes);
  const settings = await appSettings();

  const courierMode = await sql.begin(async (tx) => {
    const row = await ownedOrderForUpdate(tx, restaurantId, orderId);
    if (row.status !== "pending_approval") {
      throw new DomainError("order_not_pending", "Bu sipariş zaten onaylanmış veya kapanmış.");
    }
    const now = new Date();
    await tx`
      update public.orders
         set status = 'preparing', approved_at = ${now}, prep_minutes = ${minutes},
             eta_at = ${new Date(now.getTime() + scaledMs(minutes + row.travelMinutes, settings))}
       where id = ${row.id}
    `;
    await addOrderEvent(tx, row.id, "preparing", `Restoran siparişi onayladı · hazırlık ${minutes} dk.`, now);
    return row.courierMode;
  });

  // Platform kuryesine teklif hemen gitsin
  if (courierMode === "platform") {
    await dispatchNow().catch((err) => console.warn("[sofra/dispatch]", err));
  }
  return loadOrder(orderId);
}

/** Hazırlık süresini günceller; müşterinin tahmini teslim saati de kayar. */
export async function updatePrepTime(
  restaurantId: string,
  orderId: string,
  prepMinutes: number
): Promise<Order> {
  const minutes = validPrep(prepMinutes);
  const settings = await appSettings();

  await sql.begin(async (tx) => {
    const row = await ownedOrderForUpdate(tx, restaurantId, orderId);
    if (row.status !== "preparing") {
      throw new DomainError("order_not_preparing", "Süre yalnızca hazırlanan siparişlerde güncellenebilir.");
    }
    const approvedAt = row.approvedAt ? row.approvedAt.getTime() : Date.now();
    await tx`
      update public.orders
         set prep_minutes = ${minutes},
             eta_at = ${new Date(approvedAt + scaledMs(minutes + row.travelMinutes, settings))}
       where id = ${row.id}
    `;
    await addOrderEvent(tx, row.id, "preparing", `Hazırlık süresi ${minutes} dakika olarak güncellendi.`);
  });
  return loadOrder(orderId);
}

/**
 * Sipariş paketlendi, kurye alabilir. Durum değişmez — "Yolda" geçişini
 * kurye (ya da restoran kendi kuryesiyle) yapar; bu bildirim kuryeye
 * "paket hazır" sinyalidir.
 */
export async function markReady(restaurantId: string, orderId: string): Promise<Order> {
  await sql.begin(async (tx) => {
    const row = await ownedOrderForUpdate(tx, restaurantId, orderId);
    if (row.status !== "preparing") {
      throw new DomainError("order_not_preparing", "Yalnızca hazırlanan siparişler hazır olarak işaretlenebilir.");
    }
    if (row.readyAt) return;
    await tx`update public.orders set ready_at = now() where id = ${row.id}`;
    await addOrderEvent(
      tx,
      row.id,
      "preparing",
      row.courier ? `Sipariş paketlendi, ${row.courier.name} alabilir.` : "Sipariş paketlendi, kurye bekleniyor."
    );
  });
  return loadOrder(orderId);
}

/** Restoranın kendi kuryesi siparişi aldı → "Yolda". */
export async function markOnTheWay(restaurantId: string, orderId: string): Promise<Order> {
  const settings = await appSettings();

  await sql.begin(async (tx) => {
    const row = await ownedOrderForUpdate(tx, restaurantId, orderId);
    if (row.status !== "preparing") {
      throw new DomainError("order_not_preparing", "Yalnızca hazırlanan siparişler yola çıkarılabilir.");
    }
    if (row.courierMode === "platform") {
      throw new DomainError(
        "courier_owns_delivery",
        "Bu sipariş platform kuryesiyle gidiyor; \"Yolda\" bildirimini kurye siparişi teslim alınca yapar."
      );
    }
    const now = new Date();
    await tx`
      update public.orders
         set status = 'on_the_way', picked_up_at = ${now},
             approved_at = coalesce(approved_at, ${now}),
             eta_at = ${new Date(now.getTime() + scaledMs(row.travelMinutes, settings))}
       where id = ${row.id}
    `;
    await addOrderEvent(tx, row.id, "on_the_way", "Restoran kuryesi yola çıktı.", now);
  });
  return loadOrder(orderId);
}

/** Restoranın kendi kuryesi siparişi teslim etti. */
export async function markDelivered(restaurantId: string, orderId: string): Promise<Order> {
  await sql.begin(async (tx) => {
    const row = await ownedOrderForUpdate(tx, restaurantId, orderId);
    if (row.courierMode === "platform") {
      throw new DomainError(
        "courier_owns_delivery",
        "Bu sipariş platform kuryesiyle gidiyor; teslimatı kurye bildirir."
      );
    }
    if (row.status !== "on_the_way") {
      throw new DomainError("order_not_on_the_way", "Yalnızca yoldaki sipariş teslim edildi olarak işaretlenebilir.");
    }
    await tx`update public.orders set status = 'delivered', delivered_at = now() where id = ${row.id}`;
    await addOrderEvent(tx, row.id, "delivered", "Restoran kuryesi siparişi teslim etti.");
  });
  return loadOrder(orderId);
}

/** Siparişi reddeder; online ödemelerde tutar müşterinin cüzdanına döner. */
export async function rejectOrder(restaurantId: string, orderId: string, reason: string): Promise<Order> {
  await sql.begin(async (tx) => {
    const row = await ownedOrderForUpdate(tx, restaurantId, orderId);
    if (row.status === "delivered" || row.status === "cancelled") {
      throw new DomainError("order_closed", "Kapanmış bir sipariş reddedilemez.");
    }
    if (row.status === "on_the_way") {
      throw new DomainError(
        "order_dispatched",
        "Kurye yola çıktı; iptal için platform desteğiyle görüşmen gerekiyor."
      );
    }
    const cleanReason = reason.trim().slice(0, 200) || "Restoran siparişi kabul edemedi";
    await cancelOrderTx(tx, row, "vendor", cleanReason, `Restoran reddetti: ${cleanReason}`);
  });
  return loadOrder(orderId);
}

export const REJECT_REASONS = [
  "Ürünlerden biri tükendi",
  "Mutfak çok yoğun",
  "Kapanış saatine çok az kaldı",
  "Adres teslimat bölgemizin dışında",
  "Teknik bir sorun yaşıyoruz",
];

/* ================================================================== */
/* Menü & stok                                                        */
/* ================================================================== */

async function assertRestaurant(restaurantId: string) {
  const row = await findRestaurantRow(restaurantId);
  if (!row) throw new DomainError("restaurant_not_found", "Restoran bulunamadı.", 404);
  return row;
}

export interface CategoryInput {
  id?: string;
  name: string;
  description?: string;
}

export async function upsertCategory(restaurantId: string, input: CategoryInput): Promise<MenuCategory[]> {
  await assertRestaurant(restaurantId);
  const name = input.name?.trim() ?? "";
  if (name.length < 2) {
    throw new DomainError("invalid_name", "Kategori adı en az 2 karakter olmalı.");
  }
  const description = input.description?.trim().slice(0, 200) || null;

  if (input.id) {
    const updated = await sql`
      update public.menu_categories set name = ${name.slice(0, 60)}, description = ${description}
       where id = ${input.id} and restaurant_id = ${restaurantId}
      returning id
    `;
    if (updated.length === 0) throw new DomainError("category_not_found", "Kategori bulunamadı.", 404);
  } else {
    await sql`
      insert into public.menu_categories (id, restaurant_id, name, description, position)
      values (
        ${createId("cat")}, ${restaurantId}, ${name.slice(0, 60)}, ${description},
        (select coalesce(max(position), -1) + 1 from public.menu_categories where restaurant_id = ${restaurantId})
      )
    `;
  }
  return loadMenu(restaurantId);
}

export async function deleteCategory(restaurantId: string, categoryId: string): Promise<MenuCategory[]> {
  const productIds = await sql.begin(async (tx) => {
    const products = await tx<{ id: string }[]>`
      select id from public.products where category_id = ${categoryId} and restaurant_id = ${restaurantId}
    `;
    const deleted = await tx`
      delete from public.menu_categories where id = ${categoryId} and restaurant_id = ${restaurantId}
      returning id
    `;
    if (deleted.length === 0) throw new DomainError("category_not_found", "Kategori bulunamadı.", 404);
    return products.map((p) => p.id);
  });
  await discardPendingMedia(restaurantId, productIds);
  return loadMenu(restaurantId);
}

/** Kategoriyi menüde yukarı/aşağı taşır (müşteri menüsündeki sırayı belirler). */
export async function moveCategory(
  restaurantId: string,
  categoryId: string,
  direction: "up" | "down"
): Promise<MenuCategory[]> {
  await sql.begin(async (tx) => {
    const categories = await tx<{ id: string; position: number }[]>`
      select id, position from public.menu_categories
       where restaurant_id = ${restaurantId} order by position, id for update
    `;
    const index = categories.findIndex((c) => c.id === categoryId);
    if (index < 0) throw new DomainError("category_not_found", "Kategori bulunamadı.", 404);
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= categories.length) return;

    const order = categories.map((c) => c.id);
    [order[index], order[target]] = [order[target], order[index]];
    for (const [position, id] of order.entries()) {
      await tx`update public.menu_categories set position = ${position} where id = ${id}`;
    }
  });
  return loadMenu(restaurantId);
}

export interface ProductInput {
  id?: string;
  categoryId: string;
  name: string;
  description?: string;
  emoji?: string;
  price: number;
  oldPrice?: number | null;
  popular?: boolean;
  soldOut?: boolean;
  optionGroups?: OptionGroup[];
}

/** Opsiyon ağacını doğrular ve eksik kimlikleri üretir. */
function normalizeOptionGroups(groups: OptionGroup[] = []): OptionGroup[] {
  if (!Array.isArray(groups)) return [];
  if (groups.length > 20) {
    throw new DomainError("too_many_groups", "Bir üründe en fazla 20 seçenek grubu olabilir.");
  }
  return groups.map((group) => {
    const name = group.name?.trim() ?? "";
    if (name.length < 2) {
      throw new DomainError("invalid_group_name", "Seçenek grubu adı en az 2 karakter olmalı.");
    }
    const options = (group.options ?? []).map((option) => {
      const optionName = option.name?.trim() ?? "";
      if (optionName.length < 1) {
        throw new DomainError("invalid_option_name", "Seçenek adı boş olamaz.");
      }
      const delta = Number(option.priceDelta);
      if (!Number.isFinite(delta) || Math.abs(delta) > 100000) {
        throw new DomainError("invalid_option_price", `"${optionName}" için geçersiz fiyat farkı.`);
      }
      return {
        id: option.id || createId("opt"),
        name: optionName.slice(0, 60),
        priceDelta: round2(delta),
        default: Boolean(option.default),
        soldOut: Boolean(option.soldOut),
      };
    });

    if (options.length === 0) {
      throw new DomainError("empty_option_group", `"${name}" grubuna en az bir seçenek eklemelisin.`);
    }
    const type = group.type === "multi" ? "multi" : "single";
    if (type === "single" && options.filter((o) => o.default).length > 1) {
      throw new DomainError("multiple_defaults", `"${name}" tekli seçim; yalnızca bir varsayılan olabilir.`);
    }
    const maxSelect = type === "multi" && group.maxSelect ? Number(group.maxSelect) : undefined;
    const minSelect = type === "multi" && group.minSelect ? Number(group.minSelect) : undefined;
    if (maxSelect && minSelect && minSelect > maxSelect) {
      throw new DomainError(
        "invalid_select_range",
        `"${name}" için en az seçim, en fazla seçimden büyük olamaz.`
      );
    }

    return {
      id: group.id || createId("grp"),
      name: name.slice(0, 60),
      type,
      required: type === "single" ? Boolean(group.required) : Boolean(minSelect),
      minSelect,
      maxSelect,
      options,
    } satisfies OptionGroup;
  });
}

/**
 * Ürünü ekler ya da günceller. Yeni ürünün kimliği de döner: panel,
 * ürünle birlikte seçilen fotoğrafı bu kimlikle onaya gönderir.
 */
export async function upsertProduct(
  restaurantId: string,
  input: ProductInput
): Promise<{ menu: MenuCategory[]; productId: string }> {
  const name = input.name?.trim() ?? "";
  if (name.length < 2) throw new DomainError("invalid_name", "Ürün adı en az 2 karakter olmalı.");
  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 0 || price > 100000) {
    throw new DomainError("invalid_price", "Geçerli bir fiyat gir.");
  }
  const oldPrice =
    input.oldPrice === null || input.oldPrice === undefined ? null : Number(input.oldPrice);
  if (oldPrice !== null && (!Number.isFinite(oldPrice) || oldPrice <= price)) {
    throw new DomainError("invalid_old_price", "Eski fiyat, güncel fiyattan büyük olmalı.");
  }
  const optionGroups = normalizeOptionGroups(input.optionGroups);

  const productId = await sql.begin(async (tx) => {
    const [category] = await tx<{ id: string }[]>`
      select id from public.menu_categories where id = ${input.categoryId} and restaurant_id = ${restaurantId}
    `;
    if (!category) throw new DomainError("category_not_found", "Kategori bulunamadı.", 404);

    const values = {
      name: name.slice(0, 80),
      description: input.description?.trim().slice(0, 300) || "",
      emoji: input.emoji?.trim() || "🍽️",
      price: round2(price),
      oldPrice: oldPrice === null ? null : round2(oldPrice),
      popular: Boolean(input.popular),
      soldOut: Boolean(input.soldOut),
    };

    if (input.id) {
      const [existing] = await tx<{ categoryId: string }[]>`
        select category_id from public.products where id = ${input.id} and restaurant_id = ${restaurantId}
        for update
      `;
      if (!existing) throw new DomainError("product_not_found", "Ürün bulunamadı.", 404);

      // Fotoğraf bu yoldan değişmez; yalnızca yönetici onayıyla gelir
      await tx`
        update public.products
           set ${tx(values, Object.keys(values) as (keyof typeof values)[])},
               option_groups = ${tx.json(asJson(optionGroups))},
               category_id = ${category.id},
               position = case when category_id = ${category.id} then position
                          else (select coalesce(max(position), -1) + 1 from public.products where category_id = ${category.id}) end
         where id = ${input.id}
      `;
      return input.id;
    }

    const id = createId("prd");
    await tx`
      insert into public.products (
        id, restaurant_id, category_id, name, description, emoji, price, old_price,
        popular, sold_out, option_groups, position
      ) values (
        ${id}, ${restaurantId}, ${category.id}, ${values.name}, ${values.description}, ${values.emoji},
        ${values.price}, ${values.oldPrice}, ${values.popular}, ${values.soldOut},
        ${tx.json(asJson(optionGroups))},
        (select coalesce(max(position), -1) + 1 from public.products where category_id = ${category.id})
      )
    `;
    return id;
  });

  return { menu: await loadMenu(restaurantId), productId };
}

export async function deleteProduct(restaurantId: string, productId: string): Promise<MenuCategory[]> {
  const deleted = await sql`
    delete from public.products where id = ${productId} and restaurant_id = ${restaurantId}
    returning id
  `;
  if (deleted.length === 0) throw new DomainError("product_not_found", "Ürün bulunamadı.", 404);
  await discardPendingMedia(restaurantId, [productId]);
  return loadMenu(restaurantId);
}

/** Anlık stok kapatma. Restoranın ayarına göre müşteri menüsünde gizlenir ya da soluk görünür. */
export async function setProductStock(
  restaurantId: string,
  productId: string,
  soldOut: boolean
): Promise<MenuCategory[]> {
  const updated = await sql`
    update public.products set sold_out = ${soldOut}
     where id = ${productId} and restaurant_id = ${restaurantId}
    returning id
  `;
  if (updated.length === 0) throw new DomainError("product_not_found", "Ürün bulunamadı.", 404);
  return loadMenu(restaurantId);
}

/** Tek bir malzemeyi/ekstrayı stoktan düşer. */
export async function setOptionStock(
  restaurantId: string,
  productId: string,
  groupId: string,
  optionId: string,
  soldOut: boolean
): Promise<MenuCategory[]> {
  await sql.begin(async (tx) => {
    const [product] = await tx<Pick<ProductRow, "optionGroups">[]>`
      select option_groups from public.products
       where id = ${productId} and restaurant_id = ${restaurantId} for update
    `;
    if (!product) throw new DomainError("product_not_found", "Ürün bulunamadı.", 404);

    let found = false;
    const groups = product.optionGroups.map((group) =>
      group.id !== groupId
        ? group
        : {
            ...group,
            options: group.options.map((option) => {
              if (option.id !== optionId) return option;
              found = true;
              return { ...option, soldOut };
            }),
          }
    );
    if (!found) throw new DomainError("option_not_found", "Seçenek bulunamadı.", 404);
    await tx`update public.products set option_groups = ${tx.json(asJson(groups))} where id = ${productId}`;
  });
  return loadMenu(restaurantId);
}

/* ================================================================== */
/* Mağaza ayarları                                                    */
/* ================================================================== */

export interface StoreSettingsInput {
  description?: string;
  workingHours?: { open: string; close: string };
  breakHours?: { start: string; end: string } | null;
  minBasket?: number;
  deliveryFee?: number;
  freeDeliveryOver?: number | null;
  deliveryRadiusKm?: number;
  deliveryZone?: LatLng[] | null;
  etaMin?: number;
  etaMax?: number;
  defaultPrepMinutes?: number;
  temporarilyClosed?: boolean;
  autoAccept?: boolean;
  soldOutDisplay?: "hide" | "dim";
  paymentMethods?: PaymentMethodId[];
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function validZone(zone: LatLng[] | null, center: LatLng): LatLng[] | null {
  if (zone === null) return null;
  if (!Array.isArray(zone) || zone.length < 3 || zone.length > 60) {
    throw new DomainError("invalid_zone", "Teslimat bölgesi en az 3, en fazla 60 köşeli olmalı.");
  }
  const points = zone.map((p) => {
    const lat = Number(p?.lat);
    const lng = Number(p?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new DomainError("invalid_zone", "Teslimat bölgesinde geçersiz bir köşe var.");
    }
    return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
  });
  // Çok uzak köşe: büyük olasılıkla yanlış tıklama (merkezden 40 km)
  const tooFar = points.some((p) => Math.abs(p.lat - center.lat) > 0.36 || Math.abs(p.lng - center.lng) > 0.47);
  if (tooFar) {
    throw new DomainError("invalid_zone", "Teslimat bölgesi restorandan 40 km'den uzağa uzanamaz.");
  }
  return points;
}

export async function updateStoreSettings(
  restaurantId: string,
  input: StoreSettingsInput
): Promise<Restaurant> {
  const current = await assertRestaurant(restaurantId);
  const changes: Changes = {};

  if (input.description !== undefined) changes.description = input.description.trim().slice(0, 300);

  if (input.workingHours) {
    const { open, close } = input.workingHours;
    if (!TIME_PATTERN.test(open) || !TIME_PATTERN.test(close)) {
      throw new DomainError("invalid_hours", "Saatleri SS:DD biçiminde gir.");
    }
    changes.workingHours = sql.json({ open, close });
  }

  if (input.breakHours !== undefined) {
    if (input.breakHours === null) {
      changes.breakHours = null;
    } else {
      const { start, end } = input.breakHours;
      if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) {
        throw new DomainError("invalid_break", "Mola saatlerini SS:DD gir.");
      }
      if (start >= end) {
        throw new DomainError("invalid_break_range", "Mola bitişi, başlangıcından sonra olmalı.");
      }
      changes.breakHours = sql.json({ start, end });
    }
  }

  const amount = (value: number, label: string, max: number) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > max) {
      throw new DomainError("invalid_value", `${label} için geçerli bir değer gir.`);
    }
    return round2(n);
  };

  if (input.minBasket !== undefined) changes.minBasket = amount(input.minBasket, "Minimum sepet tutarı", 5000);
  if (input.deliveryFee !== undefined) changes.deliveryFee = amount(input.deliveryFee, "Teslimat ücreti", 500);
  if (input.freeDeliveryOver !== undefined) {
    changes.freeDeliveryOver =
      input.freeDeliveryOver === null ? null : amount(input.freeDeliveryOver, "Ücretsiz teslimat eşiği", 5000);
  }
  if (input.deliveryRadiusKm !== undefined) {
    const km = Number(input.deliveryRadiusKm);
    if (!Number.isFinite(km) || km < 0.5 || km > 25) {
      throw new DomainError("invalid_radius", "Teslimat yarıçapı 0,5 ile 25 km arasında olmalı.");
    }
    changes.deliveryRadiusKm = Math.round(km * 10) / 10;
  }
  if (input.deliveryZone !== undefined) {
    const zone = validZone(input.deliveryZone, { lat: current.lat, lng: current.lng });
    changes.deliveryZone = zone === null ? null : sql.json(asJson(zone));
  }
  if (input.etaMin !== undefined && input.etaMax !== undefined) {
    const min = Math.round(Number(input.etaMin));
    const max = Math.round(Number(input.etaMax));
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 5 || max > 180) {
      throw new DomainError("invalid_eta", "Teslimat süresi 5-180 dakika olmalı.");
    }
    if (min >= max) throw new DomainError("invalid_eta_range", "Üst süre, alt süreden büyük olmalı.");
    changes.etaMin = min;
    changes.etaMax = max;
  }
  if (input.defaultPrepMinutes !== undefined) changes.defaultPrepMinutes = validPrep(input.defaultPrepMinutes);
  if (input.temporarilyClosed !== undefined) changes.temporarilyClosed = Boolean(input.temporarilyClosed);
  if (input.autoAccept !== undefined) changes.autoAccept = Boolean(input.autoAccept);
  if (input.soldOutDisplay !== undefined) {
    changes.soldOutDisplay = input.soldOutDisplay === "dim" ? "dim" : "hide";
  }
  if (input.paymentMethods) {
    const allowed = [...new Set(input.paymentMethods)].filter(
      (method): method is PaymentMethodId => method in PAYMENT_METHODS
    );
    if (allowed.length === 0) {
      throw new DomainError("no_payment_method", "En az bir ödeme yöntemi açık kalmalı.");
    }
    changes.paymentMethods = allowed;
  }

  if (Object.keys(changes).length > 0) {
    await sql`
      update public.restaurants set ${sql(changes, Object.keys(changes))} where id = ${restaurantId}
    `;
  }
  return (await findRestaurant(restaurantId))!;
}

/* ================================================================== */
/* Finans & raporlama                                                 */
/* ================================================================== */

export type FinancePeriod = "day" | "week" | "month";

export interface FinanceBucket {
  key: string;
  label: string;
  orders: number;
  gross: number;
  commission: number;
  net: number;
}

/** Panelde gösterilen hakediş satırı (ortak defterden). */
export interface Payout {
  id: string;
  label: string;
  orders: number;
  gross: number;
  commission: number;
  net: number;
  status: "pending" | "approved" | "paid";
  date: string;
}

export interface FinanceReport {
  period: FinancePeriod;
  commissionRate: number;
  totals: {
    orders: number;
    gross: number;
    commission: number;
    net: number;
    /** Restoran kendi kuryesiyle götürdüyse teslimat ücretleri (komisyonsuz) */
    deliveryIncome: number;
    avgBasket: number;
    cancelled: number;
    cancelRate: number;
  };
  buckets: FinanceBucket[];
  payouts: Payout[];
  topProducts: { name: string; quantity: number; revenue: number }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Ciro raporu. Brüt ciro = ürün ara toplamı; komisyon sipariş anındaki
 * oranla hesaplanır. Teslimat ücreti ve hizmet bedeli platforma aittir —
 * restoran kendi kuryesiyle götürdüyse teslimat ücreti restoranındır.
 * Dönemler İstanbul takvimiyle gruplanır.
 */
export async function financeReport(
  restaurantId: string,
  period: FinancePeriod = "day"
): Promise<FinanceReport> {
  const restaurant = await assertRestaurant(restaurantId);

  const [totals] = await sql<
    { orders: number; gross: number; commission: number; deliveryIncome: number; cancelled: number }[]
  >`
    select count(*) filter (where status = 'delivered')::int as orders,
           coalesce(sum(subtotal) filter (where status = 'delivered'), 0) as gross,
           coalesce(sum(round(subtotal * commission_rate, 2)) filter (where status = 'delivered'), 0) as commission,
           coalesce(sum(delivery_fee) filter (where status = 'delivered' and courier_mode = 'vendor'), 0)
             as delivery_income,
           count(*) filter (where status = 'cancelled')::int as cancelled
      from public.orders where restaurant_id = ${restaurantId}
  `;

  /* Dönem kovaları */
  const bucketCount = period === "day" ? 14 : period === "week" ? 8 : 6;
  const keyOf = period === "day" ? dayKey : period === "week" ? weekKey : monthKey;
  const labelOf =
    period === "day" ? formatDayKey : period === "week" ? formatWeekKey : formatMonthKey;

  const keys: string[] = [];
  const now = new Date();
  for (let i = bucketCount - 1; i >= 0; i--) {
    const date =
      period === "month"
        ? new Date(now.getFullYear(), now.getMonth() - i, 15)
        : new Date(now.getTime() - i * (period === "day" ? DAY_MS : 7 * DAY_MS));
    const key = keyOf(date);
    if (!keys.includes(key)) keys.push(key);
  }

  const unit = period;
  const format = period === "month" ? "YYYY-MM" : "YYYY-MM-DD";
  const grouped = await sql<{ key: string; orders: number; gross: number; commission: number }[]>`
    select to_char(date_trunc(${unit}, coalesce(delivered_at, created_at) at time zone 'Europe/Istanbul'), ${format}) as key,
           count(*)::int as orders,
           sum(subtotal) as gross,
           sum(round(subtotal * commission_rate, 2)) as commission
      from public.orders
     where restaurant_id = ${restaurantId} and status = 'delivered'
       and coalesce(delivered_at, created_at) >= now() - make_interval(days => ${bucketCount * 31})
     group by 1
  `;
  const byKey = new Map(grouped.map((g) => [g.key, g]));
  const buckets: FinanceBucket[] = keys.map((key) => {
    const row = byKey.get(key);
    const gross = round2(row?.gross ?? 0);
    const commission = round2(row?.commission ?? 0);
    return { key, label: labelOf(key), orders: row?.orders ?? 0, gross, commission, net: round2(gross - commission) };
  });

  const payouts: Payout[] = (await payoutsFor("vendor", restaurantId)).slice(0, 6).map((p) => ({
    id: p.id,
    label: p.periodLabel,
    orders: p.orders,
    gross: p.gross,
    commission: p.commission,
    net: p.net,
    status: p.status,
    date: p.paidAt ?? p.approvedAt ?? p.periodKey,
  }));

  const topProducts = await sql<{ name: string; quantity: number; revenue: number }[]>`
    select l ->> 'name' as name,
           sum((l ->> 'quantity')::int)::int as quantity,
           round(sum((l ->> 'unitPrice')::numeric * (l ->> 'quantity')::int), 2) as revenue
      from public.orders o, jsonb_array_elements(o.lines) l
     where o.restaurant_id = ${restaurantId} and o.status = 'delivered'
     group by 1
     order by revenue desc
     limit 6
  `;

  const gross = round2(totals.gross);
  const commission = round2(totals.commission);
  const allOrders = totals.orders + totals.cancelled;

  return {
    period,
    commissionRate: restaurant.commissionRate,
    totals: {
      orders: totals.orders,
      gross,
      commission,
      net: round2(gross - commission),
      deliveryIncome: round2(totals.deliveryIncome),
      avgBasket: totals.orders ? round2(gross / totals.orders) : 0,
      cancelled: totals.cancelled,
      cancelRate: allOrders ? Math.round((totals.cancelled / allOrders) * 100) : 0,
    },
    buckets,
    payouts,
    topProducts,
  };
}

/* ================================================================== */
/* Değerlendirmeler                                                   */
/* ================================================================== */

export async function vendorReviews(restaurantId: string): Promise<Review[]> {
  const rows = await sql<ReviewRow[]>`
    select * from public.reviews where restaurant_id = ${restaurantId} order by at desc limit 300
  `;
  return rows.map(toReview);
}

export async function replyToReview(restaurantId: string, reviewId: string, reply: string): Promise<Review> {
  const text = reply.trim();
  if (text.length < 2) throw new DomainError("invalid_reply", "Cevap en az 2 karakter olmalı.");
  const [row] = await sql<ReviewRow[]>`
    update public.reviews set reply = ${text.slice(0, 400)}, replied_at = now()
     where id = ${reviewId} and restaurant_id = ${restaurantId}
    returning *
  `;
  if (!row) throw new DomainError("review_not_found", "Değerlendirme bulunamadı.", 404);
  return toReview(row);
}

/* ================================================================== */
/* Panel özeti                                                        */
/* ================================================================== */

export interface VendorSummary {
  todayOrders: number;
  todayGross: number;
  pendingCount: number;
  activeCount: number;
  averageRating: number;
  unansweredReviews: number;
}

export async function vendorSummary(restaurantId: string): Promise<VendorSummary> {
  const [row] = await sql<
    { todayOrders: number; todayGross: number; pending: number; active: number; rating: number; unanswered: number }[]
  >`
    with day as (
      select (date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul') as start
    )
    select
      (select count(*)::int from public.orders, day
        where restaurant_id = ${restaurantId} and created_at >= day.start and status <> 'cancelled') as today_orders,
      (select coalesce(sum(subtotal), 0) from public.orders, day
        where restaurant_id = ${restaurantId} and created_at >= day.start and status <> 'cancelled') as today_gross,
      (select count(*)::int from public.orders
        where restaurant_id = ${restaurantId} and status = 'pending_approval') as pending,
      (select count(*)::int from public.orders
        where restaurant_id = ${restaurantId} and status in ('preparing', 'on_the_way')) as active,
      (select rating from public.restaurants where id = ${restaurantId}) as rating,
      (select count(*)::int from public.reviews
        where restaurant_id = ${restaurantId} and reply is null and coalesce(comment, '') <> '') as unanswered
  `;
  return {
    todayOrders: row.todayOrders,
    todayGross: round2(row.todayGross),
    pendingCount: row.pending,
    activeCount: row.active,
    averageRating: row.rating ?? 0,
    unansweredReviews: row.unanswered,
  };
}
