import fs from "node:fs";
import path from "node:path";
import type {
  Address,
  AdminAccount,
  AuditEntry,
  Banner,
  Coupon,
  Courier,
  CourierEarning,
  CourierSummary,
  DeliveryOffer,
  MediaRequest,
  Order,
  PartnerApplication,
  Payout,
  PushCampaign,
  Restaurant,
  Review,
  SavedCard,
  SupportSession,
  User,
  VendorAccount,
} from "../types";
import { BANNERS } from "../constants";
import {
  adminSeed,
  COUPONS,
  COURIERS,
  DEMO_ADDRESS,
  DEMO_CARDS,
  DEMO_USER,
  RESTAURANTS,
  vendorSeed,
} from "./seed";

/**
 * Bellek içi veri deposu.
 *
 * Prototip aşamasında Postgres yerine tek bir JSON dosyası kullanıyoruz.
 * Tüm okuma/yazma bu modülden geçtiği için ileride `lib/db/store.ts`
 * içeriğini Prisma/Drizzle repository'leriyle değiştirmek yeterli olacak;
 * API route'ları değişmeyecek.
 */

export type { Review };

export interface OtpChallenge {
  id: string;
  channel: "phone" | "email";
  /** Telefon numarası veya e-posta */
  target: string;
  code: string;
  expiresAt: number;
  attempts: number;
}

export interface Database {
  /**
   * Restoran katalogu artik degistirilebilir: Vendor Dashboard menu,
   * fiyat, stok ve magaza ayarlarini bu listede gunceller.
   */
  restaurants: Restaurant[];
  vendors: VendorAccount[];
  /** Restoran katılım başvuruları — onay kuyruğuna bağlıdır */
  applications: PartnerApplication[];
  /** Restoranların gönderdiği fotoğraflar — yönetici onayıyla yayına girer */
  mediaRequests: MediaRequest[];
  /** Kurye hesaplari — Courier App vardiya, konum ve asama yazar */
  couriers: Courier[];
  admins: AdminAccount[];
  /** Kampanya kodları — Superadmin yönetir */
  coupons: Coupon[];
  /** Uygulama içi vitrin afişleri — Superadmin yönetir */
  banners: Banner[];
  /** Restoran ve kurye hakedişleri, onay akışıyla */
  payouts: Payout[];
  /** Gönderilen push bildirimleri */
  pushCampaigns: PushCampaign[];
  /** Manuel yönetici işlemlerinin izi */
  audit: AuditEntry[];
  /** Kuryelere gonderilen, suresi sinirli teslimat teklifleri */
  offers: DeliveryOffer[];
  /** Tamamlanan teslimatlarin kurye kazanclari */
  earnings: CourierEarning[];
  users: User[];
  addresses: Address[];
  orders: Order[];
  cards: SavedCard[];
  reviews: Review[];
  support: SupportSession[];
  otps: OtpChallenge[];
  /** Kullanıcı başına kullanılmış kupon kodları */
  couponUsage: { userId: string; code: string; at: string }[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "db.json");

/* ------------------------------------------------------------------ */
/* Tohumlama                                                           */
/* ------------------------------------------------------------------ */

function seededReviews(): Review[] {
  const templates: [number, string][] = [
    [5, "Sıcacık geldi, porsiyonlar bol. Kesinlikle tekrar sipariş vereceğim."],
    [5, "Tam zamanında teslim edildi, paketleme çok özenliydi."],
    [4, "Lezzet güzeldi ama biraz geç geldi. Yine de memnunum."],
    [5, "Fiyat performans olarak bölgedeki en iyi seçenek."],
    [4, "Sos ekstra istemiştim, unutulmamış. Teşekkürler."],
    [3, "Ürünler iyiydi fakat içecek eksik gelmişti, destek hızlı çözdü."],
    [5, "Ailecek çok beğendik, porsiyonlar cömert."],
    [4, "Kurye çok nazikti, temassız teslimat talebime uydu."],
  ];
  const names = [
    "Ayşe K.",
    "Mehmet D.",
    "Zeynep A.",
    "Can B.",
    "Elif T.",
    "Ozan Y.",
    "Selin M.",
    "Emre Ş.",
    "Büşra N.",
    "Kerem O.",
  ];
  const out: Review[] = [];
  RESTAURANTS.forEach((r, ri) => {
    const count = 4 + (ri % 3);
    for (let i = 0; i < count; i++) {
      const [score, comment] = templates[(ri * 3 + i) % templates.length];
      out.push({
        id: `rev_${r.id}_${i}`,
        restaurantId: r.id,
        userName: names[(ri * 2 + i) % names.length],
        score,
        comment,
        at: new Date(Date.now() - (i + 1) * 86400000 * (1 + (ri % 4))).toISOString(),
        reply:
          i === 0
            ? "Değerlendirmeniz için teşekkür ederiz, yine bekleriz! 🧡"
            : undefined,
      });
    }
  });
  return out;
}

function emptyDatabase(): Database {
  const now = new Date().toISOString();
  const demoUser: User = {
    ...DEMO_USER,
    providers: ["phone", "email"],
    favoriteRestaurantIds: ["rst_kasap", "rst_sekerli"],
    defaultAddressId: DEMO_ADDRESS.id,
    createdAt: now,
  };
  const demoAddress: Address = {
    ...DEMO_ADDRESS,
    userId: demoUser.id,
    isDefault: true,
    contactName: demoUser.name,
    contactPhone: demoUser.phone,
    createdAt: now,
  };
  const demoCards: SavedCard[] = DEMO_CARDS.map((c) => ({
    ...c,
    userId: demoUser.id,
  }));

  return {
    restaurants: structuredClone(RESTAURANTS) as Restaurant[],
    vendors: vendorSeed(),
    applications: [],
    mediaRequests: [],
    couriers: structuredClone(COURIERS) as Courier[],
    admins: adminSeed(),
    coupons: structuredClone(COUPONS) as Coupon[],
    banners: structuredClone(BANNERS) as Banner[],
    payouts: [],
    pushCampaigns: [],
    audit: [],
    offers: [],
    earnings: [],
    users: [demoUser],
    addresses: [demoAddress],
    orders: [],
    cards: demoCards,
    reviews: seededReviews(),
    support: [],
    otps: [],
    couponUsage: [],
  };
}

/**
 * Fotoğraflar tohuma sonradan eklendi; daha önce oluşmuş bir db.json'da bu
 * alanlar yok. Restoran, ürün ve afişleri kimliklerinden eşleyip eksik
 * görseli tohumdan tamamlar. Satıcının ya da yöneticinin kendi eklediği
 * kayıtlara dokunulmaz — onların tohumda karşılığı yoktur.
 */
function backfillPhotos(data: Database): Database {
  const seedRestaurants = new Map(RESTAURANTS.map((r) => [r.id, r]));
  for (const restaurant of data.restaurants) {
    const seed = seedRestaurants.get(restaurant.id);
    if (!seed) continue;
    restaurant.image ??= seed.image;
    const seedProducts = new Map(
      seed.menu.flatMap((c) => c.products).map((p) => [p.id, p.image])
    );
    for (const category of restaurant.menu) {
      for (const product of category.products) {
        product.image ??= seedProducts.get(product.id);
      }
    }
  }

  const seedBanners = new Map(BANNERS.map((b) => [b.id, b.image]));
  for (const banner of data.banners) {
    banner.image ??= seedBanners.get(banner.id);
  }

  // Fotoğraflardan önce verilmiş siparişler de liste ve takip ekranında
  // restoranın fotoğrafıyla görünsün
  const photos = new Map(data.restaurants.map((r) => [r.id, r.image]));
  for (const order of data.orders) {
    order.restaurantImage ??= photos.get(order.restaurantId);
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* Kalıcılık                                                           */
/* ------------------------------------------------------------------ */

function load(): Database {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      const parsed = JSON.parse(raw) as Partial<Database>;
      const base = emptyDatabase();
      return backfillPhotos({
        restaurants: parsed.restaurants ?? base.restaurants,
        vendors: parsed.vendors ?? base.vendors,
        applications: parsed.applications ?? base.applications,
        mediaRequests: parsed.mediaRequests ?? [],
        couriers: parsed.couriers ?? base.couriers,
        admins: parsed.admins ?? base.admins,
        coupons: parsed.coupons ?? base.coupons,
        banners: parsed.banners ?? base.banners,
        payouts: parsed.payouts ?? [],
        pushCampaigns: parsed.pushCampaigns ?? [],
        audit: parsed.audit ?? [],
        offers: parsed.offers ?? [],
        earnings: parsed.earnings ?? [],
        users: parsed.users ?? base.users,
        addresses: parsed.addresses ?? base.addresses,
        orders: parsed.orders ?? [],
        cards: parsed.cards ?? base.cards,
        // Yorumlar tohumdan gelir; kullanıcı yorumları üzerine eklenir.
        reviews: parsed.reviews ?? base.reviews,
        support: parsed.support ?? [],
        otps: parsed.otps ?? [],
        couponUsage: parsed.couponUsage ?? [],
      });
    }
  } catch (err) {
    console.warn("[sofra/db] db.json okunamadı, yeniden tohumlanıyor:", err);
  }
  return emptyDatabase();
}

let writeTimer: NodeJS.Timeout | null = null;

function persist(db: Database) {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
    } catch (err) {
      console.warn("[sofra/db] db.json yazılamadı:", err);
    }
  }, 250);
}

/* ------------------------------------------------------------------ */
/* Tekil örnek (HMR güvenli)                                           */
/* ------------------------------------------------------------------ */

const globalRef = globalThis as unknown as { __sofraDb?: Database };

export function db(): Database {
  if (!globalRef.__sofraDb) {
    globalRef.__sofraDb = load();
  }
  return globalRef.__sofraDb;
}

/** Mutasyon sonrası çağrılır — diske yazmayı tetikler. */
export function commit(): void {
  persist(db());
}

/** Test/geliştirme için deposu sıfırlar. */
export function resetDatabase(): void {
  globalRef.__sofraDb = emptyDatabase();
  commit();
}

/* ------------------------------------------------------------------ */
/* Statik katalog erişimi                                              */
/* ------------------------------------------------------------------ */

/**
 * Restoran kataloğu. Vendor Dashboard menü, fiyat, stok ve mağaza
 * ayarlarını doğrudan bu listede günceller; müşteri uygulaması aynı
 * listeden okur, böylece değişiklik anında yayına girer.
 */
export function allRestaurants(): Restaurant[] {
  return db().restaurants;
}

/**
 * Müşteri uygulamasının gördüğü katalog: yalnızca platform onayı almış
 * restoranlar. Onay bekleyen ve askıya alınanlar listelenmez.
 */
export function publishedRestaurants(): Restaurant[] {
  return db().restaurants.filter((r) => r.approvalStatus === "approved");
}

export function findRestaurant(idOrSlug: string): Restaurant | undefined {
  return allRestaurants().find((r) => r.id === idOrSlug || r.slug === idOrSlug);
}

/* ------------------------------------------------------------------ */
/* Restoran paneli hesapları                                           */
/* ------------------------------------------------------------------ */

export function allVendors(): VendorAccount[] {
  return db().vendors;
}

export function findVendorById(id: string): VendorAccount | undefined {
  return db().vendors.find((v) => v.id === id);
}

export function findVendorByRestaurant(
  restaurantId: string
): VendorAccount | undefined {
  return db().vendors.find((v) => v.restaurantId === restaurantId);
}

export function findReview(id: string): Review | undefined {
  return db().reviews.find((r) => r.id === id);
}

/**
 * Kampanya kodları ve vitrin afişleri artık değiştirilebilir:
 * Superadmin panelinden oluşturulur, düzenlenir ve yayından kaldırılır.
 */
export function allCoupons(): Coupon[] {
  return db().coupons;
}

export function findCoupon(code: string): Coupon | undefined {
  const normalized = code.trim().toUpperCase();
  return db().coupons.find((c) => c.code.toUpperCase() === normalized);
}

export function allBanners(): Banner[] {
  return db().banners;
}

/** Müşteri uygulamasında gösterilecek yayındaki afişler. */
export function activeBanners(): Banner[] {
  return db().banners.filter((b) => b.active);
}

/* ------------------------------------------------------------------ */
/* Yönetici                                                            */
/* ------------------------------------------------------------------ */

export function allAdmins(): AdminAccount[] {
  return db().admins;
}

export function findAdminById(id: string): AdminAccount | undefined {
  return db().admins.find((a) => a.id === id);
}

/** Manuel yönetici işlemini iz kaydına yazar. */
export function recordAudit(
  actor: string,
  action: string,
  target: string,
  detail?: string
): void {
  db().audit.unshift({
    id: `aud_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    actor,
    action,
    target,
    detail,
    at: new Date().toISOString(),
  });
  // İz kaydını son 200 işlemle sınırla
  if (db().audit.length > 200) db().audit.length = 200;
  commit();
}

/* ------------------------------------------------------------------ */
/* Kuryeler                                                            */
/* ------------------------------------------------------------------ */

export function couriers(): Courier[] {
  return db().couriers;
}

export function findCourier(id: string): Courier | undefined {
  return db().couriers.find((c) => c.id === id);
}

export function findCourierByPhone(phone: string): Courier | undefined {
  const normalized = phone.replace(/\D/g, "").slice(-10);
  return db().couriers.find(
    (c) => c.phone.replace(/\D/g, "").slice(-10) === normalized
  );
}

/** Siparişe gömülecek güvenli kurye gösterimi — PIN ve konum sızmaz. */
export function toCourierSummary(courier: Courier): CourierSummary {
  return {
    id: courier.id,
    name: courier.name,
    emoji: courier.emoji,
    vehicle: courier.vehicle,
    rating: courier.rating,
    maskedPhone: courier.maskedPhone,
  };
}

export function offersOf(courierId: string): DeliveryOffer[] {
  return db().offers.filter((o) => o.courierId === courierId);
}

export function earningsOf(courierId: string): CourierEarning[] {
  return db()
    .earnings.filter((e) => e.courierId === courierId)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

/* ------------------------------------------------------------------ */
/* Sorgu yardımcıları                                                  */
/* ------------------------------------------------------------------ */

export function findUserById(id: string): User | undefined {
  return db().users.find((u) => u.id === id);
}

export function findUserByPhone(phone: string): User | undefined {
  const normalized = phone.replace(/\D/g, "").slice(-10);
  return db().users.find(
    (u) => u.phone && u.phone.replace(/\D/g, "").slice(-10) === normalized
  );
}

export function findUserByEmail(email: string): User | undefined {
  const normalized = email.trim().toLowerCase();
  return db().users.find((u) => u.email?.toLowerCase() === normalized);
}

export function addressesOf(userId: string): Address[] {
  return db()
    .addresses.filter((a) => a.userId === userId)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
}

export function findAddress(userId: string, addressId: string) {
  return db().addresses.find((a) => a.id === addressId && a.userId === userId);
}

export function ordersOf(userId: string): Order[] {
  return db()
    .orders.filter((o) => o.userId === userId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export function findOrder(orderId: string): Order | undefined {
  return db().orders.find((o) => o.id === orderId);
}

export function cardsOf(userId: string): SavedCard[] {
  return db().cards.filter((c) => c.userId === userId);
}

export function reviewsOf(restaurantId: string): Review[] {
  return db()
    .reviews.filter((r) => r.restaurantId === restaurantId)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function supportSessionOf(
  userId: string,
  sessionId?: string
): SupportSession | undefined {
  if (sessionId) {
    return db().support.find((s) => s.id === sessionId && s.userId === userId);
  }
  return db().support.find((s) => s.userId === userId);
}
