// Gerçek konum takibi: simülasyon yok (demo girişleri açıkken bile), kurye konumu
// cihazdan, rota yol tarifi servisinden (kurye → restoran, restoran → adres), sapınca
// yeni rota, canlı kalan süre, eskiyen konum, varlık sinyali; uydurma kurye konumu yok.
// Yol tarifi kapalıysa (SOFRA_ROUTING_URL=off) rota adımları atlanır.
// Çalıştırma: npm run test:e2e (hepsi) ya da node --env-file-if-exists=.env.local --env-file-if-exists=.env.development.local <dosya>
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const postgres = require("postgres");

const BASE = process.env.BASE ?? "http://localhost:3000";
const PASSWORD = process.env.SOFRA_DEMO_PASSWORD;
const COURIER_PHONE = "5321110002";
const ROUTING = (process.env.SOFRA_ROUTING_URL ?? "").trim().toLowerCase() !== "off";
const START = { lat: 40.9906, lng: 29.0291 }; // Kasap Burger Co.'nun ~1 km kuzeyi
const AWAY = { lat: 40.9905, lng: 29.0345 }; // rotadan ~400 m doğuda
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Client {
  constructor() { this.jar = new Map(); }
  cookieHeader() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "); }
  async call(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: { "content-type": "application/json", cookie: this.cookieHeader() },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";");
      const i = pair.indexOf("=");
      const k = pair.slice(0, i).trim(); const v = pair.slice(i + 1).trim();
      if (!v || /max-age=0/i.test(raw)) this.jar.delete(k); else this.jar.set(k, v);
    }
    const json = await res.json().catch(() => ({}));
    return { status: res.status, ...json };
  }
  get(p) { return this.call("GET", p); }
  post(p, b) { return this.call("POST", p, b ?? {}); }
  patch(p, b) { return this.call("PATCH", p, b ?? {}); }
}

let failures = 0;
function check(label, cond, extra) {
  if (cond) console.log(`  ✓ ${label}`);
  else { failures++; console.log(`  ✗ ${label}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ""); }
}
function must(r, label) {
  if (!r.ok) { failures++; console.log(`  ✗ ${label}:`, r.status, JSON.stringify(r.error)); throw new Error(label); }
  console.log(`  ✓ ${label}`);
  return r.data;
}
/** İki nokta arası (m) */
function distM(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}
/** Koşul sağlanana kadar bekler; her turda `tick` (ör. kuryenin konum bildirimi) çalışır */
async function waitFor(fn, { timeoutMs = 20_000, every = 1500, tick } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (tick) await tick();
    const value = await fn();
    if (value) return value;
    await sleep(every);
  }
  return null;
}

const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { ssl: "require", max: 1, onnotice: () => {} });
const admin = new Client();
const vendor = new Client();
const courier = new Client();
const customer = new Client();
let restoreDemo = null;
let restoreStore = null;
let orderId = null;

const track = async () => must(await customer.get(`/api/v1/orders/${orderId}`), "müşteri takibi");
const quietTrack = async () => (await customer.get(`/api/v1/orders/${orderId}`)).data;

try {
  console.log("\n▶ Simülasyon kaldırıldı");
  must(await admin.post("/api/v1/admin/auth/login", { email: "yonetim@sofra.app", password: PASSWORD }), "yönetici girişi");
  const settings = must(await admin.get("/api/v1/admin/settings"), "ayarlar");
  check("ayarlarda simülasyon hızı yok", !("simSpeed" in settings.settings), settings.settings);
  const [column] = await sql`
    select count(*)::int as n from information_schema.columns
     where table_schema = 'public' and table_name = 'orders' and column_name = 'simulated'`;
  check("siparişlerde 'simulated' sütunu yok", column.n === 0, column);
  const [speed] = await sql`select count(*)::int as n from public.app_settings where key = 'sim_speed'`;
  check("sim_speed ayarı yok", speed.n === 0, speed);

  must(await vendor.post("/api/v1/vendor/auth/login", { email: "kasap-burger-co@sofra.app", password: PASSWORD }), "işletme girişi (Kasap)");
  const store = must(await vendor.get("/api/v1/vendor/settings"), "mağaza ayarları").restaurant;
  restoreStore = { autoAccept: store.autoAccept, workingHours: store.workingHours, breakHours: store.breakHours ?? null, temporarilyClosed: store.temporarilyClosed };
  must(await vendor.patch("/api/v1/vendor/settings", { autoAccept: true, workingHours: { open: "00:00", close: "23:59" }, breakHours: null, temporarilyClosed: false }), "Kasap: otomatik onay, 24 saat açık");
  const overview = must(await admin.get("/api/v1/admin/overview"), "canlı operasyon");
  for (const c of overview.couriers) {
    await admin.post(`/api/v1/admin/couriers/${c.id}`, { action: "suspend", reason: "Canlı takip testi" });
    await admin.post(`/api/v1/admin/couriers/${c.id}`, { action: "activate" });
  }
  if (!settings.settings.demoMode) {
    restoreDemo = false;
    must(await admin.patch("/api/v1/admin/settings", { demoMode: true }), "demo girişleri test için açıldı");
  }

  must(await customer.post("/api/v1/auth/demo"), "müşteri girişi (geliştirme)");
  const detail = must(await customer.get("/api/v1/restaurants/kasap-burger-co?lat=40.9872&lng=29.0263"), "menü");
  const restaurant = detail.restaurant.location;
  const product = detail.restaurant.menu.flatMap((c) => c.products).find((p) => !p.soldOut && p.optionGroups.every((g) => !g.required));
  const me = must(await customer.get("/api/v1/auth/me"), "adres");
  const created = must(await customer.post("/api/v1/orders", {
    restaurantId: detail.restaurant.id, addressId: me.addresses[0].id, paymentMethod: "cash_on_delivery",
    lines: [{ lineId: "ln_live", productId: product.id, name: product.name, emoji: product.emoji, basePrice: 1, unitPrice: 1, quantity: 1, selections: [] }],
    preferences: { contactless: false, ringDoorbell: true, cutlery: false },
  }), "sipariş verildi");
  orderId = created.order.id;
  const destination = created.order.address.point;
  check("yeni siparişte kurye konumu ve rota yok", !created.order.courierPoint && !created.order.courierRoute, { point: created.order.courierPoint, route: created.order.courierRoute?.length });
  await sleep(11_000); // iki dağıtım turu
  let tracking = await track();
  check("mesaide kurye yokken sipariş bekliyor; demo açıkken de simüle kurye yok", tracking.order.status === "preparing" && !tracking.order.courier && !tracking.order.courierPoint, { status: tracking.order.status, courier: tracking.order.courier });
  if (restoreDemo === false) {
    must(await admin.patch("/api/v1/admin/settings", { demoMode: false }), "demo girişleri geri kapatıldı");
    restoreDemo = null;
  }

  console.log("\n▶ Kurye → restoran: yol rotası");
  const otp = must(await courier.post("/api/v1/courier/auth/otp/start", { phone: COURIER_PHONE }), "kurye kodu");
  must(await courier.post("/api/v1/courier/auth/otp/verify", { challengeId: otp.challengeId, code: otp.devCode }), "kurye girişi");
  must(await courier.post("/api/v1/courier/shift", { online: true, point: START }), "kurye konumla mesaide");
  const offer = await waitFor(async () => {
    const board = (await courier.get("/api/v1/courier/board")).data;
    return board?.offer?.orderId === orderId ? board.offer : null;
  }, { timeoutMs: 15_000 });
  check("teklif geldi", Boolean(offer));
  must(await courier.post(`/api/v1/courier/offers/${offer.id}`, { action: "accept" }), "kurye kabul etti");
  tracking = await track();
  check("kurye konumu cihazdan (mesai konumu)", tracking.order.courierPoint && distM(tracking.order.courierPoint, START) < 1, tracking.order.courierPoint);
  check("konum zamanı siparişte", Boolean(tracking.order.courierLocatedAt));

  let pickupRoute = null;
  if (ROUTING) {
    const routed = await waitFor(async () => {
      const t = await quietTrack();
      return t?.order.courierRouteLeg === "pickup" ? t.order : null;
    });
    check("restorana gidiş rotası geldi", Boolean(routed), routed && { leg: routed.courierRouteLeg });
    if (routed) {
      pickupRoute = routed.courierRoute;
      const air = distM(START, restaurant);
      check(`yol boyunca: ${pickupRoute.length} nokta, ${routed.courierRouteDistanceM} m (kuş uçuşu ${Math.round(air)} m)`, pickupRoute.length > 3 && routed.courierRouteDistanceM > air);
      check("rota kuryenin yanından başlar", distM(pickupRoute[0], START) < 150, pickupRoute[0]);
      check("rota restoranda biter", distM(pickupRoute.at(-1), restaurant) < 5, pickupRoute.at(-1));
    }
  } else {
    console.log("  · yol tarifi kapalı (SOFRA_ROUTING_URL=off): rota adımları atlandı");
  }

  if (ROUTING && pickupRoute) {
    console.log("\n▶ Rotadan sapınca yeni rota");
    // Yeniden rota sınırını (20 sn) beklememek için son rota zamanı geriye alınır
    await sql`update public.orders set courier_route_at = now() - interval '1 minute' where id = ${orderId}`;
    must(await courier.post("/api/v1/courier/location", { point: pickupRoute[Math.floor(pickupRoute.length / 2)] }), "rota üzerinde konum");
    await sleep(4000);
    const [kept] = await sql`select courier_route_at < now() - interval '30 seconds' as untouched from public.orders where id = ${orderId}`;
    check("rotadayken yeni rota istenmedi", kept.untouched === true, kept);
    must(await courier.post("/api/v1/courier/location", { point: AWAY }), "rotadan ~400 m uzakta konum");
    const rerouted = await waitFor(async () => {
      const t = await quietTrack();
      return t?.order.courierRoute && distM(t.order.courierRoute[0], AWAY) < 150 ? t.order : null;
    });
    check("kuryenin bulunduğu yerden yeni rota", Boolean(rerouted), rerouted?.courierRoute?.[0]);
    check("yeni rota da restoranda biter", rerouted && distM(rerouted.courierRoute.at(-1), restaurant) < 5);
  }

  console.log("\n▶ Restoran → adres");
  must(await courier.post("/api/v1/courier/location", { point: restaurant }), "kurye restoranda");
  must(await courier.post(`/api/v1/courier/orders/${orderId}`, { action: "arrived" }), "restorana vardı");
  let dropoffRoute = null;
  if (ROUTING) {
    const routed = await waitFor(async () => {
      const t = await quietTrack();
      return t?.order.courierRouteLeg === "dropoff" ? t.order : null;
    });
    check("teslimat rotası geldi (restoran → adres)", Boolean(routed));
    if (routed) {
      dropoffRoute = routed.courierRoute;
      check("rota restorandan başlar", distM(dropoffRoute[0], restaurant) < 150, dropoffRoute[0]);
      check("rota adreste biter", distM(dropoffRoute.at(-1), destination) < 5, dropoffRoute.at(-1));
    }
  }
  must(await courier.post(`/api/v1/courier/orders/${orderId}`, { action: "pickup" }), "paketi aldı");
  tracking = await track();
  const etaMinutes = (Date.parse(tracking.order.etaAt) - Date.now()) / 60_000;
  check(`yolda; tahmini teslim ${etaMinutes.toFixed(1)} dk sonra`, tracking.order.status === "on_the_way" && etaMinutes > 1 && etaMinutes < 30, tracking.order.etaAt);

  console.log("\n▶ Canlı kalan süre");
  const close = dropoffRoute ? dropoffRoute.at(-2) : { lat: destination.lat + 0.0004, lng: destination.lng };
  must(await courier.post("/api/v1/courier/location", { point: close }), `adrese ${Math.round(distM(close, destination))} m kala konum`);
  tracking = await track();
  check(`kalan süre kuryenin konumundan (${tracking.remainingMinutes} dk)`, tracking.remainingMinutes >= 1 && tracking.remainingMinutes <= 4, tracking.remainingMinutes);
  check("tahmini varış planlanandan erken", Date.parse(tracking.arrivalAt) < Date.parse(tracking.order.etaAt), { arrivalAt: tracking.arrivalAt, etaAt: tracking.order.etaAt });
  check("konum zamanı taze", Date.now() - Date.parse(tracking.order.courierLocatedAt) < 15_000, tracking.order.courierLocatedAt);

  console.log("\n▶ Eskiyen konum ve varlık sinyali");
  await sql`update public.orders set courier_located_at = now() - interval '5 minutes' where id = ${orderId}`;
  tracking = await track();
  check("konumu 5 dk önce gelen kuryede süre planlanan saatten", tracking.arrivalAt === tracking.order.etaAt, { arrivalAt: tracking.arrivalAt, etaAt: tracking.order.etaAt });
  must(await courier.post("/api/v1/courier/location", { point: close }), "aynı noktadan varlık sinyali");
  tracking = await track();
  check("aynı nokta konum zamanını tazeledi", Date.now() - Date.parse(tracking.order.courierLocatedAt) < 15_000, tracking.order.courierLocatedAt);

  console.log("\n▶ Teslim");
  must(await courier.post(`/api/v1/courier/orders/${orderId}`, { action: "deliver" }), "teslim etti");
  tracking = await track();
  check("teslim edildi; kurye konumu adrese ışınlanmadı", tracking.order.status === "delivered" && distM(tracking.order.courierPoint, close) < 1, tracking.order.courierPoint);
  orderId = null;
} catch (err) {
  failures++;
  console.log("  ✗ durdu:", err.message);
} finally {
  if (orderId) await admin.post(`/api/v1/admin/orders/${orderId}`, { action: "cancel", reason: "Test temizliği" }).catch(() => undefined);
  await courier.post("/api/v1/courier/shift", { online: false }).catch(() => undefined);
  if (restoreStore) await vendor.patch("/api/v1/vendor/settings", restoreStore).catch(() => undefined);
  if (restoreDemo === false) await admin.patch("/api/v1/admin/settings", { demoMode: false }).catch(() => undefined);
  await sql.end();
}
console.log(failures === 0 ? "\nTÜMÜ GEÇTİ" : `\n${failures} HATA`);
process.exit(failures === 0 ? 0 : 1);
