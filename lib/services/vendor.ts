import { PAYMENT_METHODS } from "../constants";
import { courierDriven, simulatedDurationMs, syncOrder } from "../db/simulator";
import {
  commit,
  db,
  findRestaurant,
  findReview,
  findUserById,
  findVendorByRestaurant,
} from "../db/store";
import { DomainError } from "../errors";
import type {
  MenuCategory,
  Order,
  OptionGroup,
  PaymentMethodId,
  Product,
  Restaurant,
  Review,
  VendorAccount,
} from "../types";
import { createId, round2 } from "../utils";
import { syncOffers } from "./courier";
import { discardPendingMedia } from "./media";
import { payoutsFor } from "./payouts";

/**
 * Restoran paneli (Vendor Dashboard) iş mantığı.
 *
 * Dört sorumluluk: sipariş yönetimi, menü & stok, mağaza ayarları ve
 * finans/değerlendirme. Tüm fonksiyonlar `restaurantId` ile sınırlanır —
 * bir işletme başka bir işletmenin verisine erişemez.
 */

/* ================================================================== */
/* Giriş                                                              */
/* ================================================================== */

export function vendorLogin(
  restaurantId: string,
  pin: string
): { vendor: VendorAccount; restaurant: Restaurant } {
  const restaurant = findRestaurant(restaurantId);
  if (!restaurant) {
    throw new DomainError("restaurant_not_found", "Restoran bulunamadı.", 404);
  }
  const vendor = findVendorByRestaurant(restaurant.id);
  if (!vendor) {
    throw new DomainError(
      "vendor_not_found",
      "Bu restoran için işletme hesabı tanımlı değil.",
      404
    );
  }
  if (vendor.pin !== pin.trim()) {
    throw new DomainError("invalid_pin", "PIN hatalı. Tekrar dene.", 401);
  }
  return { vendor, restaurant };
}

/* ================================================================== */
/* Sipariş yönetimi                                                   */
/* ================================================================== */

/** Restorana ait tüm siparişler, durumları güncellenmiş hâlde. */
export function vendorOrders(restaurantId: string): Order[] {
  // Kurye teklifleri de okuma anında ilerler (bkz. lib/services/courier.ts)
  syncOffers();
  const orders = db()
    .orders.filter((o) => o.restaurantId === restaurantId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  orders.forEach((o) => syncOrder(o));
  return orders;
}

export interface VendorOrderBoard {
  /** Onay bekleyenler — panelde zil çalar */
  incoming: Order[];
  /** Hazırlananlar */
  preparing: Order[];
  /** Yolda olanlar */
  onTheWay: Order[];
  /** Bugün tamamlananlar ve iptaller */
  closed: Order[];
}

export function orderBoard(restaurantId: string): VendorOrderBoard {
  const orders = vendorOrders(restaurantId);
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

  return {
    incoming: orders.filter((o) => o.status === "pending_approval"),
    preparing: orders.filter((o) => o.status === "preparing"),
    onTheWay: orders.filter((o) => o.status === "on_the_way"),
    closed: orders.filter(
      (o) =>
        (o.status === "delivered" || o.status === "cancelled") &&
        new Date(o.createdAt).getTime() > dayAgo
    ),
  };
}

function ownedOrder(restaurantId: string, orderId: string): Order {
  const order = db().orders.find((o) => o.id === orderId);
  if (!order || order.restaurantId !== restaurantId) {
    throw new DomainError("order_not_found", "Sipariş bulunamadı.", 404);
  }
  syncOrder(order);
  return order;
}

/**
 * Siparişi onaylar ve hazırlık süresini bildirir.
 * Sipariş bu andan sonra panel tarafından yönetilir (`controlMode: manual`).
 */
export function approveOrder(
  restaurantId: string,
  orderId: string,
  prepMinutes: number
): Order {
  const order = ownedOrder(restaurantId, orderId);

  if (order.status !== "pending_approval") {
    throw new DomainError(
      "order_not_pending",
      "Bu sipariş zaten onaylanmış veya kapanmış."
    );
  }
  const minutes = Math.round(prepMinutes);
  if (!Number.isFinite(minutes) || minutes < 5 || minutes > 120) {
    throw new DomainError(
      "invalid_prep_time",
      "Hazırlık süresi 5 ile 120 dakika arasında olmalı."
    );
  }

  const now = new Date();
  order.controlMode = "manual";
  order.status = "preparing";
  order.approvedAt = now.toISOString();
  order.prepMinutes = minutes;
  order.etaAt = new Date(
    now.getTime() + simulatedDurationMs(minutes + order.travelMinutes)
  ).toISOString();
  order.timeline.push({
    status: "preparing",
    at: now.toISOString(),
    note: `Restoran siparişi onayladı · hazırlık ${minutes} dk.`,
  });

  commit();
  return order;
}

/** Hazırlık süresini günceller; müşterinin ETA'sı da kayar. */
export function updatePrepTime(
  restaurantId: string,
  orderId: string,
  prepMinutes: number
): Order {
  const order = ownedOrder(restaurantId, orderId);

  if (order.status !== "preparing") {
    throw new DomainError(
      "order_not_preparing",
      "Süre yalnızca hazırlanan siparişlerde güncellenebilir."
    );
  }
  const minutes = Math.round(prepMinutes);
  if (!Number.isFinite(minutes) || minutes < 5 || minutes > 120) {
    throw new DomainError(
      "invalid_prep_time",
      "Hazırlık süresi 5 ile 120 dakika arasında olmalı."
    );
  }

  const approvedAt = order.approvedAt
    ? new Date(order.approvedAt).getTime()
    : Date.now();
  order.prepMinutes = minutes;
  order.etaAt = new Date(
    approvedAt + simulatedDurationMs(minutes + order.travelMinutes)
  ).toISOString();
  order.timeline.push({
    status: "preparing",
    at: new Date().toISOString(),
    note: `Hazırlık süresi ${minutes} dakika olarak güncellendi.`,
  });

  commit();
  return order;
}

/**
 * Sipariş paketlendi, kurye alabilir.
 *
 * Platform kuryesi atanmış siparişlerde durum değişmez — "Yolda" geçişini
 * kurye kendi uygulamasından bildirir. Bu bildirim yalnızca kuryeye
 * "paket hazır" sinyali verir ve zaman çizelgesine yazılır.
 */
export function markReady(restaurantId: string, orderId: string): Order {
  const order = ownedOrder(restaurantId, orderId);

  if (order.status !== "preparing") {
    throw new DomainError(
      "order_not_preparing",
      "Yalnızca hazırlanan siparişler hazır olarak işaretlenebilir."
    );
  }
  if (order.readyAt) return order;

  const now = new Date().toISOString();
  order.readyAt = now;
  order.timeline.push({
    status: "preparing",
    at: now,
    note: order.courier
      ? `Sipariş paketlendi, ${order.courier.name} alabilir.`
      : "Sipariş paketlendi, kurye bekleniyor.",
  });

  commit();
  return order;
}

/** Sipariş kuryeye teslim edildi → "Yolda". */
export function markOnTheWay(restaurantId: string, orderId: string): Order {
  const order = ownedOrder(restaurantId, orderId);

  if (order.status !== "preparing") {
    throw new DomainError(
      "order_not_preparing",
      "Yalnızca hazırlanan siparişler yola çıkarılabilir."
    );
  }
  if (courierDriven(order)) {
    throw new DomainError(
      "courier_owns_delivery",
      "Bu siparişi platform kuryesi üstlendi; \"Yolda\" bildirimini kurye yapar."
    );
  }

  const now = new Date();
  order.controlMode = "manual";
  order.status = "on_the_way";
  order.pickedUpAt = now.toISOString();
  if (!order.approvedAt) order.approvedAt = now.toISOString();
  order.etaAt = new Date(
    now.getTime() + simulatedDurationMs(order.travelMinutes)
  ).toISOString();
  order.timeline.push({
    status: "on_the_way",
    at: now.toISOString(),
    note:
      order.courierMode === "platform"
        ? "Kurye siparişi restorandan teslim aldı."
        : "Restoran kuryesi yola çıktı.",
  });

  commit();
  syncOrder(order);
  return order;
}

/** Siparişi reddeder; online ödemelerde tutar müşterinin cüzdanına döner. */
export function rejectOrder(
  restaurantId: string,
  orderId: string,
  reason: string
): Order {
  const order = ownedOrder(restaurantId, orderId);

  if (order.status === "delivered" || order.status === "cancelled") {
    throw new DomainError(
      "order_closed",
      "Kapanmış bir sipariş reddedilemez."
    );
  }
  if (order.status === "on_the_way") {
    throw new DomainError(
      "order_dispatched",
      "Kurye yola çıktı; iptal için platform desteğiyle görüşmen gerekiyor."
    );
  }

  const now = new Date().toISOString();
  order.status = "cancelled";
  order.controlMode = "manual";
  order.cancelledAt = now;
  order.cancelledBy = "vendor";
  order.cancelReason = reason.trim() || "Restoran siparişi kabul edemedi";
  order.timeline.push({
    status: "cancelled",
    at: now,
    note: `Restoran reddetti: ${order.cancelReason}`,
  });

  // Online ödemelerde iade cüzdana yansır (kapıda ödemede tahsilat yok).
  if (!PAYMENT_METHODS[order.paymentMethod].onDelivery) {
    const user = findUserById(order.userId);
    if (user) {
      user.walletBalance = round2(
        user.walletBalance + order.totals.grandTotal
      );
    }
  }

  commit();
  return order;
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

function ownedRestaurant(restaurantId: string): Restaurant {
  const restaurant = findRestaurant(restaurantId);
  if (!restaurant) {
    throw new DomainError("restaurant_not_found", "Restoran bulunamadı.", 404);
  }
  return restaurant;
}

function findCategory(restaurant: Restaurant, categoryId: string): MenuCategory {
  const category = restaurant.menu.find((c) => c.id === categoryId);
  if (!category) {
    throw new DomainError("category_not_found", "Kategori bulunamadı.", 404);
  }
  return category;
}

function locateProduct(
  restaurant: Restaurant,
  productId: string
): { category: MenuCategory; product: Product } {
  for (const category of restaurant.menu) {
    const product = category.products.find((p) => p.id === productId);
    if (product) return { category, product };
  }
  throw new DomainError("product_not_found", "Ürün bulunamadı.", 404);
}

export interface CategoryInput {
  id?: string;
  name: string;
  description?: string;
}

export function upsertCategory(
  restaurantId: string,
  input: CategoryInput
): Restaurant {
  const restaurant = ownedRestaurant(restaurantId);
  const name = input.name?.trim() ?? "";
  if (name.length < 2) {
    throw new DomainError("invalid_name", "Kategori adı en az 2 karakter olmalı.");
  }

  if (input.id) {
    const category = findCategory(restaurant, input.id);
    category.name = name;
    category.description = input.description?.trim() || undefined;
  } else {
    restaurant.menu.push({
      id: createId("cat"),
      name,
      description: input.description?.trim() || undefined,
      products: [],
    });
  }

  commit();
  return restaurant;
}

export function deleteCategory(
  restaurantId: string,
  categoryId: string
): Restaurant {
  const restaurant = ownedRestaurant(restaurantId);
  const category = findCategory(restaurant, categoryId);
  restaurant.menu = restaurant.menu.filter((c) => c.id !== categoryId);
  discardPendingMedia(
    restaurant.id,
    category.products.map((p) => p.id)
  );
  commit();
  return restaurant;
}

/** Kategoriyi menüde yukarı/aşağı taşır (müşteri menüsündeki sırayı belirler). */
export function moveCategory(
  restaurantId: string,
  categoryId: string,
  direction: "up" | "down"
): Restaurant {
  const restaurant = ownedRestaurant(restaurantId);
  const index = restaurant.menu.findIndex((c) => c.id === categoryId);
  if (index < 0) {
    throw new DomainError("category_not_found", "Kategori bulunamadı.", 404);
  }
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= restaurant.menu.length) return restaurant;

  const [moved] = restaurant.menu.splice(index, 1);
  restaurant.menu.splice(target, 0, moved);
  commit();
  return restaurant;
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

/** Opsiyon ağacını doğrular ve eksik id'leri üretir. */
function normalizeOptionGroups(groups: OptionGroup[] = []): OptionGroup[] {
  return groups.map((group) => {
    const name = group.name?.trim() ?? "";
    if (name.length < 2) {
      throw new DomainError(
        "invalid_group_name",
        "Seçenek grubu adı en az 2 karakter olmalı."
      );
    }
    const options = (group.options ?? []).map((option) => {
      const optionName = option.name?.trim() ?? "";
      if (optionName.length < 1) {
        throw new DomainError("invalid_option_name", "Seçenek adı boş olamaz.");
      }
      const delta = Number(option.priceDelta);
      if (!Number.isFinite(delta) || Math.abs(delta) > 100000) {
        throw new DomainError(
          "invalid_option_price",
          `"${optionName}" için geçersiz fiyat farkı.`
        );
      }
      return {
        id: option.id || createId("opt"),
        name: optionName,
        priceDelta: round2(delta),
        default: Boolean(option.default),
        soldOut: Boolean(option.soldOut),
      };
    });

    if (options.length === 0) {
      throw new DomainError(
        "empty_option_group",
        `"${name}" grubuna en az bir seçenek eklemelisin.`
      );
    }
    const type = group.type === "multi" ? "multi" : "single";
    if (type === "single" && options.filter((o) => o.default).length > 1) {
      throw new DomainError(
        "multiple_defaults",
        `"${name}" tekli seçim; yalnızca bir varsayılan olabilir.`
      );
    }
    const maxSelect =
      type === "multi" && group.maxSelect ? Number(group.maxSelect) : undefined;
    const minSelect =
      type === "multi" && group.minSelect ? Number(group.minSelect) : undefined;
    if (maxSelect && minSelect && minSelect > maxSelect) {
      throw new DomainError(
        "invalid_select_range",
        `"${name}" için en az seçim, en fazla seçimden büyük olamaz.`
      );
    }

    return {
      id: group.id || createId("grp"),
      name,
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
export function upsertProduct(
  restaurantId: string,
  input: ProductInput
): { restaurant: Restaurant; productId: string } {
  const restaurant = ownedRestaurant(restaurantId);
  const category = findCategory(restaurant, input.categoryId);

  const name = input.name?.trim() ?? "";
  if (name.length < 2) {
    throw new DomainError("invalid_name", "Ürün adı en az 2 karakter olmalı.");
  }
  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 0 || price > 100000) {
    throw new DomainError("invalid_price", "Geçerli bir fiyat gir.");
  }
  const oldPrice =
    input.oldPrice === null || input.oldPrice === undefined
      ? undefined
      : Number(input.oldPrice);
  if (oldPrice !== undefined && (!Number.isFinite(oldPrice) || oldPrice <= price)) {
    throw new DomainError(
      "invalid_old_price",
      "Eski fiyat, güncel fiyattan büyük olmalı."
    );
  }

  const optionGroups = normalizeOptionGroups(input.optionGroups);

  const payload = {
    name,
    description: input.description?.trim() || "",
    emoji: input.emoji?.trim() || "🍽️",
    price: round2(price),
    oldPrice: oldPrice ? round2(oldPrice) : undefined,
    popular: Boolean(input.popular),
    soldOut: Boolean(input.soldOut),
    optionGroups,
  };

  let productId: string;
  if (input.id) {
    const { category: currentCategory, product } = locateProduct(
      restaurant,
      input.id
    );
    // Fotoğraf bu yoldan değişmez; yalnızca yönetici onayıyla gelir
    Object.assign(product, payload);
    productId = product.id;

    // Kategori değiştiyse ürünü taşı
    if (currentCategory.id !== category.id) {
      currentCategory.products = currentCategory.products.filter(
        (p) => p.id !== product.id
      );
      category.products.push(product);
    }
  } else {
    productId = createId("prd");
    category.products.push({ id: productId, ...payload });
  }

  commit();
  return { restaurant, productId };
}

export function deleteProduct(
  restaurantId: string,
  productId: string
): Restaurant {
  const restaurant = ownedRestaurant(restaurantId);
  const { category, product } = locateProduct(restaurant, productId);
  category.products = category.products.filter((p) => p.id !== product.id);
  discardPendingMedia(restaurant.id, [product.id]);
  commit();
  return restaurant;
}

/** Anlık stok kapatma — ürün menüde görünür ama sipariş edilemez. */
export function setProductStock(
  restaurantId: string,
  productId: string,
  soldOut: boolean
): Restaurant {
  const restaurant = ownedRestaurant(restaurantId);
  const { product } = locateProduct(restaurant, productId);
  product.soldOut = soldOut;
  commit();
  return restaurant;
}

/** Tek bir malzemeyi/ekstrayı stoktan düşer. */
export function setOptionStock(
  restaurantId: string,
  productId: string,
  groupId: string,
  optionId: string,
  soldOut: boolean
): Restaurant {
  const restaurant = ownedRestaurant(restaurantId);
  const { product } = locateProduct(restaurant, productId);
  const group = product.optionGroups.find((g) => g.id === groupId);
  const option = group?.options.find((o) => o.id === optionId);
  if (!group || !option) {
    throw new DomainError("option_not_found", "Seçenek bulunamadı.", 404);
  }
  option.soldOut = soldOut;
  commit();
  return restaurant;
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
  etaMin?: number;
  etaMax?: number;
  temporarilyClosed?: boolean;
  autoAccept?: boolean;
  paymentMethods?: PaymentMethodId[];
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function updateStoreSettings(
  restaurantId: string,
  input: StoreSettingsInput
): Restaurant {
  const restaurant = ownedRestaurant(restaurantId);

  if (input.description !== undefined) {
    restaurant.description = input.description.trim().slice(0, 300);
  }

  if (input.workingHours) {
    const { open, close } = input.workingHours;
    if (!TIME_PATTERN.test(open) || !TIME_PATTERN.test(close)) {
      throw new DomainError("invalid_hours", "Saatleri SS:DD biçiminde gir.");
    }
    restaurant.workingHours = { open, close };
  }

  if (input.breakHours !== undefined) {
    if (input.breakHours === null) {
      restaurant.breakHours = null;
    } else {
      const { start, end } = input.breakHours;
      if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) {
        throw new DomainError("invalid_break", "Mola saatlerini SS:DD gir.");
      }
      if (start >= end) {
        throw new DomainError(
          "invalid_break_range",
          "Mola bitişi, başlangıcından sonra olmalı."
        );
      }
      restaurant.breakHours = { start, end };
    }
  }

  const positive = (value: number, label: string, max: number) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > max) {
      throw new DomainError("invalid_value", `${label} için geçerli bir değer gir.`);
    }
    return round2(n);
  };

  if (input.minBasket !== undefined) {
    restaurant.minBasket = positive(input.minBasket, "Minimum sepet tutarı", 5000);
  }
  if (input.deliveryFee !== undefined) {
    restaurant.deliveryFee = positive(input.deliveryFee, "Teslimat ücreti", 500);
  }
  if (input.freeDeliveryOver !== undefined) {
    restaurant.freeDeliveryOver =
      input.freeDeliveryOver === null
        ? null
        : positive(input.freeDeliveryOver, "Ücretsiz teslimat eşiği", 5000);
  }
  if (input.deliveryRadiusKm !== undefined) {
    const km = Number(input.deliveryRadiusKm);
    if (!Number.isFinite(km) || km < 0.5 || km > 25) {
      throw new DomainError(
        "invalid_radius",
        "Teslimat yarıçapı 0,5 ile 25 km arasında olmalı."
      );
    }
    restaurant.deliveryRadiusKm = Math.round(km * 10) / 10;
  }
  if (input.etaMin !== undefined && input.etaMax !== undefined) {
    const min = Math.round(Number(input.etaMin));
    const max = Math.round(Number(input.etaMax));
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 5 || max > 180) {
      throw new DomainError("invalid_eta", "Teslimat süresi 5-180 dakika olmalı.");
    }
    if (min >= max) {
      throw new DomainError(
        "invalid_eta_range",
        "Üst süre, alt süreden büyük olmalı."
      );
    }
    restaurant.etaMin = min;
    restaurant.etaMax = max;
  }

  if (input.temporarilyClosed !== undefined) {
    restaurant.temporarilyClosed = Boolean(input.temporarilyClosed);
  }
  if (input.autoAccept !== undefined) {
    restaurant.autoAccept = Boolean(input.autoAccept);
  }
  if (input.paymentMethods) {
    const allowed = input.paymentMethods.filter(
      (method): method is PaymentMethodId => method in PAYMENT_METHODS
    );
    if (allowed.length === 0) {
      throw new DomainError(
        "no_payment_method",
        "En az bir ödeme yöntemi açık kalmalı."
      );
    }
    restaurant.paymentMethods = allowed;
  }

  commit();
  return restaurant;
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

/** Panelde gösterilen hakediş satırı (ortak defterden türetilir). */
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
    avgBasket: number;
    cancelled: number;
    cancelRate: number;
  };
  buckets: FinanceBucket[];
  payouts: Payout[];
  topProducts: { name: string; quantity: number; revenue: number }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function bucketKey(date: Date, period: FinancePeriod): string {
  if (period === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  if (period === "week") {
    const monday = new Date(date);
    const day = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - day);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function bucketLabel(key: string, period: FinancePeriod): string {
  if (period === "month") {
    const [year, month] = key.split("-").map(Number);
    return new Intl.DateTimeFormat("tr-TR", {
      month: "long",
      year: "numeric",
    }).format(new Date(year, month - 1, 1));
  }
  const date = new Date(key);
  if (period === "week") {
    const end = new Date(date.getTime() + 6 * DAY_MS);
    const fmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" });
    return `${fmt.format(date)} – ${fmt.format(end)}`;
  }
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
  }).format(date);
}

/**
 * Ciro raporu.
 *
 * Restoranın brüt cirosu = ürün ara toplamı. Teslimat ve hizmet bedeli
 * platforma aittir, restoranın hakedişine girmez. Net hakediş =
 * brüt − platform komisyonu.
 */
export function financeReport(
  restaurantId: string,
  period: FinancePeriod = "day"
): FinanceReport {
  const restaurant = ownedRestaurant(restaurantId);
  const orders = vendorOrders(restaurantId);
  const rate = restaurant.commissionRate;

  const completed = orders.filter((o) => o.status === "delivered");
  const cancelled = orders.filter((o) => o.status === "cancelled");

  const gross = round2(
    completed.reduce((sum, o) => sum + o.totals.subtotal, 0)
  );
  const commission = round2(gross * rate);

  /* Dönem kovaları */
  const bucketCount = period === "day" ? 14 : period === "week" ? 8 : 6;
  const map = new Map<string, FinanceBucket>();
  const now = new Date();

  for (let i = bucketCount - 1; i >= 0; i--) {
    const date = new Date(now);
    if (period === "day") date.setDate(date.getDate() - i);
    else if (period === "week") date.setDate(date.getDate() - i * 7);
    else date.setMonth(date.getMonth() - i);

    const key = bucketKey(date, period);
    map.set(key, {
      key,
      label: bucketLabel(key, period),
      orders: 0,
      gross: 0,
      commission: 0,
      net: 0,
    });
  }

  for (const order of completed) {
    const key = bucketKey(new Date(order.createdAt), period);
    const bucket = map.get(key);
    if (!bucket) continue;
    bucket.orders += 1;
    bucket.gross = round2(bucket.gross + order.totals.subtotal);
  }
  for (const bucket of map.values()) {
    bucket.commission = round2(bucket.gross * rate);
    bucket.net = round2(bucket.gross - bucket.commission);
  }

  /*
   * Haftalık hakedişler ortak defterden okunur: yönetici panelinde
   * onaylanan tutar ve durum burada birebir görünür.
   */
  const payouts: Payout[] = payoutsFor("vendor", restaurantId)
    .slice(0, 6)
    .map((p) => ({
      id: p.id,
      label: p.periodLabel,
      orders: p.orders,
      gross: p.gross,
      commission: p.commission,
      net: p.net,
      status: p.status,
      date: p.paidAt ?? p.approvedAt ?? p.periodKey,
    }));

  /* En çok satan ürünler */
  const productMap = new Map<string, { quantity: number; revenue: number }>();
  for (const order of completed) {
    for (const line of order.lines) {
      const entry = productMap.get(line.name) ?? { quantity: 0, revenue: 0 };
      entry.quantity += line.quantity;
      entry.revenue = round2(entry.revenue + line.unitPrice * line.quantity);
      productMap.set(line.name, entry);
    }
  }
  const topProducts = [...productMap.entries()]
    .map(([name, entry]) => ({ name, ...entry }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  const totalOrders = completed.length + cancelled.length;

  return {
    period,
    commissionRate: rate,
    totals: {
      orders: completed.length,
      gross,
      commission,
      net: round2(gross - commission),
      avgBasket: completed.length ? round2(gross / completed.length) : 0,
      cancelled: cancelled.length,
      cancelRate: totalOrders
        ? Math.round((cancelled.length / totalOrders) * 100)
        : 0,
    },
    buckets: [...map.values()],
    payouts,
    topProducts,
  };
}

/* ================================================================== */
/* Değerlendirmeler                                                   */
/* ================================================================== */

export function vendorReviews(restaurantId: string): Review[] {
  return db()
    .reviews.filter((r) => r.restaurantId === restaurantId)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function replyToReview(
  restaurantId: string,
  reviewId: string,
  reply: string
): Review {
  const review = findReview(reviewId);
  if (!review || review.restaurantId !== restaurantId) {
    throw new DomainError("review_not_found", "Değerlendirme bulunamadı.", 404);
  }
  const text = reply.trim();
  if (text.length < 2) {
    throw new DomainError("invalid_reply", "Cevap en az 2 karakter olmalı.");
  }
  review.reply = text.slice(0, 400);
  commit();
  return review;
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

export function vendorSummary(restaurantId: string): VendorSummary {
  const restaurant = ownedRestaurant(restaurantId);
  const orders = vendorOrders(restaurantId);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const today = orders.filter(
    (o) =>
      new Date(o.createdAt).getTime() >= startOfDay.getTime() &&
      o.status !== "cancelled"
  );
  const reviews = vendorReviews(restaurantId);

  return {
    todayOrders: today.length,
    todayGross: round2(today.reduce((sum, o) => sum + o.totals.subtotal, 0)),
    pendingCount: orders.filter((o) => o.status === "pending_approval").length,
    activeCount: orders.filter(
      (o) => o.status === "preparing" || o.status === "on_the_way"
    ).length,
    averageRating: restaurant.rating,
    unansweredReviews: reviews.filter((r) => !r.reply).length,
  };
}
