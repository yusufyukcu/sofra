// Canlı rota geometrisi: izdüşüm, kalan yol, sadeleştirme, sapma ve kalan süre.
// Çalıştırma: npm run test:unit
import {
  COURIER_CITY_SPEED_KMH,
  ROAD_DETOUR_FACTOR,
  currentRoute,
  legForStage,
  liveLeg,
  locationStale,
  projectOnPath,
  remainingPath,
  simplifyPath,
  travelSeconds,
  type LiveLegOrder,
} from "../../packages/core/src/route.ts";
import { distanceKm } from "../../packages/core/src/utils.ts";

let failures = 0;
function check(label: string, ok: boolean, extra?: unknown) {
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok || extra === undefined ? "" : ` ${JSON.stringify(extra)}`}`);
}
const near = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= tolerance;

// Kadıköy'de L biçimli bir yol: önce kuzeye ~1 km, sonra doğuya ~500 m
const A = { lat: 40.98, lng: 29.02 };
const B = { lat: 40.989, lng: 29.02 };
const C = { lat: 40.989, lng: 29.026 };
const path = [A, B, C];
const ab = distanceKm(A, B) * 1000;
const bc = distanceKm(B, C) * 1000;

// İzdüşüm: ilk parçanın ortasının 30 m doğusu
const mid = { lat: (A.lat + B.lat) / 2, lng: 29.02 + 30 / (111_320 * Math.cos((40.9845 * Math.PI) / 180)) };
const p = projectOnPath(path, mid)!;
check("en yakın parça bulunur", p.index === 0, p);
check(`çizgiye uzaklık ~30 m (${p.offsetM.toFixed(1)})`, near(p.offsetM, 30, 0.5));
check(`çizgi boyunca ~yarı yol (${p.alongM.toFixed(0)} / ${ab.toFixed(0)})`, near(p.alongM, ab / 2, 2));
check(`toplam uzunluk ~${(ab + bc).toFixed(0)} m`, near(p.totalM, ab + bc, 3), p.totalM);

const rest = remainingPath(path, p);
check("kalan yol izdüşümden başlar, köşeden geçer", rest.length === 3 && rest[1] === B && rest[2] === C, rest);

// Sadeleştirme: düz çizgi üzerindeki ara noktalar atılır, köşe kalır
const dense = [];
for (let i = 0; i <= 10; i++) dense.push({ lat: A.lat + ((B.lat - A.lat) * i) / 10, lng: A.lng });
for (let i = 1; i <= 10; i++) dense.push({ lat: B.lat, lng: B.lng + ((C.lng - B.lng) * i) / 10 });
const simple = simplifyPath(dense, 4);
check(`21 nokta → ${simple.length} (başlangıç, köşe, bitiş)`, simple.length === 3 && near(simple[1].lat, B.lat, 1e-9), simple);

// Süre: servis süresi ile şehir içi hızın uzun olanı
const speed = COURIER_CITY_SPEED_KMH.moto / 3.6;
check("servis süresi iyimserse şehir içi hız esas", travelSeconds(1000, 60, "moto") === Math.round(1000 / speed));
check("servis süresi uzunsa o esas", travelSeconds(1000, 900, "moto") === 900);
check("bisiklet daha yavaş", travelSeconds(1000, null, "bisiklet") > travelSeconds(1000, null, "moto"));

// Ayak ve rota eşleşmesi
check("aşama → ayak", legForStage("assigned") === "pickup" && legForStage("at_restaurant") === "dropoff" && legForStage("picked_up") === "dropoff" && legForStage("offered") === null);
const base: LiveLegOrder = {
  courierStage: "picked_up",
  courierRoute: path,
  courierRouteLeg: "dropoff",
  courierRouteDistanceM: Math.round(ab + bc),
  courierRouteDurationS: 120,
  courierPoint: mid,
  restaurantLocation: A,
  address: { point: C } as LiveLegOrder["address"],
  courier: { id: "c", name: "K", emoji: "🛵", vehicle: "moto", rating: 5, maskedPhone: "" },
};
check("ayak uyuşmazsa eski rota kullanılmaz", currentRoute({ ...base, courierRouteLeg: "pickup" }) === null);

const leg = liveLeg(base)!;
const expectedRemaining = ab / 2 + bc + 30;
check(`kalan yol ~${expectedRemaining.toFixed(0)} m (${leg.remainingM.toFixed(0)})`, near(leg.remainingM, expectedRemaining, 3));
check("rotada: sapma yok", !leg.offTrack);
check("çizim kuryenin önündeki yolla başlar", leg.path !== null && leg.path.length === 3);

const off = liveLeg({ ...base, courierPoint: { lat: mid.lat, lng: mid.lng + 0.002 } })!;
check(`~170 m doğuda: sapma (${off.offTrack})`, off.offTrack);

const noRoute = liveLeg({ ...base, courierRoute: undefined })!;
const air = distanceKm(mid, C) * 1000;
check("rota yoksa kuş uçuşu × sapma payı", noRoute.path === null && near(noRoute.remainingM, air * ROAD_DETOUR_FACTOR, 0.5));
check("konum yoksa canlı ayak yok", liveLeg({ ...base, courierPoint: undefined }) === null);

// Konumun tazeliği
const now = Date.parse("2026-10-04T12:00:00Z");
check("60 sn önceki konum canlı", !locationStale({ courierLocatedAt: new Date(now - 60_000).toISOString() }, now));
check("2 dk önceki konum eski", locationStale({ courierLocatedAt: new Date(now - 120_000).toISOString() }, now));
check("konum hiç gelmediyse eski", locationStale({}, now));

if (failures) {
  console.log(`\n${failures} HATA`);
  process.exit(1);
}
console.log("\nTÜMÜ GEÇTİ");
