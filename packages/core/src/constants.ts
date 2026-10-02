import type {
  Banner,
  Category,
  MealCardBrand,
  OrderStatus,
  PaymentMethodId,
  SortKey,
} from "./types";

/* ------------------------------------------------------------------ */
/* Keşif sabitleri                                                     */
/* ------------------------------------------------------------------ */

/**
 * Mutfaklar. `image` web sunucusunun köküne göre yoldur (`public/images`);
 * mobil istemci kullanacaksa API adresinin önüne eklemesi yeterli.
 */
export const CATEGORIES: Category[] = [
  { id: "all", name: "Tümü", emoji: "🍽️" },
  { id: "top-rated", name: "Puanı Yüksekler", emoji: "⭐" },
  { id: "burger", name: "Burger", emoji: "🍔", image: "/images/food/burger-classic.webp" },
  { id: "kebap", name: "Kebap", emoji: "🥙", image: "/images/food/adana-kebap.webp" },
  { id: "pizza", name: "Pizza", emoji: "🍕", image: "/images/food/pizza-margherita.webp" },
  { id: "tavuk", name: "Tavuk", emoji: "🍗", image: "/images/food/fried-chicken.webp" },
  { id: "cigkofte", name: "Çiğ Köfte", emoji: "🌯", image: "/images/food/cigkofte.webp" },
  { id: "tatli", name: "Tatlı", emoji: "🍰", image: "/images/food/baklava.webp" },
  { id: "saglikli", name: "Sağlıklı", emoji: "🥗", image: "/images/food/buddha-bowl.webp" },
  { id: "kahvalti", name: "Kahvaltı", emoji: "🍳", image: "/images/food/serpme-kahvalti.webp" },
  { id: "uzakdogu", name: "Uzak Doğu", emoji: "🍜", image: "/images/food/sushi-platter.webp" },
  { id: "deniz", name: "Deniz", emoji: "🐟", image: "/images/food/cipura.webp" },
  { id: "evyemekleri", name: "Ev Yemekleri", emoji: "🍲", image: "/images/food/kuru-fasulye.webp" },
  { id: "pide", name: "Pide & Lahmacun", emoji: "🫓", image: "/images/food/lahmacun.webp" },
  { id: "tost", name: "Tost & Sandviç", emoji: "🥪", image: "/images/food/tost-kasarli.webp" },
  { id: "kahve", name: "Kahve", emoji: "☕", image: "/images/food/latte.webp" },
];

export const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "recommended", label: "Önerilen" },
  { id: "rating", label: "Puana göre" },
  { id: "eta", label: "Teslimat süresi" },
  { id: "distance", label: "Mesafe" },
  { id: "minBasket", label: "Min. sepet tutarı" },
];

export const BANNERS: Banner[] = [
  {
    id: "bn_first",
    title: "İlk siparişine 150 ₺ indirim",
    subtitle: "250 ₺ ve üzeri ilk siparişinde geçerli",
    code: "YENI150",
    emoji: "🎉",
    image: "/images/food/banner-first.webp",
    gradient: ["#C4351E", "#DF9411"],
    active: true,
    href: "/?kategori=all",
  },
  {
    id: "bn_free",
    title: "Teslimat bizden",
    subtitle: "Seçili restoranlarda ücretsiz teslimat",
    code: "BEDAVAYOL",
    emoji: "🛵",
    image: "/images/food/banner-free.webp",
    gradient: ["#2E5F3A", "#6FA34A"],
    active: true,
    href: "/?sirala=eta",
  },
  {
    id: "bn_burger",
    title: "Burger Günleri",
    subtitle: "Menülerde %25'e varan indirim",
    code: "BURGER25",
    emoji: "🍔",
    image: "/images/food/banner-burger.webp",
    gradient: ["#3E2029", "#9E2A4A"],
    active: true,
    href: "/?kategori=burger",
  },
  {
    id: "bn_dessert",
    title: "Tatlı krizine çare",
    subtitle: "Tatlıcılarda 2 al 1 öde fırsatları",
    emoji: "🍰",
    image: "/images/food/banner-dessert.webp",
    gradient: ["#8A2246", "#D4538A"],
    active: true,
    href: "/?kategori=tatli",
  },
  {
    id: "bn_healthy",
    title: "Hafif ve doyurucu",
    subtitle: "Sağlıklı mutfaklarda 80 ₺ indirim",
    code: "SAGLIK80",
    emoji: "🥗",
    image: "/images/food/banner-healthy.webp",
    gradient: ["#2F5A3E", "#8FBF5E"],
    active: true,
    href: "/?kategori=saglikli",
  },
];

/* ------------------------------------------------------------------ */
/* Ödeme                                                               */
/* ------------------------------------------------------------------ */

export const PAYMENT_METHODS: Record<
  PaymentMethodId,
  { name: string; description: string; onDelivery: boolean; emoji: string }
> = {
  online_card: {
    name: "Online kredi/banka kartı",
    description: "Kayıtlı kartınla tek dokunuşla öde",
    onDelivery: false,
    emoji: "💳",
  },
  wallet: {
    name: "Sofra Cüzdan",
    description: "Platform bakiyenle öde, iadeler anında yansır",
    onDelivery: false,
    emoji: "👛",
  },
  meal_card: {
    name: "Yemek kartı",
    description: "Multinet, Sodexo, Ticket, Setcard, Metropol",
    onDelivery: false,
    emoji: "🎫",
  },
  card_on_delivery: {
    name: "Kapıda kredi kartı",
    description: "Kurye POS cihazıyla gelir",
    onDelivery: true,
    emoji: "🏧",
  },
  cash_on_delivery: {
    name: "Kapıda nakit",
    description: "Teslimatta nakit ödersin",
    onDelivery: true,
    emoji: "💵",
  },
};

export const PAYMENT_ORDER: PaymentMethodId[] = [
  "online_card",
  "wallet",
  "meal_card",
  "card_on_delivery",
  "cash_on_delivery",
];

export const MEAL_CARD_BRANDS: { id: MealCardBrand; name: string }[] = [
  { id: "multinet", name: "Multinet" },
  { id: "sodexo", name: "Sodexo" },
  { id: "ticket", name: "Ticket Restaurant" },
  { id: "setcard", name: "Setcard" },
  { id: "metropol", name: "Metropol" },
];

/** Sepet tutarı üzerinden alınan platform hizmet bedeli. */
export const SERVICE_FEE = 9.9;

/* ------------------------------------------------------------------ */
/* Sipariş durumları                                                   */
/* ------------------------------------------------------------------ */

export const ORDER_FLOW: OrderStatus[] = [
  "pending_approval",
  "preparing",
  "on_the_way",
  "delivered",
];

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; description: string; emoji: string; tone: string }
> = {
  pending_approval: {
    label: "Onay bekliyor",
    description: "Siparişin restorana iletildi, onay bekleniyor.",
    emoji: "🧾",
    tone: "amber",
  },
  preparing: {
    label: "Hazırlanıyor",
    description: "Restoran siparişini hazırlamaya başladı.",
    emoji: "👨‍🍳",
    tone: "orange",
  },
  on_the_way: {
    label: "Yolda",
    description: "Kurye siparişini aldı ve sana doğru yola çıktı.",
    emoji: "🛵",
    tone: "blue",
  },
  delivered: {
    label: "Teslim edildi",
    description: "Afiyet olsun! Siparişin teslim edildi.",
    emoji: "✅",
    tone: "green",
  },
  cancelled: {
    label: "İptal edildi",
    description: "Sipariş iptal edildi.",
    emoji: "🚫",
    tone: "red",
  },
};

/** Sipariş hangi durumlarda kullanıcı tarafından iptal edilebilir. */
export const CANCELLABLE_STATUSES: OrderStatus[] = [
  "pending_approval",
  "preparing",
];

export const CANCEL_REASONS = [
  "Yanlışlıkla sipariş verdim",
  "Teslimat süresi çok uzun",
  "Adresi değiştirmek istiyorum",
  "Ürünleri değiştirmek istiyorum",
  "Fikrimi değiştirdim",
];

/* ------------------------------------------------------------------ */
/* Adres etiketleri                                                    */
/* ------------------------------------------------------------------ */

export const ADDRESS_LABELS = [
  { id: "ev", name: "Ev", emoji: "🏠" },
  { id: "is", name: "İş", emoji: "🏢" },
  { id: "diger", name: "Diğer", emoji: "📍" },
] as const;

/* ------------------------------------------------------------------ */
/* Harita                                                              */
/* ------------------------------------------------------------------ */

/** Konum bilinmiyorsa kullanılan varsayılan merkez (Kadıköy / İstanbul). */
export const DEFAULT_CENTER = { lat: 40.9903, lng: 29.0273 };

export const APP_NAME = "Sofra";
