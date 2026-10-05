import "server-only";
import type {
  Address,
  AdminAccount,
  Banner,
  CartLine,
  Coupon,
  Courier,
  CourierEarning,
  CourierStage,
  CourierSummary,
  DeliveryOffer,
  DeliveryPreferences,
  LatLng,
  MediaRequest,
  MenuCategory,
  OptionGroup,
  Order,
  OrderRating,
  OrderStatus,
  OrderTimelineEntry,
  PartnerApplication,
  PaymentMethodId,
  Payout,
  Product,
  Restaurant,
  Review,
  RouteLeg,
  SavedCard,
  User,
  VendorAccount,
} from "../types";
import type { RestaurantBase } from "../discovery";
import { iso, isoRequired } from "./client";

/**
 * Veritabanı satırlarından alan modeline dönüşüm.
 *
 * Kolon adları istemcide camelCase'e çevrilmiş gelir (`client.ts`). Burada
 * yalnızca biçim farkları kapanır: enlem/boylam çiftleri `LatLng` olur,
 * tarihler ISO metnine döner, boş değerler `undefined` olur — API
 * sözleşmesi JSON deposu dönemindekiyle birebir aynı kalır.
 */

const point = (lat: number, lng: number): LatLng => ({ lat, lng });
const opt = <T>(value: T | null | undefined): T | undefined => value ?? undefined;

/* ------------------------------------------------------------------ */
/* Restoran ve menü                                                    */
/* ------------------------------------------------------------------ */

export interface RestaurantRow {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  coverSeed: string;
  image: string | null;
  tags: string[];
  description: string;
  rating: number;
  ratingSum: number;
  ratingCount: number;
  etaMin: number;
  etaMax: number;
  minBasket: number;
  deliveryFee: number;
  freeDeliveryOver: number | null;
  lat: number;
  lng: number;
  district: string;
  deliveryRadiusKm: number;
  deliveryZone: LatLng[] | null;
  workingHours: { open: string; close: string };
  breakHours: { start: string; end: string } | null;
  commissionRate: number;
  approvalStatus: Restaurant["approvalStatus"];
  joinedAt: Date;
  temporarilyClosed: boolean;
  autoAccept: boolean;
  defaultPrepMinutes: number;
  courierMode: Restaurant["courierMode"];
  paymentMethods: string[];
  badges: string[];
  featuredRank: number | null;
  soldOutDisplay: "hide" | "dim";
  updatedAt: Date;
}

export function toRestaurantBase(row: RestaurantRow): RestaurantBase {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    emoji: row.emoji,
    coverSeed: row.coverSeed,
    image: opt(row.image),
    tags: row.tags as Restaurant["tags"],
    description: row.description,
    rating: row.rating,
    ratingCount: row.ratingCount,
    etaMin: row.etaMin,
    etaMax: row.etaMax,
    minBasket: row.minBasket,
    deliveryFee: row.deliveryFee,
    freeDeliveryOver: row.freeDeliveryOver,
    location: point(row.lat, row.lng),
    district: row.district,
    deliveryRadiusKm: row.deliveryRadiusKm,
    deliveryZone: row.deliveryZone,
    workingHours: row.workingHours,
    breakHours: row.breakHours,
    commissionRate: row.commissionRate,
    approvalStatus: row.approvalStatus,
    joinedAt: isoRequired(row.joinedAt),
    temporarilyClosed: row.temporarilyClosed,
    autoAccept: row.autoAccept,
    defaultPrepMinutes: row.defaultPrepMinutes,
    courierMode: row.courierMode,
    badges: row.badges,
    featuredRank: row.featuredRank,
    soldOutDisplay: row.soldOutDisplay,
  };
}

export function toRestaurant(row: RestaurantRow, menu: MenuCategory[]): Restaurant {
  return {
    ...toRestaurantBase(row),
    paymentMethods: row.paymentMethods as PaymentMethodId[],
    menu,
  };
}

export interface CategoryRow {
  id: string;
  restaurantId: string;
  name: string;
  description: string | null;
  position: number;
}

export interface ProductRow {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string;
  emoji: string;
  image: string | null;
  price: number;
  oldPrice: number | null;
  soldOut: boolean;
  popular: boolean;
  optionGroups: OptionGroup[];
  position: number;
}

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    emoji: row.emoji,
    image: opt(row.image),
    price: row.price,
    oldPrice: opt(row.oldPrice),
    soldOut: row.soldOut || undefined,
    popular: row.popular || undefined,
    optionGroups: row.optionGroups ?? [],
  };
}

/** Kategori ve ürün satırlarından sıralı menü ağacı kurar. */
export function buildMenu(categories: CategoryRow[], products: ProductRow[]): MenuCategory[] {
  const byCategory = new Map<string, Product[]>();
  for (const row of [...products].sort((a, b) => a.position - b.position)) {
    const list = byCategory.get(row.categoryId) ?? [];
    list.push(toProduct(row));
    byCategory.set(row.categoryId, list);
  }
  return [...categories]
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      id: c.id,
      name: c.name,
      description: opt(c.description),
      products: byCategory.get(c.id) ?? [],
    }));
}

/* ------------------------------------------------------------------ */
/* Müşteri                                                             */
/* ------------------------------------------------------------------ */

export interface ProfileRow {
  id: string;
  authUserId: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  avatarEmoji: string;
  providers: string[];
  walletBalance: number;
  defaultAddressId: string | null;
  blocked: boolean;
  blockReason: string | null;
  blockedAt: Date | null;
  createdAt: Date;
}

export function toUser(row: ProfileRow, favoriteRestaurantIds: string[]): User {
  return {
    id: row.id,
    name: row.name,
    phone: opt(row.phone),
    email: opt(row.email),
    avatarEmoji: row.avatarEmoji,
    providers: row.providers as User["providers"],
    walletBalance: row.walletBalance,
    favoriteRestaurantIds,
    defaultAddressId: opt(row.defaultAddressId),
    createdAt: isoRequired(row.createdAt),
    blocked: row.blocked || undefined,
    blockReason: opt(row.blockReason),
    blockedAt: iso(row.blockedAt),
  };
}

export interface AddressRow {
  id: string;
  userId: string;
  label: Address["label"];
  title: string;
  line1: string;
  district: string;
  city: string;
  directions: string | null;
  buildingNo: string | null;
  floor: string | null;
  apartmentNo: string | null;
  contactName: string | null;
  contactPhone: string | null;
  lat: number;
  lng: number;
  isDefault: boolean;
  createdAt: Date;
}

export function toAddress(row: AddressRow): Address {
  return {
    id: row.id,
    userId: row.userId,
    label: row.label,
    title: row.title,
    line1: row.line1,
    district: row.district,
    city: row.city,
    directions: opt(row.directions),
    buildingNo: opt(row.buildingNo),
    floor: opt(row.floor),
    apartmentNo: opt(row.apartmentNo),
    contactName: opt(row.contactName),
    contactPhone: opt(row.contactPhone),
    point: point(row.lat, row.lng),
    isDefault: row.isDefault,
    createdAt: isoRequired(row.createdAt),
  };
}

export interface CardRow {
  id: string;
  userId: string;
  brand: SavedCard["brand"];
  last4: string;
  holder: string;
  expiry: string;
  nickname: string;
}

export function toCard(row: CardRow): SavedCard {
  return {
    id: row.id,
    userId: row.userId,
    brand: row.brand,
    last4: row.last4,
    holder: row.holder,
    expiry: row.expiry,
    nickname: row.nickname,
  };
}

/* ------------------------------------------------------------------ */
/* Kurye, işletme, yönetici                                            */
/* ------------------------------------------------------------------ */

export interface CourierRow {
  id: string;
  authUserId: string | null;
  name: string;
  emoji: string;
  vehicle: Courier["vehicle"];
  phone: string;
  maskedPhone: string;
  rating: number;
  ratingSum: number;
  ratingCount: number;
  totalDeliveries: number;
  online: boolean;
  shiftStartedAt: Date | null;
  lat: number;
  lng: number;
  homeLat: number;
  homeLng: number;
  locationUpdatedAt: Date | null;
  status: Courier["status"];
  createdAt: Date;
}

export function toCourier(row: CourierRow): Courier {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    vehicle: row.vehicle,
    rating: row.rating,
    maskedPhone: row.maskedPhone,
    phone: row.phone,
    online: row.online,
    shiftStartedAt: iso(row.shiftStartedAt),
    point: point(row.lat, row.lng),
    homePoint: point(row.homeLat, row.homeLng),
    ratingSum: row.ratingSum,
    ratingCount: row.ratingCount,
    totalDeliveries: row.totalDeliveries,
    createdAt: isoRequired(row.createdAt),
    status: row.status,
  };
}

export function toCourierSummary(row: CourierRow | Courier): CourierSummary {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    vehicle: row.vehicle,
    rating: row.rating,
    maskedPhone: row.maskedPhone,
  };
}

export interface VendorMemberRow {
  id: string;
  restaurantId: string;
  authUserId: string | null;
  name: string;
  email: string;
  role: "owner" | "staff";
  createdAt: Date;
}

export function toVendorAccount(row: VendorMemberRow): VendorAccount {
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: isoRequired(row.createdAt),
  };
}

export interface AdminRow {
  id: string;
  authUserId: string | null;
  name: string;
  email: string;
  createdAt: Date;
}

export function toAdmin(row: AdminRow): AdminAccount {
  return { id: row.id, name: row.name, email: row.email, createdAt: isoRequired(row.createdAt) };
}

/* ------------------------------------------------------------------ */
/* Sipariş                                                             */
/* ------------------------------------------------------------------ */

export interface OrderRow {
  id: string;
  code: string;
  userId: string;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  restaurantEmoji: string;
  restaurantImage: string | null;
  restaurantLat: number;
  restaurantLng: number;
  commissionRate: number;
  address: Address;
  lines: CartLine[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  serviceFee: number;
  walletUsed: number;
  grandTotal: number;
  refundedTotal: number;
  paymentMethod: PaymentMethodId;
  paymentLabel: string;
  couponCode: string | null;
  preferences: DeliveryPreferences;
  status: OrderStatus;
  courierMode: Order["courierMode"];
  courierId: string | null;
  courier: CourierSummary | null;
  courierStage: CourierStage | null;
  courierArrivedAt: Date | null;
  courierFee: number | null;
  courierLat: number | null;
  courierLng: number | null;
  courierLocatedAt: Date | null;
  courierRoute: LatLng[] | null;
  courierRouteLeg: RouteLeg | null;
  courierRouteAt: Date | null;
  courierRouteDistanceM: number | null;
  courierRouteDurationS: number | null;
  readyAt: Date | null;
  approvedAt: Date | null;
  pickedUpAt: Date | null;
  prepMinutes: number | null;
  travelMinutes: number;
  etaAt: Date;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  cancelledBy: Order["cancelledBy"] | null;
  rating: OrderRating | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderEventRow {
  orderId: string;
  status: OrderStatus;
  note: string | null;
  at: Date;
}

export function toTimeline(events: OrderEventRow[]): OrderTimelineEntry[] {
  return [...events]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((e) => ({ status: e.status, at: isoRequired(e.at), note: opt(e.note) }));
}

export function toOrder(row: OrderRow, events: OrderEventRow[]): Order {
  return {
    id: row.id,
    code: row.code,
    userId: row.userId,
    restaurantId: row.restaurantId,
    restaurantName: row.restaurantName,
    restaurantSlug: row.restaurantSlug,
    restaurantEmoji: row.restaurantEmoji,
    restaurantImage: opt(row.restaurantImage),
    restaurantLocation: point(row.restaurantLat, row.restaurantLng),
    address: row.address,
    lines: row.lines,
    totals: {
      subtotal: row.subtotal,
      deliveryFee: row.deliveryFee,
      discount: row.discount,
      serviceFee: row.serviceFee,
      walletUsed: row.walletUsed,
      grandTotal: row.grandTotal,
    },
    paymentMethod: row.paymentMethod,
    paymentLabel: row.paymentLabel,
    couponCode: opt(row.couponCode),
    preferences: row.preferences,
    status: row.status,
    timeline: toTimeline(events),
    courier: opt(row.courier),
    courierMode: row.courierMode,
    courierStage: opt(row.courierStage),
    courierArrivedAt: iso(row.courierArrivedAt),
    readyAt: iso(row.readyAt),
    courierFee: opt(row.courierFee),
    courierPoint:
      row.courierLat === null || row.courierLng === null
        ? undefined
        : point(row.courierLat, row.courierLng),
    courierLocatedAt: iso(row.courierLocatedAt),
    courierRoute: opt(row.courierRoute),
    courierRouteLeg: opt(row.courierRouteLeg),
    courierRouteDistanceM: opt(row.courierRouteDistanceM),
    courierRouteDurationS: opt(row.courierRouteDurationS),
    createdAt: isoRequired(row.createdAt),
    etaAt: isoRequired(row.etaAt),
    deliveredAt: iso(row.deliveredAt),
    cancelledAt: iso(row.cancelledAt),
    cancelReason: opt(row.cancelReason),
    rating: opt(row.rating),
    approvedAt: iso(row.approvedAt),
    pickedUpAt: iso(row.pickedUpAt),
    prepMinutes: opt(row.prepMinutes),
    travelMinutes: row.travelMinutes,
    cancelledBy: opt(row.cancelledBy),
    refundedTotal: row.refundedTotal || undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Kurye operasyonu                                                    */
/* ------------------------------------------------------------------ */

export interface OfferRow {
  id: string;
  orderId: string;
  courierId: string;
  createdAt: Date;
  expiresAt: Date;
  respondedAt: Date | null;
  status: DeliveryOffer["status"];
  fee: number;
  pickupKm: number;
  dropoffKm: number;
}

export function toOffer(row: OfferRow): DeliveryOffer {
  return {
    id: row.id,
    orderId: row.orderId,
    courierId: row.courierId,
    createdAt: isoRequired(row.createdAt),
    expiresAt: isoRequired(row.expiresAt),
    status: row.status,
    fee: row.fee,
    pickupKm: row.pickupKm,
    dropoffKm: row.dropoffKm,
  };
}

export interface EarningRow {
  id: string;
  courierId: string;
  orderId: string;
  orderCode: string;
  restaurantName: string;
  fee: number;
  tip: number;
  distanceKm: number;
  durationMinutes: number;
  at: Date;
}

export function toEarning(row: EarningRow): CourierEarning {
  return {
    id: row.id,
    courierId: row.courierId,
    orderId: row.orderId,
    orderCode: row.orderCode,
    restaurantName: row.restaurantName,
    fee: row.fee,
    tip: row.tip,
    distanceKm: row.distanceKm,
    durationMinutes: row.durationMinutes,
    at: isoRequired(row.at),
  };
}

/* ------------------------------------------------------------------ */
/* Katalog dışı kayıtlar                                               */
/* ------------------------------------------------------------------ */

export interface CouponRow {
  code: string;
  type: Coupon["type"];
  value: number;
  title: string;
  description: string;
  minSubtotal: number;
  maxDiscount: number | null;
  restaurantIds: string[] | null;
  firstOrderOnly: boolean;
  expiresAt: Date;
  active: boolean;
  createdAt: Date;
}

export function toCoupon(row: CouponRow): Coupon {
  return {
    code: row.code,
    type: row.type,
    value: row.value,
    title: row.title,
    description: row.description,
    minSubtotal: row.minSubtotal,
    maxDiscount: opt(row.maxDiscount),
    restaurantIds: row.restaurantIds,
    firstOrderOnly: row.firstOrderOnly || undefined,
    expiresAt: isoRequired(row.expiresAt),
    active: row.active,
    createdAt: isoRequired(row.createdAt),
  };
}

export interface BannerRow {
  id: string;
  title: string;
  subtitle: string;
  code: string | null;
  emoji: string;
  image: string | null;
  gradient: string[];
  href: string;
  active: boolean;
  position: number;
}

export function toBanner(row: BannerRow): Banner {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    code: opt(row.code),
    emoji: row.emoji,
    image: opt(row.image),
    gradient: [row.gradient[0], row.gradient[1]],
    href: row.href,
    active: row.active,
  };
}

export interface ReviewRow {
  id: string;
  restaurantId: string;
  orderId: string | null;
  userId: string | null;
  userName: string;
  score: number;
  comment: string | null;
  at: Date;
  reply: string | null;
  repliedAt: Date | null;
}

export function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    orderId: opt(row.orderId),
    userName: row.userName,
    score: row.score,
    comment: row.comment ?? "",
    at: isoRequired(row.at),
    reply: opt(row.reply),
  };
}

export interface PayoutRow {
  id: string;
  kind: Payout["kind"];
  targetId: string;
  targetName: string;
  periodKey: Date | string;
  periodLabel: string;
  orders: number;
  gross: number;
  commission: number;
  tips: number;
  net: number;
  status: Payout["status"];
  approvedAt: Date | null;
  paidAt: Date | null;
}

/**
 * `date` kolonu gün olarak okunur. Sürücü onu UTC gece yarısına çevirdiği
 * için UTC tarihi alınır; sorgular zaten `::text` ile metin döndürür.
 */
function dateOnly(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export function toPayout(row: PayoutRow): Payout {
  return {
    id: row.id,
    kind: row.kind,
    targetId: row.targetId,
    targetName: row.targetName,
    periodKey: dateOnly(row.periodKey),
    periodLabel: row.periodLabel,
    orders: row.orders,
    gross: row.gross,
    commission: row.commission,
    tips: row.tips,
    net: row.net,
    status: row.status,
    approvedAt: iso(row.approvedAt),
    paidAt: iso(row.paidAt),
  };
}

export interface ApplicationRow {
  id: string;
  code: string;
  businessName: string;
  cuisine: PartnerApplication["cuisine"];
  city: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
  branchCount: number;
  contactName: string;
  phone: string;
  email: string;
  taxNumber: string | null;
  hasOwnCourier: boolean;
  monthlyOrders: string | null;
  note: string | null;
  status: PartnerApplication["status"];
  createdAt: Date;
  decidedAt: Date | null;
  rejectionReason: string | null;
  restaurantId: string;
}

export function toApplication(row: ApplicationRow): PartnerApplication {
  return {
    id: row.id,
    code: row.code,
    businessName: row.businessName,
    cuisine: row.cuisine,
    city: row.city,
    district: row.district,
    address: row.address,
    location: point(row.lat, row.lng),
    branchCount: row.branchCount,
    contactName: row.contactName,
    phone: row.phone,
    email: row.email,
    taxNumber: opt(row.taxNumber),
    hasOwnCourier: row.hasOwnCourier,
    monthlyOrders: opt(row.monthlyOrders),
    note: opt(row.note),
    status: row.status,
    createdAt: isoRequired(row.createdAt),
    decidedAt: iso(row.decidedAt),
    rejectionReason: opt(row.rejectionReason),
    restaurantId: row.restaurantId,
  };
}

export interface MediaRow {
  id: string;
  restaurantId: string;
  targetKind: "cover" | "product";
  targetProductId: string | null;
  targetName: string;
  storagePath: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
  note: string | null;
  status: MediaRequest["status"];
  createdAt: Date;
  decidedAt: Date | null;
  decidedBy: string | null;
  rejectReason: string | null;
}

export function toMediaRequest(row: MediaRow): MediaRequest {
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    target:
      row.targetKind === "cover"
        ? { kind: "cover" }
        : { kind: "product", productId: row.targetProductId ?? "" },
    targetName: row.targetName,
    url: row.url,
    width: row.width,
    height: row.height,
    bytes: row.bytes,
    note: opt(row.note),
    status: row.status,
    createdAt: isoRequired(row.createdAt),
    decidedAt: iso(row.decidedAt),
    decidedBy: opt(row.decidedBy),
    rejectReason: opt(row.rejectReason),
  };
}
