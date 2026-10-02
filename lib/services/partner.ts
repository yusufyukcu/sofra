import { CATEGORIES } from "../constants";
import type {
  CuisineTag,
  LatLng,
  PartnerApplication,
  Restaurant,
} from "../types";
import {
  createApplicationCode,
  createId,
  isValidEmail,
  isValidPhone,
  isValidTaxNumber,
  normalizePhone,
  slugify,
} from "../utils";
import { DomainError } from "../errors";
import { commit, db } from "../db/store";
import { VENDOR_PIN } from "../db/seed";

/**
 * Restoran katılım başvuruları.
 *
 * Akış tek kuyrukta toplanır: başvuru alındığında hem form kaydı hem
 * `approvalStatus: "pending"` bir restoran taslağı oluşur. Taslak,
 * yöneticinin zaten kullandığı onay kuyruğuna düşer — ayrı bir ekran yok.
 *
 * Onaylandığında restoran yayına alınır ve işletmeye panel girişi açılır.
 * Yeni restoranın menüsü boş olduğu için taslak `temporarilyClosed` olarak
 * doğar: müşteri listesinde "mola veriyor" görünür, işletme menüsünü
 * hazırlayıp mağazayı kendisi açar. Boş menülü bir restoranın sipariş
 * alabilir görünmesi kullanıcıyı yanıltırdı.
 */

/** Başvuruyla açılan restoranın varsayılan komisyon oranı. */
export const DEFAULT_COMMISSION_RATE = 0.12;

/** Yeni restoranın varsayılan teslimat yarıçapı (km). */
const DEFAULT_RADIUS_KM = 6;

export interface ApplicationInput {
  businessName?: string;
  cuisine?: string;
  city?: string;
  district?: string;
  address?: string;
  location?: LatLng;
  branchCount?: number;
  contactName?: string;
  phone?: string;
  email?: string;
  taxNumber?: string;
  hasOwnCourier?: boolean;
  monthlyOrders?: string;
  note?: string;
}

const CUISINE_IDS = new Set(
  CATEGORIES.filter((c) => c.id !== "all" && c.id !== "top-rated").map(
    (c) => c.id
  )
);

function emojiFor(cuisine: CuisineTag): string {
  return CATEGORIES.find((c) => c.id === cuisine)?.emoji ?? "🍽️";
}

function text(value: string | undefined, min: number, max: number): string | null {
  const trimmed = (value ?? "").trim().replace(/\s+/g, " ");
  if (trimmed.length < min || trimmed.length > max) return null;
  return trimmed;
}

/** Aynı ada sahip restoran varsa sonuna sayı ekler. */
function uniqueSlug(name: string): string {
  const base = slugify(name) || "restoran";
  const taken = new Set(db().restaurants.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i += 1) {
    if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/* ------------------------------------------------------------------ */
/* Başvuru                                                             */
/* ------------------------------------------------------------------ */

export function submitApplication(input: ApplicationInput): PartnerApplication {
  /* --- Doğrulama --- */

  const businessName = text(input.businessName, 2, 80);
  if (!businessName) {
    throw new DomainError("invalid_business_name", "İşletme adını gir (en az 2 karakter).");
  }

  const cuisine = (input.cuisine ?? "").trim();
  if (!CUISINE_IDS.has(cuisine as CuisineTag)) {
    throw new DomainError("invalid_cuisine", "Bir mutfak türü seç.");
  }

  const city = text(input.city, 2, 40);
  if (!city) throw new DomainError("invalid_city", "Şehir bilgisi gerekli.");

  const district = text(input.district, 2, 40);
  if (!district) throw new DomainError("invalid_district", "İlçe bilgisi gerekli.");

  const address = text(input.address, 10, 200);
  if (!address) {
    throw new DomainError("invalid_address", "Açık adresi gir (en az 10 karakter).");
  }

  const location = input.location;
  if (
    !location ||
    !Number.isFinite(location.lat) ||
    !Number.isFinite(location.lng) ||
    (location.lat === 0 && location.lng === 0)
  ) {
    throw new DomainError("invalid_location", "Haritadan işletmenin konumunu seç.");
  }

  const contactName = text(input.contactName, 2, 60);
  if (!contactName) {
    throw new DomainError("invalid_contact_name", "Yetkili adını gir.");
  }

  if (!isValidPhone(input.phone ?? "")) {
    throw new DomainError(
      "invalid_phone",
      "Geçerli bir cep telefonu numarası gir (5XX XXX XX XX)."
    );
  }
  const phone = normalizePhone(input.phone ?? "");

  if (!isValidEmail(input.email ?? "")) {
    throw new DomainError("invalid_email", "Geçerli bir e-posta adresi gir.");
  }
  const email = (input.email ?? "").trim().toLowerCase();

  const taxNumber = (input.taxNumber ?? "").replace(/\D/g, "");
  if (taxNumber && !isValidTaxNumber(taxNumber)) {
    throw new DomainError(
      "invalid_tax_number",
      "Vergi numarası 10, T.C. kimlik numarası 11 haneli olmalı."
    );
  }

  const branchCount = Math.max(1, Math.min(999, Math.round(input.branchCount ?? 1)));

  /* --- Mükerrer başvuru --- */

  const store = db();
  const pending = store.applications.find(
    (a) =>
      a.status === "received" &&
      (a.phone === phone || a.email === email)
  );
  if (pending) {
    throw new DomainError(
      "application_exists",
      `Bu iletişim bilgisiyle değerlendirme aşamasında bir başvuru var (${pending.code}).`
    );
  }

  /* --- Restoran taslağı --- */

  const restaurant: Restaurant = {
    id: createId("rst"),
    slug: uniqueSlug(businessName),
    name: businessName,
    emoji: emojiFor(cuisine as CuisineTag),
    coverSeed: createId("cov"),
    tags: [cuisine as CuisineTag],
    description: `${district}, ${city} · ${
      CATEGORIES.find((c) => c.id === cuisine)?.name ?? "Restoran"
    }`,
    rating: 0,
    ratingCount: 0,
    etaMin: 25,
    etaMax: 40,
    minBasket: 150,
    deliveryFee: 29.9,
    freeDeliveryOver: null,
    location,
    district,
    deliveryRadiusKm: DEFAULT_RADIUS_KM,
    workingHours: { open: "10:00", close: "22:00" },
    approvalStatus: "pending",
    joinedAt: new Date().toISOString(),
    commissionRate: DEFAULT_COMMISSION_RATE,
    // Menü boş doğuyor: onaylansa bile işletme menüsünü hazırlayıp
    // mağazayı kendisi açana kadar sipariş alamaz.
    temporarilyClosed: true,
    autoAccept: true,
    courierMode: input.hasOwnCourier ? "vendor" : "platform",
    paymentMethods: [
      "online_card",
      "wallet",
      "meal_card",
      "card_on_delivery",
      "cash_on_delivery",
    ],
    badges: ["Yeni"],
    menu: [],
  };

  const application: PartnerApplication = {
    id: createId("app"),
    code: createApplicationCode(),
    businessName,
    cuisine: cuisine as CuisineTag,
    city,
    district,
    address,
    location,
    branchCount,
    contactName,
    phone,
    email,
    taxNumber: taxNumber || undefined,
    hasOwnCourier: Boolean(input.hasOwnCourier),
    monthlyOrders: text(input.monthlyOrders, 1, 40) ?? undefined,
    note: text(input.note, 1, 500) ?? undefined,
    status: "received",
    createdAt: new Date().toISOString(),
    restaurantId: restaurant.id,
  };

  store.restaurants.push(restaurant);
  store.applications.push(application);
  commit();

  return application;
}

/* ------------------------------------------------------------------ */
/* Durum sorgusu                                                       */
/* ------------------------------------------------------------------ */

export interface ApplicationStatusView {
  code: string;
  businessName: string;
  status: PartnerApplication["status"];
  createdAt: string;
  decidedAt?: string;
  rejectionReason?: string;
  /** Onaylandıysa işletme panelinin adresi */
  panelUrl?: string;
  /** Onaylandıysa restoran kimliği (panel girişinde seçilir) */
  restaurantId?: string;
}

/**
 * Referans koduyla başvuru durumu.
 *
 * Yalnızca başvuranın gördüğü alanlar döner; telefon, e-posta ve vergi
 * numarası burada yer almaz — kod tahmin edilebilir olmasa da kişisel
 * bilgiyi kod bilene açmanın gereği yok.
 */
export function applicationStatus(code: string): ApplicationStatusView {
  const normalized = code.trim().toUpperCase();
  const application = db().applications.find(
    (a) => a.code.toUpperCase() === normalized
  );

  if (!application) {
    throw new DomainError(
      "application_not_found",
      "Bu referans koduyla bir başvuru bulunamadı.",
      404
    );
  }

  return {
    code: application.code,
    businessName: application.businessName,
    status: application.status,
    createdAt: application.createdAt,
    decidedAt: application.decidedAt,
    rejectionReason: application.rejectionReason,
    panelUrl: application.status === "approved" ? "/isletme/giris" : undefined,
    restaurantId:
      application.status === "approved" ? application.restaurantId : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Onay kuyruğuyla bağ                                                 */
/* ------------------------------------------------------------------ */

/** Bir restoran taslağına ait başvuru (yönetim panelinde gösterilir). */
export function applicationForRestaurant(
  restaurantId: string
): PartnerApplication | undefined {
  return db().applications.find((a) => a.restaurantId === restaurantId);
}

/**
 * Yönetici onay kuyruğunda karar verdiğinde başvuru kaydını da günceller
 * ve onaylanan işletmeye panel girişi açar.
 *
 * `setRestaurantApproval` bu fonksiyonu çağırır; başvurudan gelmeyen
 * restoranlarda sessizce hiçbir şey yapmaz.
 */
export function syncApplicationDecision(
  restaurantId: string,
  approval: Restaurant["approvalStatus"],
  reason?: string
): void {
  const store = db();
  const application = store.applications.find(
    (a) => a.restaurantId === restaurantId
  );
  if (!application) return;

  if (approval === "approved" && application.status !== "approved") {
    application.status = "approved";
    application.decidedAt = new Date().toISOString();
    application.rejectionReason = undefined;
    ensureVendorAccount(restaurantId, application);
  }

  if (approval === "suspended" && application.status === "received") {
    application.status = "rejected";
    application.decidedAt = new Date().toISOString();
    application.rejectionReason = reason;
  }
}

/** Onaylanan işletmeye panel hesabı açar (varsa dokunmaz). */
function ensureVendorAccount(
  restaurantId: string,
  application: PartnerApplication
): void {
  const store = db();
  if (store.vendors.some((v) => v.restaurantId === restaurantId)) return;

  store.vendors.push({
    id: createId("vnd"),
    restaurantId,
    name: `${application.businessName} — İşletme`,
    email: application.email,
    // Prototipte ortak PIN; üretimde tek kullanımlık kurulum bağlantısı
    // gönderilir ve işletme kendi parolasını belirler.
    pin: VENDOR_PIN,
    createdAt: new Date().toISOString(),
  });
}
