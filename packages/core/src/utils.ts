import type { CartLine, LatLng, Restaurant } from "./types";

/* ------------------------------------------------------------------ */
/* Biçimlendirme                                                       */
/* ------------------------------------------------------------------ */

const tryFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPrice(value: number): string {
  return tryFormatter.format(value);
}

/** "12,50 ₺" yerine kompakt "+12,50 ₺" gibi fark gösterimleri için. */
export function formatDelta(value: number): string {
  if (value === 0) return "";
  const sign = value > 0 ? "+" : "-";
  return `${sign}${tryFormatter.format(Math.abs(value))}`;
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace(".", ",")} km`;
}

/**
 * Platformun saat dilimi. Sunucular UTC'de çalışır (Vercel); çalışma
 * saatleri, rapor günleri ve ekranda gösterilen saatler hep İstanbul'a
 * göre hesaplanır — sunucuda ve tarayıcıda aynı sonucu versin diye.
 */
export const APP_TIME_ZONE = "Europe/Istanbul";

const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: APP_TIME_ZONE,
});

const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: APP_TIME_ZONE,
});

export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

/* ------------------------------------------------------------------ */
/* Saat dilimi bilinçli takvim anahtarları                             */
/* ------------------------------------------------------------------ */

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** İstanbul takvimine göre gün: "2026-10-02" */
export function dayKey(date: Date): string {
  return dayKeyFormatter.format(date);
}

/** İstanbul takvimine göre haftanın pazartesisi: "2026-09-28" */
export function weekKey(date: Date): string {
  const [y, m, d] = dayKey(date).split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() - ((utc.getUTCDay() + 6) % 7));
  return utc.toISOString().slice(0, 10);
}

/** İstanbul takvimine göre ay: "2026-10" */
export function monthKey(date: Date): string {
  return dayKey(date).slice(0, 7);
}

/** Takvim anahtarına `days` gün ekler: ("2026-09-28", 6) → "2026-10-04" */
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

const keyLabelFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** "2026-09-28" → "28 Eyl" (anahtar takvim günüdür, saat dilimi kaydırmaz) */
export function formatDayKey(key: string): string {
  return keyLabelFormatter.format(new Date(`${key}T12:00:00Z`));
}

/** "2026-09-28" → "28 Eyl – 4 Eki" */
export function formatWeekKey(key: string): string {
  return `${formatDayKey(key)} – ${formatDayKey(addDaysToKey(key, 6))}`;
}

const monthLabelFormatter = new Intl.DateTimeFormat("tr-TR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-10" → "Ekim 2026" */
export function formatMonthKey(key: string): string {
  return monthLabelFormatter.format(new Date(`${key}-15T12:00:00Z`));
}

export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return raw;
  return `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(
    6,
    8
  )} ${digits.slice(8)}`;
}

/* ------------------------------------------------------------------ */
/* Coğrafya                                                            */
/* ------------------------------------------------------------------ */

const EARTH_RADIUS_KM = 6371;

/** İki nokta arasındaki kuş uçuşu mesafe (Haversine, km). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function lerpPoint(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/**
 * Restorandan adrese doğru, düz çizgi yerine hafif kırılmalı bir "yol"
 * üretir. Gerçek uygulamada bu rota bir directions servisinden gelir.
 */
export function buildRoute(from: LatLng, to: LatLng, steps = 28): LatLng[] {
  const route: LatLng[] = [];
  // Kontrol noktasını dik eksende kaydırarak yumuşak bir eğri elde ediyoruz.
  const midLat = (from.lat + to.lat) / 2;
  const midLng = (from.lng + to.lng) / 2;
  const dLat = to.lat - from.lat;
  const dLng = to.lng - from.lng;
  const control = { lat: midLat - dLng * 0.18, lng: midLng + dLat * 0.18 };
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const inv = 1 - t;
    route.push({
      lat: inv * inv * from.lat + 2 * inv * t * control.lat + t * t * to.lat,
      lng: inv * inv * from.lng + 2 * inv * t * control.lng + t * t * to.lng,
    });
  }
  return route;
}

/** Nokta çokgenin içinde mi (ışın atma; enlem = y, boylam = x). */
export function pointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses =
      a.lat > point.lat !== b.lat > point.lat &&
      point.lng < ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng;
    if (crosses) inside = !inside;
  }
  return inside;
}

/**
 * Adres restoranın teslimat bölgesinde mi. Restoran poligon çizdiyse o
 * geçerlidir; çizmediyse merkezden yarıçap.
 */
export function isInDeliveryZone(
  restaurant: Pick<Restaurant, "location" | "deliveryRadiusKm" | "deliveryZone">,
  point: LatLng
): boolean {
  const zone = restaurant.deliveryZone;
  if (zone && zone.length >= 3) return pointInPolygon(point, zone);
  return distanceKm(point, restaurant.location) <= restaurant.deliveryRadiusKm;
}

/* ------------------------------------------------------------------ */
/* Çalışma saatleri                                                    */
/* ------------------------------------------------------------------ */

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

const clockFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: APP_TIME_ZONE,
});

/** İstanbul saatiyle gün içindeki dakika (0–1439). */
export function minutesOfDay(now = new Date()): number {
  const parts = clockFormatter.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return (hour % 24) * 60 + minute;
}

export function isWithinWorkingHours(
  hours: { open: string; close: string },
  now = new Date()
): boolean {
  const current = minutesOfDay(now);
  const open = minutesOf(hours.open);
  const close = minutesOf(hours.close);
  // Gece yarısını aşan vardiyalar (ör. 11:00 → 02:00)
  if (close <= open) return current >= open || current < close;
  return current >= open && current < close;
}

/** Gün ortası molasında mı (ör. 11:30 – 12:00). */
export function isOnBreak(
  breakHours: { start: string; end: string } | null | undefined,
  now = new Date()
): boolean {
  if (!breakHours) return false;
  const current = minutesOfDay(now);
  return (
    current >= minutesOf(breakHours.start) && current < minutesOf(breakHours.end)
  );
}

export function isRestaurantOpen(r: Restaurant, now = new Date()): boolean {
  if (r.temporarilyClosed) return false;
  if (isOnBreak(r.breakHours, now)) return false;
  return isWithinWorkingHours(r.workingHours, now);
}

/** Mesafeye göre teslim süresini büyütür (her km ~2,5 dk). */
export function etaForDistance(
  r: Pick<Restaurant, "etaMin" | "etaMax">,
  km: number
): { min: number; max: number } {
  const extra = Math.round(km * 2.5);
  return { min: r.etaMin + extra, max: r.etaMax + extra };
}

/* ------------------------------------------------------------------ */
/* Sepet hesapları                                                     */
/* ------------------------------------------------------------------ */

export function lineTotal(line: CartLine): number {
  return round2(line.unitPrice * line.quantity);
}

export function cartSubtotal(lines: CartLine[]): number {
  return round2(lines.reduce((sum, l) => sum + lineTotal(l), 0));
}

export function cartItemCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Çeşitli                                                             */
/* ------------------------------------------------------------------ */

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function createId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

/** Sipariş kodu: SF-4H2K9 */
export function createOrderCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `SF-${out}`;
}

/** Deterministik hash — tohumdan renk/görsel üretmek için. */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function pluralTR(count: number, singular: string): string {
  return `${count} ${singular}`;
}

/** "5 dakika önce" tarzı göreli zaman. */
export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.round((now - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "az önce";
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} saat önce`;
  const days = Math.floor(diff / 86400);
  if (days < 30) return `${days} gün önce`;
  return formatDateTime(iso);
}

/* ------------------------------------------------------------------ */
/* Doğrulama ve slug                                                   */
/* ------------------------------------------------------------------ */

/** Numaradan yalnızca son 10 haneyi alır: "+90 555 111 22 33" → "5551112233" */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}

/** Türk cep telefonu: 5XX XXX XX XX */
export function isValidPhone(raw: string): boolean {
  return /^5\d{9}$/.test(normalizePhone(raw));
}

export function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw.trim());
}

/** Vergi kimlik numarası 10, T.C. kimlik numarası 11 hane. */
export function isValidTaxNumber(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11;
}

/** Türkçe harfleri koruyarak URL parçası üretir: "Şefin Yeri" → "sefin-yeri" */
export function slugify(input: string): string {
  const map: Record<string, string> = {
    ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u",
    Ç: "c", Ğ: "g", İ: "i", I: "i", Ö: "o", Ş: "s", Ü: "u",
  };
  return input
    .trim()
    .replace(/[çğıöşüÇĞİIÖŞÜ]/g, (ch) => map[ch] ?? ch)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Başvuru referansı: SF-BV-4H2K */
export function createApplicationCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `SF-BV-${out}`;
}

/* ------------------------------------------------------------------ */
/* Kart numarası                                                       */
/* ------------------------------------------------------------------ */

/** Luhn (mod 10) denetimi — yazım hatalarını sunucuya gitmeden yakalar. */
export function luhnValid(number: string): boolean {
  const digits = number.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Kart markası: Visa (4), Mastercard (51–55, 2221–2720), Troy (9792). */
export function cardBrandOf(number: string): "visa" | "mastercard" | "troy" | null {
  const digits = number.replace(/\D/g, "");
  if (/^4/.test(digits)) return "visa";
  if (/^5[1-5]/.test(digits)) return "mastercard";
  const four = Number(digits.slice(0, 4));
  if (four >= 2221 && four <= 2720) return "mastercard";
  if (/^9792/.test(digits)) return "troy";
  return null;
}

/** "4242424242424242" → "4242 4242 4242 4242" (yazarken biçimlendirme) */
export function formatCardNumber(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}
