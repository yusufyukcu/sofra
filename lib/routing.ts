import "server-only";
import { simplifyPath } from "@sofra/core/route";
import type { CourierVehicle, LatLng } from "./types";

/**
 * Yol tarifi (OSRM uyumlu servis).
 *
 * Kuryenin izleyeceği gerçek yol çizgisi buradan gelir; harita bu çizgiyi
 * çizer, kalan mesafe ve süre bu çizgi üzerinden hesaplanır.
 *
 * Adres `SOFRA_ROUTING_URL` ile verilir. `{profile}` yer tutucusu araca göre
 * `car` ya da `bike` olur (motosiklet de araba yollarını kullanır); tek
 * profilli kendi OSRM sunucunda yer tutucu gerekmez. Değişken yoksa
 * FOSSGIS'in herkese açık sunucusu kullanılır: OpenStreetMap verisi,
 * saniyede en fazla 1 istek, ticari kullanım yok. Canlıya çıkmadan önce
 * kendi OSRM sunucunu kurup adresini yaz (README → Yol tarifi). `off`
 * yol tarifini kapatır: harita rota çizmez, süreler kuş uçuşu mesafeden
 * tahmin edilir.
 *
 * Servise ulaşılamazsa sessizce `null` döner; teslimat akışı hiçbir zaman
 * yol tarifini beklemez.
 */

export type RouteProfile = "car" | "bike";

export interface RoadRoute {
  /** Sadeleştirilmiş yol çizgisi (başlangıçtan hedefe) */
  points: LatLng[];
  /** Yol mesafesi (m) */
  distanceM: number;
  /** Servisin verdiği süre (sn, trafiksiz) */
  durationS: number;
}

const PUBLIC_SERVER = "https://routing.openstreetmap.de/routed-{profile}";
const USER_AGENT = "Sofra/1.0 (kurye canli takibi)";
const TIMEOUT_MS = 8_000;
/** Çizgiden bu kadar az sapan ara noktalar atılır (m) */
const SIMPLIFY_TOLERANCE_M = 4;

function configuredUrl(): string | null {
  const raw = process.env.SOFRA_ROUTING_URL?.trim();
  if (!raw) return PUBLIC_SERVER;
  if (raw.toLowerCase() === "off") return null;
  return raw.replace(/\/+$/, "");
}

/** Yol tarifi açık mı (`SOFRA_ROUTING_URL=off` değilse açık). */
export function routingEnabled(): boolean {
  return configuredUrl() !== null;
}

export function routeProfileFor(vehicle: CourierVehicle): RouteProfile {
  return vehicle === "bisiklet" ? "bike" : "car";
}

/*
 * Herkese açık sunucu saniyede bir isteği aşmamamızı istiyor. Aynı süreçteki
 * istekler sıraya girer; rota isteği yanıt gönderildikten sonra (`after`)
 * yapıldığı için beklemek kimseyi yavaşlatmaz.
 */
const PUBLIC_MIN_GAP_MS = 1_100;
let nextSlot = 0;

async function waitForSlot(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + PUBLIC_MIN_GAP_MS;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

function coordinate(p: LatLng): string {
  return `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

interface OsrmResponse {
  code?: string;
  message?: string;
  routes?: {
    distance: number;
    duration: number;
    geometry?: { coordinates?: [number, number][] };
  }[];
}

/** İki nokta arasındaki yol rotası; servis kapalıysa ya da yanıt vermezse null. */
export async function fetchRoadRoute(
  from: LatLng,
  to: LatLng,
  profile: RouteProfile
): Promise<RoadRoute | null> {
  const template = configuredUrl();
  if (!template) return null;

  const base = template.replace("{profile}", profile);
  const url =
    `${base}/route/v1/driving/${coordinate(from)};${coordinate(to)}` +
    "?overview=full&geometries=geojson&alternatives=false&steps=false";

  try {
    if (template === PUBLIC_SERVER) await waitForSlot();
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as OsrmResponse | null;
    const route = body?.code === "Ok" ? body.routes?.[0] : undefined;
    const coordinates = route?.geometry?.coordinates;
    if (!response.ok || !route || !coordinates || coordinates.length < 2) {
      console.warn(`[sofra/routing] rota alınamadı (${response.status} ${body?.code ?? ""} ${body?.message ?? ""})`);
      return null;
    }

    const points = simplifyPath(
      coordinates.map(([lng, lat]) => ({ lat: round6(lat), lng: round6(lng) })),
      SIMPLIFY_TOLERANCE_M
    );
    // Servis hedefi en yakın yola oturtur; çizgi kapıya kadar uzansın
    const last = points[points.length - 1];
    if (Math.abs(last.lat - to.lat) > 1e-5 || Math.abs(last.lng - to.lng) > 1e-5) {
      points.push({ lat: round6(to.lat), lng: round6(to.lng) });
    }

    return { points, distanceM: Math.round(route.distance), durationS: Math.round(route.duration) };
  } catch (err) {
    console.warn("[sofra/routing] yol tarifi servisine ulaşılamadı:", err instanceof Error ? err.message : err);
    return null;
  }
}
