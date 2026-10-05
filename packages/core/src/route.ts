import type { CourierStage, CourierVehicle, LatLng, Order, RouteLeg } from "./types";
import { distanceKm } from "./utils";

/**
 * Canlı teslimat rotası.
 *
 * Kuryenin izleyeceği yol çizgisi sunucuda bir yol tarifi servisinden
 * (OSRM) alınıp siparişe yazılır. Bu modül o çizgi üzerinde hesap yapar:
 * kuryenin çizgideki yeri, kalan yol ve süre, rotadan sapma. Sunucu
 * (sapan kuryeye yeni rota), web ve mobil (harita, kalan süre) aynı
 * fonksiyonları kullanır.
 */

/** Kurye rotadan bu kadar uzaklaşırsa yeni rota istenir (m). GPS sapmasını yutacak kadar geniş. */
export const ROUTE_OFF_TRACK_M = 60;

/** Aynı sipariş için iki rota isteği arasındaki en kısa süre (ms). */
export const ROUTE_REFRESH_MS = 20_000;

/** Kurye konumu bu kadar süredir gelmiyorsa canlı sayılmaz (ms). */
export const LOCATION_STALE_MS = 90_000;

/** Kapıda teslim payı (sn): park, bina girişi, asansör. */
export const HANDOVER_SECONDS = 120;

/**
 * Şehir içi ortalama hız (km/sa). Yol tarifi servisi trafiği ve ışıkları
 * bilmediği için süresi iyimserdir; kalan süre bu hızla bulunan süreden
 * kısa sayılmaz.
 */
export const COURIER_CITY_SPEED_KMH: Record<CourierVehicle, number> = {
  moto: 24,
  bisiklet: 14,
  araba: 18,
};

/** Rota yokken (yol tarifi kapalı ya da ulaşılamıyor) kuş uçuşunu yola çeviren pay. */
export const ROAD_DETOUR_FACTOR = 1.3;

/** Kuryenin aşamasına göre izlediği ayak. */
export function legForStage(stage: CourierStage | null | undefined): RouteLeg | null {
  if (stage === "assigned") return "pickup";
  if (stage === "at_restaurant" || stage === "picked_up") return "dropoff";
  return null;
}

/** Siparişin şu anki ayağına ait yol çizgisi; ayak değiştiyse eski çizgi kullanılmaz. */
export function currentRoute(
  order: Pick<Order, "courierStage" | "courierRoute" | "courierRouteLeg">
): LatLng[] | null {
  const leg = legForStage(order.courierStage);
  const route = order.courierRoute;
  if (!leg || order.courierRouteLeg !== leg || !route || route.length < 2) return null;
  return route;
}

/** Kurye konumu eski mi (hiç gelmediyse de eski sayılır). */
export function locationStale(
  order: Pick<Order, "courierLocatedAt">,
  now = Date.now()
): boolean {
  if (!order.courierLocatedAt) return true;
  return now - new Date(order.courierLocatedAt).getTime() > LOCATION_STALE_MS;
}

/**
 * Yolun süresi (sn): servisin verdiği süre (varsa) ile şehir içi ortalama
 * hızla bulunan sürenin uzun olanı.
 */
export function travelSeconds(
  distanceM: number,
  serviceSeconds?: number | null,
  vehicle: CourierVehicle = "moto"
): number {
  const speedMps = (COURIER_CITY_SPEED_KMH[vehicle] ?? COURIER_CITY_SPEED_KMH.moto) / 3.6;
  return Math.max(0, Math.round(Math.max(serviceSeconds ?? 0, distanceM / speedMps)));
}

/* ------------------------------------------------------------------ */
/* Çizgi geometrisi                                                    */
/* ------------------------------------------------------------------ */

/*
 * Hesaplar yerel düzlemde yapılır (eş dikdörtgen izdüşüm): şehir ölçeğinde
 * hata santimetre düzeyindedir ve her noktada trigonometri gerekmez.
 */
const M_PER_DEG = 111_320;

interface XY {
  x: number;
  y: number;
}

function toXY(p: LatLng, cosLat: number): XY {
  return { x: p.lng * M_PER_DEG * cosLat, y: p.lat * M_PER_DEG };
}

function cosOf(lat: number): number {
  return Math.cos((lat * Math.PI) / 180);
}

/** Noktanın [a, b] parçasına uzaklığı ve parçadaki oranı (0–1). */
function nearestOnSegment(p: XY, a: XY, b: XY): { t: number; distance: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return { t, distance: Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)) };
}

export interface PathProjection {
  /** En yakın parçanın başlangıç indeksi */
  index: number;
  /** Çizgi üzerindeki en yakın nokta */
  point: LatLng;
  /** Noktanın çizgiye uzaklığı (m) */
  offsetM: number;
  /** Çizginin başından en yakın noktaya kadarki yol (m) */
  alongM: number;
  /** Çizginin toplam uzunluğu (m) */
  totalM: number;
}

/** Noktayı çizginin en yakın yerine düşürür. */
export function projectOnPath(path: LatLng[], point: LatLng): PathProjection | null {
  if (path.length === 0) return null;
  const cosLat = cosOf(point.lat);
  const p = toXY(point, cosLat);

  if (path.length === 1) {
    const a = toXY(path[0], cosLat);
    return { index: 0, point: path[0], offsetM: Math.hypot(p.x - a.x, p.y - a.y), alongM: 0, totalM: 0 };
  }

  let bestIndex = 0;
  let bestT = 0;
  let bestOffset = Infinity;
  let bestAlong = 0;
  let walked = 0;
  let a = toXY(path[0], cosLat);
  for (let i = 0; i < path.length - 1; i++) {
    const b = toXY(path[i + 1], cosLat);
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const { t, distance } = nearestOnSegment(p, a, b);
    if (distance < bestOffset) {
      bestOffset = distance;
      bestIndex = i;
      bestT = t;
      bestAlong = walked + t * length;
    }
    walked += length;
    a = b;
  }

  const from = path[bestIndex];
  const to = path[bestIndex + 1];
  return {
    index: bestIndex,
    point: { lat: from.lat + (to.lat - from.lat) * bestT, lng: from.lng + (to.lng - from.lng) * bestT },
    offsetM: bestOffset,
    alongM: bestAlong,
    totalM: walked,
  };
}

/** Çizginin izdüşümden sonraki kısmı (kuryenin önündeki yol). */
export function remainingPath(path: LatLng[], projection: PathProjection): LatLng[] {
  return [projection.point, ...path.slice(projection.index + 1)];
}

/**
 * Çizgiyi sadeleştirir (Douglas–Peucker): `toleranceM`'den az sapan ara
 * noktalar atılır. Yol tarifi servisinin yoğun çizgisi böylece birkaç kat
 * küçülür, harita aynı görünür.
 */
export function simplifyPath(path: LatLng[], toleranceM: number): LatLng[] {
  if (path.length <= 2) return path.slice();
  const cosLat = cosOf(path[0].lat);
  const points = path.map((p) => toXY(p, cosLat));
  const keep = new Uint8Array(path.length);
  keep[0] = 1;
  keep[path.length - 1] = 1;

  const stack: [number, number][] = [[0, path.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let farthest = -1;
    let farthestDistance = 0;
    for (let i = first + 1; i < last; i++) {
      const { distance } = nearestOnSegment(points[i], points[first], points[last]);
      if (distance > farthestDistance) {
        farthestDistance = distance;
        farthest = i;
      }
    }
    if (farthest !== -1 && farthestDistance > toleranceM) {
      keep[farthest] = 1;
      stack.push([first, farthest], [farthest, last]);
    }
  }
  return path.filter((_, i) => keep[i] === 1);
}

/* ------------------------------------------------------------------ */
/* Kuryenin canlı ayağı                                                */
/* ------------------------------------------------------------------ */

export interface LiveLeg {
  leg: RouteLeg;
  /** Ayağın hedefi: restoran ya da teslimat adresi */
  target: LatLng;
  /** Haritada çizilecek kalan yol (kuryeden hedefe); rota yoksa null */
  path: LatLng[] | null;
  /** Kalan yol (m). Rota yoksa kuş uçuşu × sapma payı. */
  remainingM: number;
  /** Kalan yol süresi (sn, kapıda teslim payı hariç) */
  remainingS: number;
  /** Kurye rotanın dışında: yeni rota bekleniyor */
  offTrack: boolean;
}

export type LiveLegOrder = Pick<
  Order,
  | "courierStage"
  | "courierRoute"
  | "courierRouteLeg"
  | "courierRouteDistanceM"
  | "courierRouteDurationS"
  | "courierPoint"
  | "restaurantLocation"
  | "address"
  | "courier"
>;

/**
 * Kuryenin şu anki ayağında kalan yol ve süre. Konumu ya da açık ayağı
 * olmayan siparişte null.
 */
export function liveLeg(order: LiveLegOrder): LiveLeg | null {
  const leg = legForStage(order.courierStage);
  const from = order.courierPoint;
  if (!leg || !from) return null;

  const target = leg === "pickup" ? order.restaurantLocation : order.address.point;
  const vehicle = order.courier?.vehicle ?? "moto";
  const route = currentRoute(order);

  if (route) {
    const projection = projectOnPath(route, from)!;
    const remainingM = Math.max(0, projection.totalM - projection.alongM) + projection.offsetM;
    // Servisin süresi aynı yolun kalanına oranlanır
    const serviceS =
      order.courierRouteDurationS != null && order.courierRouteDistanceM
        ? (order.courierRouteDurationS * remainingM) / order.courierRouteDistanceM
        : null;
    return {
      leg,
      target,
      path: remainingPath(route, projection),
      remainingM,
      remainingS: travelSeconds(remainingM, serviceS, vehicle),
      offTrack: projection.offsetM > ROUTE_OFF_TRACK_M,
    };
  }

  const remainingM = distanceKm(from, target) * 1000 * ROAD_DETOUR_FACTOR;
  return {
    leg,
    target,
    path: null,
    remainingM,
    remainingS: travelSeconds(remainingM, null, vehicle),
    offTrack: false,
  };
}
