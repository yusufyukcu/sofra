import "server-only";
import { CATEGORIES } from "../constants";
import { sql, type Db } from "../db/client";
import { toApplication, type ApplicationRow } from "../db/mappers";
import type { CuisineTag, LatLng, PartnerApplication, Restaurant } from "../types";
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

/**
 * Restoran katılım başvuruları.
 *
 * Başvuru alındığında hem form kaydı hem `approval_status = pending` bir
 * restoran taslağı oluşur; taslak yöneticinin onay kuyruğuna düşer.
 * Onaylandığında restoran yayına alınır ve işletmeye panel hesabı açılır.
 * Yeni restoranın menüsü boş olduğu için taslak "mola veriyor" (geçici
 * kapalı) doğar: işletme menüsünü hazırlayıp mağazayı kendisi açar.
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
  CATEGORIES.filter((c) => c.id !== "all" && c.id !== "top-rated").map((c) => c.id)
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
async function uniqueSlug(db: Db, name: string): Promise<string> {
  const base = slugify(name) || "restoran";
  const rows = await db<{ slug: string }[]>`
    select slug from public.restaurants where slug = ${base} or slug like ${`${base}-%`}
  `;
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i += 1) {
    if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/* ------------------------------------------------------------------ */
/* Başvuru                                                             */
/* ------------------------------------------------------------------ */

export async function submitApplication(input: ApplicationInput): Promise<PartnerApplication> {
  const businessName = text(input.businessName, 2, 80);
  if (!businessName) throw new DomainError("invalid_business_name", "İşletme adını gir (en az 2 karakter).");

  const cuisine = (input.cuisine ?? "").trim();
  if (!CUISINE_IDS.has(cuisine as CuisineTag)) throw new DomainError("invalid_cuisine", "Bir mutfak türü seç.");

  const city = text(input.city, 2, 40);
  if (!city) throw new DomainError("invalid_city", "Şehir bilgisi gerekli.");

  const district = text(input.district, 2, 40);
  if (!district) throw new DomainError("invalid_district", "İlçe bilgisi gerekli.");

  const address = text(input.address, 10, 200);
  if (!address) throw new DomainError("invalid_address", "Açık adresi gir (en az 10 karakter).");

  const location = input.location;
  if (
    !location ||
    !Number.isFinite(location.lat) ||
    !Number.isFinite(location.lng) ||
    Math.abs(location.lat) > 90 ||
    Math.abs(location.lng) > 180 ||
    (location.lat === 0 && location.lng === 0)
  ) {
    throw new DomainError("invalid_location", "Haritadan işletmenin konumunu seç.");
  }

  const contactName = text(input.contactName, 2, 60);
  if (!contactName) throw new DomainError("invalid_contact_name", "Yetkili adını gir.");

  if (!isValidPhone(input.phone ?? "")) {
    throw new DomainError("invalid_phone", "Geçerli bir cep telefonu numarası gir (5XX XXX XX XX).");
  }
  const phone = normalizePhone(input.phone ?? "");

  if (!isValidEmail(input.email ?? "")) throw new DomainError("invalid_email", "Geçerli bir e-posta adresi gir.");
  const email = (input.email ?? "").trim().toLowerCase();

  const taxNumber = (input.taxNumber ?? "").replace(/\D/g, "");
  if (taxNumber && !isValidTaxNumber(taxNumber)) {
    throw new DomainError("invalid_tax_number", "Vergi numarası 10, T.C. kimlik numarası 11 haneli olmalı.");
  }

  const branchCount = Math.max(1, Math.min(999, Math.round(input.branchCount ?? 1)));

  const id = createId("app");
  await sql.begin(async (tx) => {
    const [pending] = await tx<{ code: string }[]>`
      select code from public.partner_applications
       where status = 'received' and (phone = ${phone} or email = ${email})
       limit 1
    `;
    if (pending) {
      throw new DomainError(
        "application_exists",
        `Bu iletişim bilgisiyle değerlendirme aşamasında bir başvuru var (${pending.code}).`
      );
    }
    const [member] = await tx<{ id: string }[]>`
      select id from public.vendor_members where email = ${email}
    `;
    if (member) {
      throw new DomainError("email_taken", "Bu e-postayla açılmış bir işletme hesabı zaten var.");
    }

    const restaurantId = createId("rst");
    const cuisineName = CATEGORIES.find((c) => c.id === cuisine)?.name ?? "Restoran";
    await tx`
      insert into public.restaurants (
        id, slug, name, emoji, cover_seed, tags, description, rating, rating_count, eta_min, eta_max,
        min_basket, delivery_fee, free_delivery_over, lat, lng, district, delivery_radius_km,
        working_hours, commission_rate, approval_status, temporarily_closed, auto_accept,
        courier_mode, payment_methods, badges
      ) values (
        ${restaurantId}, ${await uniqueSlug(tx, businessName)}, ${businessName},
        ${emojiFor(cuisine as CuisineTag)}, ${createId("cov")}, ${[cuisine]},
        ${`${district}, ${city} · ${cuisineName}`}, 0, 0, 25, 40, 150, 29.9, null,
        ${location.lat}, ${location.lng}, ${district}, ${DEFAULT_RADIUS_KM},
        ${tx.json({ open: "10:00", close: "22:00" })}, ${DEFAULT_COMMISSION_RATE}, 'pending',
        true, true, ${input.hasOwnCourier ? "vendor" : "platform"},
        ${["online_card", "wallet", "meal_card", "card_on_delivery", "cash_on_delivery"] as Restaurant["paymentMethods"]},
        ${["Yeni"]}
      )
    `;

    let code = createApplicationCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const rows = await tx`
        insert into public.partner_applications (
          id, code, business_name, cuisine, city, district, address, lat, lng, branch_count,
          contact_name, phone, email, tax_number, has_own_courier, monthly_orders, note,
          status, restaurant_id
        ) values (
          ${id}, ${code}, ${businessName}, ${cuisine}, ${city}, ${district}, ${address},
          ${location.lat}, ${location.lng}, ${branchCount}, ${contactName}, ${phone}, ${email},
          ${taxNumber || null}, ${Boolean(input.hasOwnCourier)},
          ${text(input.monthlyOrders, 1, 40)}, ${text(input.note, 1, 500)}, 'received', ${restaurantId}
        )
        on conflict (code) do nothing
        returning id
      `;
      if (rows.length > 0) return;
      code = createApplicationCode();
    }
    throw new Error("Başvuru kodu üretilemedi.");
  });

  const [row] = await sql<ApplicationRow[]>`select * from public.partner_applications where id = ${id}`;
  return toApplication(row);
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
  /** Onaylandıysa restoran kimliği */
  restaurantId?: string;
}

/**
 * Referans koduyla başvuru durumu. Telefon, e-posta ve vergi numarası
 * burada yer almaz — kodu bilene kişisel bilgi açılmaz.
 */
export async function applicationStatus(code: string): Promise<ApplicationStatusView> {
  const normalized = code.trim().toUpperCase();
  const [row] = await sql<ApplicationRow[]>`
    select * from public.partner_applications where upper(code) = ${normalized}
  `;
  if (!row) {
    throw new DomainError("application_not_found", "Bu referans koduyla bir başvuru bulunamadı.", 404);
  }
  const application = toApplication(row);
  return {
    code: application.code,
    businessName: application.businessName,
    status: application.status,
    createdAt: application.createdAt,
    decidedAt: application.decidedAt,
    rejectionReason: application.rejectionReason,
    panelUrl: application.status === "approved" ? "/isletme/giris" : undefined,
    restaurantId: application.status === "approved" ? application.restaurantId : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Onay kuyruğuyla bağ                                                 */
/* ------------------------------------------------------------------ */

export async function applicationsByRestaurant(db: Db = sql): Promise<Map<string, PartnerApplication>> {
  const rows = await db<ApplicationRow[]>`select * from public.partner_applications`;
  return new Map(rows.map((r) => [r.restaurantId, toApplication(r)]));
}

/**
 * Yönetici onay kuyruğunda karar verdiğinde başvuru kaydını günceller ve
 * onaylanan işletmeye panel hesabı açar. Başvurudan gelmeyen restoranlarda
 * hiçbir şey yapmaz. Panel hesabının Auth kullanıcısı ve kurulum bağlantısı
 * `ensureVendorAccount` ile oluşturulur.
 */
export async function syncApplicationDecision(
  db: Db,
  restaurantId: string,
  approval: Restaurant["approvalStatus"],
  reason?: string
): Promise<{ vendorMemberId: string | null }> {
  const [application] = await db<ApplicationRow[]>`
    select * from public.partner_applications where restaurant_id = ${restaurantId} for update
  `;
  if (!application) return { vendorMemberId: null };

  if (approval === "approved" && application.status !== "approved") {
    await db`
      update public.partner_applications
         set status = 'approved', decided_at = now(), rejection_reason = null
       where id = ${application.id}
    `;
    const [existing] = await db<{ id: string }[]>`
      select id from public.vendor_members where restaurant_id = ${restaurantId} limit 1
    `;
    if (existing) return { vendorMemberId: existing.id };

    const memberId = createId("vnd");
    await db`
      insert into public.vendor_members (id, restaurant_id, name, email, role)
      values (${memberId}, ${restaurantId}, ${`${application.businessName} — İşletme`},
              ${application.email}, 'owner')
    `;
    return { vendorMemberId: memberId };
  }

  if (approval === "suspended" && application.status === "received") {
    await db`
      update public.partner_applications
         set status = 'rejected', decided_at = now(), rejection_reason = ${reason ?? null}
       where id = ${application.id}
    `;
  }
  return { vendorMemberId: null };
}
