/**
 * Sofra — ortak alan modeli (domain model).
 *
 * Bu dosya hem web istemcisi hem de API katmanı tarafından kullanılır.
 * İleride yazılacak mobil uygulama aynı JSON sözleşmesini tükettiği için
 * tipler framework'ten bağımsız tutulmuştur; `@sofra/types` gibi paylaşılan
 * bir pakete olduğu gibi taşınabilir.
 */

/* ------------------------------------------------------------------ */
/* Coğrafya                                                            */
/* ------------------------------------------------------------------ */

export type LatLng = { lat: number; lng: number };

/* ------------------------------------------------------------------ */
/* Kullanıcı & adres                                                   */
/* ------------------------------------------------------------------ */

export type AuthProvider = "phone" | "email" | "google" | "apple";

export type AddressLabel = "ev" | "is" | "diger";

export interface Address {
  id: string;
  userId: string;
  label: AddressLabel;
  title: string;
  /** Açık adres metni (mahalle, cadde, no) */
  line1: string;
  district: string;
  city: string;
  /** Kat / daire / tarif gibi ek bilgiler */
  directions?: string;
  buildingNo?: string;
  floor?: string;
  apartmentNo?: string;
  contactName?: string;
  contactPhone?: string;
  point: LatLng;
  isDefault: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  avatarEmoji: string;
  providers: AuthProvider[];
  /** Platform içi cüzdan bakiyesi (TL) */
  walletBalance: number;
  favoriteRestaurantIds: string[];
  defaultAddressId?: string;
  createdAt: string;

  /** Kara liste (Superadmin) — engelli kullanıcı giriş yapamaz, sipariş veremez */
  blocked?: boolean;
  blockReason?: string;
  blockedAt?: string;
}

/* ------------------------------------------------------------------ */
/* Restoran & menü                                                     */
/* ------------------------------------------------------------------ */

export type CuisineTag =
  | "burger"
  | "kebap"
  | "pizza"
  | "tatli"
  | "saglikli"
  | "tavuk"
  | "cigkofte"
  | "deniz"
  | "kahvalti"
  | "uzakdogu"
  | "evyemekleri"
  | "kahve"
  | "tost"
  | "pide";

export interface Restaurant {
  id: string;
  slug: string;
  name: string;
  /** Kart görselini üreten tohum + emoji (gerçek foto geldiğinde `image` doldurulur) */
  emoji: string;
  coverSeed: string;
  /** Kapak fotoğrafı — site köküne göre yol (ör. `/images/food/lahmacun.webp`) */
  image?: string;
  tags: CuisineTag[];
  description: string;
  rating: number;
  ratingCount: number;
  /** Ortalama hazırlama + yol süresi (dk) */
  etaMin: number;
  etaMax: number;
  minBasket: number;
  deliveryFee: number;
  /** Ücretsiz teslimat eşiği; null ise her zaman ücretli */
  freeDeliveryOver: number | null;
  location: LatLng;
  district: string;
  /** Teslimat yarıçapı (km) — poligon çizilmemişse bölge budur */
  deliveryRadiusKm: number;
  /**
   * Poligon teslimat bölgesi (restoran panelinden çizilir). Tanımlıysa
   * yarıçap yerine adresin bu çokgenin içinde olup olmadığına bakılır.
   */
  deliveryZone?: LatLng[] | null;
  workingHours: { open: string; close: string };
  /** Gun ortasi mola (opsiyonel) */
  breakHours?: { start: string; end: string } | null;
  /** Platformun aldigi komisyon orani (0.12 = %12) — Superadmin belirler */
  commissionRate: number;
  /**
   * Platform onay durumu (Superadmin yönetir).
   * `pending` ve `suspended` restoranlar müşteri uygulamasında görünmez.
   */
  approvalStatus: "pending" | "approved" | "suspended";
  /** Platforma katılma tarihi */
  joinedAt: string;
  /** Restoran yoğunluk sebebiyle siparişe kapalıysa */
  temporarilyClosed: boolean;
  /**
   * true  → siparişler otomatik onaylanır ve akış kendiliğinden ilerler
   * false → her sipariş restoran panelinden elle onaylanır
   */
  autoAccept: boolean;
  /** Otomatik onaylanan siparişlerde bildirilen hazırlık süresi (dk) */
  defaultPrepMinutes?: number;
  /** Platform kuryesi mi yoksa restoran kuryesi mi */
  courierMode: "platform" | "vendor";
  paymentMethods: PaymentMethodId[];
  badges: string[];
  /** Öne çıkanlar sırası (Superadmin) — boşsa öne çıkmaz */
  featuredRank?: number | null;
  /** Tükenen ürün müşteri menüsünde gizlenir ya da soluk görünür */
  soldOutDisplay?: "hide" | "dim";
  menu: MenuCategory[];
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  products: Product[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  emoji: string;
  /** Ürün fotoğrafı; yoksa mutfağa göre renklenen yer tutucu çizilir */
  image?: string;
  price: number;
  /** Üstü çizili eski fiyat (kampanyalı ürünler) */
  oldPrice?: number;
  /** Anlık stok kapatma — Vendor panelinden gelir */
  soldOut?: boolean;
  popular?: boolean;
  /**
   * Varyant / opsiyon ağacı. Esnek JSON modeli: tekli seçim (boyut),
   * çoklu seçim (malzemeler) ve ücretli ekstralar aynı yapıyla ifade edilir.
   */
  optionGroups: OptionGroup[];
}

export interface OptionGroup {
  id: string;
  name: string;
  /** `single` = radio (Boyut), `multi` = checkbox (Malzemeler / Ekstralar) */
  type: "single" | "multi";
  required: boolean;
  /** `multi` gruplar için seçim sınırları */
  minSelect?: number;
  maxSelect?: number;
  options: ProductOption[];
}

export interface ProductOption {
  id: string;
  name: string;
  /** Ürün fiyatına eklenecek fark (0 = ücretsiz) */
  priceDelta: number;
  default?: boolean;
  soldOut?: boolean;
}

/* ------------------------------------------------------------------ */
/* Keşif                                                               */
/* ------------------------------------------------------------------ */

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  /** Kampanya kodu varsa kullanıcıya gösterilir */
  code?: string;
  emoji: string;
  /** Afişin sağında görünen yemek fotoğrafı; yoksa emoji süsü kullanılır */
  image?: string;
  gradient: [string, string];
  href: string;
  /** Vitrinde görünsün mü (Superadmin yönetir) */
  active: boolean;
}

export type CategoryId = CuisineTag | "top-rated" | "all";

export interface Category {
  id: CategoryId;
  name: string;
  emoji: string;
  /** Mutfak rayındaki kutunun fotoğrafı */
  image?: string;
}

export type SortKey =
  | "recommended"
  | "rating"
  | "eta"
  | "distance"
  | "minBasket";

export interface RestaurantListItem
  extends Omit<Restaurant, "menu" | "paymentMethods"> {
  /** Kullanıcı konumuna göre hesaplanan mesafe (km) */
  distanceKm: number;
  /** Kullanıcı adresi teslimat bölgesinde mi */
  deliverable: boolean;
  /** Çalışma saatleri içinde mi */
  open: boolean;
  isFavorite: boolean;
  /** Mesafeye göre düzeltilmiş teslim süresi metni */
  etaText: string;
}

/* ------------------------------------------------------------------ */
/* Sepet                                                               */
/* ------------------------------------------------------------------ */

export interface CartSelection {
  groupId: string;
  groupName: string;
  optionIds: string[];
  optionNames: string[];
  priceDelta: number;
}

export interface CartLine {
  lineId: string;
  productId: string;
  name: string;
  emoji: string;
  image?: string;
  basePrice: number;
  unitPrice: number;
  quantity: number;
  selections: CartSelection[];
  note?: string;
}

/* ------------------------------------------------------------------ */
/* Kupon & ödeme                                                       */
/* ------------------------------------------------------------------ */

export type CouponType = "percent" | "amount" | "free_delivery";

export interface Coupon {
  code: string;
  type: CouponType;
  value: number;
  title: string;
  description: string;
  minSubtotal: number;
  maxDiscount?: number;
  /** null = tüm restoranlar */
  restaurantIds: string[] | null;
  /** Sadece ilk siparişte geçerli */
  firstOrderOnly?: boolean;
  expiresAt: string;
  /** Yayında mı (Superadmin kapatabilir) */
  active: boolean;
  createdAt: string;
}

export type PaymentMethodId =
  | "online_card"
  | "card_on_delivery"
  | "cash_on_delivery"
  | "meal_card"
  | "wallet";

export interface SavedCard {
  id: string;
  userId: string;
  brand: "visa" | "mastercard" | "troy";
  last4: string;
  holder: string;
  expiry: string;
  nickname: string;
}

export type MealCardBrand =
  | "multinet"
  | "sodexo"
  | "ticket"
  | "setcard"
  | "metropol";

/* ------------------------------------------------------------------ */
/* Sipariş                                                             */
/* ------------------------------------------------------------------ */

export type OrderStatus =
  | "pending_approval"
  | "preparing"
  | "on_the_way"
  | "delivered"
  | "cancelled";

export interface OrderTotals {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  serviceFee: number;
  walletUsed: number;
  grandTotal: number;
}

export interface DeliveryPreferences {
  contactless: boolean;
  ringDoorbell: boolean;
  cutlery: boolean;
  note?: string;
}

export type CourierVehicle = "moto" | "bisiklet" | "araba";

/**
 * Siparişe gömülen kurye özeti — müşterinin ve restoranın gördüğü alanlar.
 * Hesap bilgileri (PIN, konum, kazanç) asla buraya sızmaz.
 */
export interface CourierSummary {
  id: string;
  name: string;
  emoji: string;
  vehicle: CourierVehicle;
  rating: number;
  /** Gerçek numarayı gizleyen maskeli hat */
  maskedPhone: string;
}

/** Kurye hesabı — Courier App'in operasyonel durumu. */
export interface Courier extends CourierSummary {
  phone: string;
  /** Vardiya açık mı (Online/Offline) */
  online: boolean;
  shiftStartedAt?: string;
  /** Uygulamadan bildirilen canlı konum */
  point: LatLng;
  /** Vardiya dışındayken döndüğü bölge merkezi */
  homePoint: LatLng;
  ratingSum: number;
  ratingCount: number;
  totalDeliveries: number;
  createdAt: string;
  /**
   * Platform aktivasyon durumu (Superadmin yönetir).
   * `pending` ve `suspended` kuryeler mesaiye başlayamaz.
   */
  status: "pending" | "active" | "suspended";
}

/**
 * Kuryenin sipariş üzerindeki aşaması.
 * Müşterinin gördüğü `OrderStatus` bu aşamalardan türer:
 * `picked_up` → "Yolda", `delivered` → "Teslim edildi".
 */
export type CourierStage =
  | "unassigned"
  | "offered"
  | "assigned"
  | "at_restaurant"
  | "picked_up"
  | "delivered";

/** Teslimatın ayağı: restorana gidiş (`pickup`) ya da müşteriye götürüş (`dropoff`). */
export type RouteLeg = "pickup" | "dropoff";

/**
 * Kuryeye gönderilen, süresi sınırlı teslimat teklifi.
 * Reddedilir veya süresi dolarsa sıradaki en yakın kuryeye geçer.
 */
export interface DeliveryOffer {
  id: string;
  orderId: string;
  courierId: string;
  createdAt: string;
  expiresAt: string;
  status: "pending" | "accepted" | "rejected" | "expired";
  /** Kuryeye ödenecek paket ücreti */
  fee: number;
  /** Restorana olan mesafe (km) */
  pickupKm: number;
  /** Restorandan müşteriye mesafe (km) */
  dropoffKm: number;
}

/** Tamamlanan bir teslimatın kurye kazancı. */
export interface CourierEarning {
  id: string;
  courierId: string;
  orderId: string;
  orderCode: string;
  restaurantName: string;
  /** Paket başı ücret */
  fee: number;
  /** Müşterinin bıraktığı bahşiş */
  tip: number;
  distanceKm: number;
  /** Teslim alma → teslim etme süresi (dk) */
  durationMinutes: number;
  at: string;
}

export interface OrderTimelineEntry {
  status: OrderStatus;
  at: string;
  note?: string;
}

export interface OrderRating {
  restaurantScore: number;
  restaurantComment?: string;
  courierScore?: number;
  courierComment?: string;
  /** Kuryeye bırakılan bahşiş (cüzdandan ödenir) */
  courierTip?: number;
  createdAt: string;
}

export interface Order {
  id: string;
  code: string;
  userId: string;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  restaurantEmoji: string;
  /** Restoranın kapak fotoğrafı (sipariş anındaki) */
  restaurantImage?: string;
  restaurantLocation: LatLng;
  address: Address;
  lines: CartLine[];
  totals: OrderTotals;
  paymentMethod: PaymentMethodId;
  paymentLabel: string;
  couponCode?: string;
  preferences: DeliveryPreferences;
  status: OrderStatus;
  timeline: OrderTimelineEntry[];
  courier?: CourierSummary;
  courierMode: "platform" | "vendor";
  /** Kuryenin sipariş üzerindeki aşaması (yalnızca platform kuryesinde) */
  courierStage?: CourierStage;
  /** Kuryenin restorana vardığı an */
  courierArrivedAt?: string;
  /** Restoranın "sipariş hazır" bildirdiği an */
  readyAt?: string;
  /** Kuryeye ödenecek paket ücreti */
  courierFee?: number;
  /** Kuryenin cihazından gelen canlı konum (yalnızca platform kuryesinde) */
  courierPoint?: LatLng;
  /** Kurye konumunun son geldiği an — eskiyse harita "güncellenemiyor" der */
  courierLocatedAt?: string;
  /**
   * Kuryenin şu anki ayağının yol çizgisi (yol tarifi servisinden): önce
   * kurye → restoran, sonra restoran → adres; kurye saparsa bulunduğu
   * yerden yenisi. Ayak değişince yenisi gelene kadar eskisi kullanılmaz
   * (bkz. `currentRoute`).
   */
  courierRoute?: LatLng[];
  /** `courierRoute`'un ait olduğu ayak */
  courierRouteLeg?: RouteLeg;
  /** Rotanın yol mesafesi (m) */
  courierRouteDistanceM?: number;
  /** Yol tarifi servisinin rota için verdiği süre (sn, trafiksiz) */
  courierRouteDurationS?: number;
  createdAt: string;
  /** Tahmini teslim zamanı (ISO) */
  etaAt: string;
  deliveredAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  rating?: OrderRating;

  /* --- Restoran paneli (Vendor Dashboard) --------------------------- */

  /** Restoranın siparişi onayladığı an */
  approvedAt?: string;
  /** Kuryenin siparişi restorandan aldığı an */
  pickedUpAt?: string;
  /** Restoranın bildirdiği hazırlık süresi (dakika) */
  prepMinutes?: number;
  /** Restorandan adrese kuryenin yol süresi (dakika, mesafeden hesaplanır) */
  travelMinutes: number;
  /** İptali kim başlattı */
  cancelledBy?: "user" | "vendor" | "support";
  /** Bu siparişe yapılan iadelerin toplamı (sipariş tutarını aşamaz) */
  refundedTotal?: number;
}

/* ------------------------------------------------------------------ */
/* Restoran başvurusu (İş Ortaklığı)                                   */
/* ------------------------------------------------------------------ */

/**
 * Bir restoranın platforma katılma başvurusu.
 *
 * Başvuru alındığında iki kayıt oluşur: bu form kaydı ve `approvalStatus`
 * `pending` olan bir restoran taslağı. Taslak, yöneticinin zaten kullandığı
 * onay kuyruğuna düşer — ayrı bir kuyruk yok. Yönetici onayladığında
 * restoran yayına alınır ve işletmeye panel girişi açılır.
 */
export interface PartnerApplication {
  id: string;
  /** Başvuru sahibinin durumunu sorgulayacağı referans: SF-BV-4H2K */
  code: string;

  /* İşletme */
  businessName: string;
  cuisine: CuisineTag;
  city: string;
  district: string;
  address: string;
  /** Haritadan seçilen konum */
  location: LatLng;
  branchCount: number;

  /* Yetkili kişi */
  contactName: string;
  phone: string;
  email: string;

  /* İşletme bilgileri */
  taxNumber?: string;
  /** Kendi kuryesi var mı — yoksa platform kuryesi atanır */
  hasOwnCourier: boolean;
  /** Aylık tahmini sipariş adedi (serbest metin, isteğe bağlı) */
  monthlyOrders?: string;
  note?: string;

  /* Durum */
  status: PartnerApplicationStatus;
  createdAt: string;
  decidedAt?: string;
  /** Reddedildiyse gerekçe */
  rejectionReason?: string;
  /** Başvurudan oluşan restoran taslağının kimliği */
  restaurantId: string;
}

export type PartnerApplicationStatus =
  | "received"
  | "approved"
  | "rejected";

/* ------------------------------------------------------------------ */
/* Restoran paneli hesabı                                              */
/* ------------------------------------------------------------------ */

export interface VendorAccount {
  id: string;
  restaurantId: string;
  name: string;
  email: string;
  role?: "owner" | "staff";
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Fotoğraf talepleri                                                  */
/* ------------------------------------------------------------------ */

/** Talebin neyin fotoğrafı olduğu: restoranın kapağı ya da bir ürün. */
export type MediaTarget =
  | { kind: "cover" }
  | { kind: "product"; productId: string };

/**
 * Restoranın panelden gönderdiği fotoğraf.
 *
 * Yüklenen fotoğraf doğrudan yayına girmez: yönetici onaylayınca kapağa
 * ya da ürüne işlenir. Reddedilen talep gerekçesiyle restorana görünür.
 */
export interface MediaRequest {
  id: string;
  restaurantId: string;
  target: MediaTarget;
  /** Talep anındaki hedef adı (ürün adı ya da "Kapak fotoğrafı") */
  targetName: string;
  /** Site köküne göre adres, ör. `/media/med_x1y2.webp` */
  url: string;
  width: number;
  height: number;
  /** İşlenmiş dosyanın boyutu (bayt) */
  bytes: number;
  /** Restoranın yöneticiye notu */
  note?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  decidedAt?: string;
  /** Kararı veren yöneticinin adı */
  decidedBy?: string;
  rejectReason?: string;
}

/* ------------------------------------------------------------------ */
/* Değerlendirmeler                                                    */
/* ------------------------------------------------------------------ */

export interface Review {
  id: string;
  restaurantId: string;
  orderId?: string;
  userName: string;
  score: number;
  comment: string;
  at: string;
  /** Restoran panelinden verilen cevap */
  reply?: string;
}

/* ------------------------------------------------------------------ */
/* Destek                                                              */
/* ------------------------------------------------------------------ */

export interface SupportQuickReply {
  id: string;
  label: string;
}

/** Bildirim kutusundaki bir kayıt (sipariş durumu, kampanya, sistem). */
export interface AppNotification {
  id: string;
  kind: "order" | "campaign" | "system";
  title: string;
  body: string;
  /** Tıklanınca açılacak sayfa */
  href?: string;
  readAt?: string;
  createdAt: string;
}

export interface SupportMessage {
  id: string;
  role: "bot" | "user" | "agent";
  text: string;
  at: string;
  /** Temsilci mesajlarında temsilcinin adı */
  authorName?: string;
  quickReplies?: SupportQuickReply[];
}

export interface SupportSession {
  id: string;
  userId: string;
  orderId?: string;
  messages: SupportMessage[];
  /** Temsilci kuyruğunda ya da temsilciyle görüşüyor */
  escalated: boolean;
  status?: "bot" | "waiting_agent" | "with_agent" | "closed";
}


/* ------------------------------------------------------------------ */
/* Yönetici paneli (Superadmin)                                        */
/* ------------------------------------------------------------------ */

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

/** Restoran ve kuryelere yapılacak haftalık hakediş kaydı. */
export interface Payout {
  id: string;
  kind: "vendor" | "courier";
  /** restaurantId veya courierId */
  targetId: string;
  targetName: string;
  /** Hafta başlangıcı (pazartesi, YYYY-MM-DD) */
  periodKey: string;
  periodLabel: string;
  orders: number;
  /** Restoranda brüt ciro, kuryede paket ücretleri toplamı */
  gross: number;
  /** Yalnızca restoranda: platform komisyonu */
  commission: number;
  /** Yalnızca kuryede: bahşiş toplamı */
  tips: number;
  /** Ödenecek net tutar */
  net: number;
  status: "pending" | "approved" | "paid";
  approvedAt?: string;
  paidAt?: string;
}

/** Bölge veya segmente gönderilen push bildirimi. */
export interface PushCampaign {
  id: string;
  title: string;
  body: string;
  segment: "all" | "active" | "lapsed" | "new";
  /** Boşsa tüm bölgeler */
  districts: string[];
  recipientCount: number;
  sentAt: string;
}

/** Manuel yönetici işlemlerinin izi. */
export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  detail?: string;
  at: string;
}

/* ------------------------------------------------------------------ */
/* API zarfı                                                           */
/* ------------------------------------------------------------------ */

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: string; message: string } };
export type ApiResponse<T> = ApiOk<T> | ApiErr;
