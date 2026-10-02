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

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
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

/* ------------------------------------------------------------------ */
/* Çalışma saatleri                                                    */
/* ------------------------------------------------------------------ */

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function isWithinWorkingHours(
  hours: { open: string; close: string },
  now = new Date()
): boolean {
  const current = now.getHours() * 60 + now.getMinutes();
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
  const current = now.getHours() * 60 + now.getMinutes();
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
