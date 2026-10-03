// Realtime uçtan uca: dört rolün token ucu, kanal yetkileri ve olay akışı.
// Çalıştırma: npm run test:e2e (hepsi) ya da node --env-file-if-exists=.env.local --env-file-if-exists=.env.development.local <dosya>
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");

const BASE = process.env.BASE ?? "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Client {
  constructor(name) { this.name = name; this.jar = new Map(); }
  cookieHeader() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "); }
  store(res) {
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";");
      const i = pair.indexOf("=");
      const k = pair.slice(0, i).trim(); const v = pair.slice(i + 1).trim();
      if (!v || /max-age=0/i.test(raw)) this.jar.delete(k); else this.jar.set(k, v);
    }
  }
  async call(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: { "content-type": "application/json", cookie: this.cookieHeader() },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    this.store(res);
    const json = await res.json().catch(() => ({}));
    return { status: res.status, headers: res.headers, ...json };
  }
  get(p) { return this.call("GET", p); }
  post(p, b) { return this.call("POST", p, b ?? {}); }
  patch(p, b) { return this.call("PATCH", p, b ?? {}); }
}

let failures = 0;
function check(label, cond, extra) {
  if (cond) console.log(`  ✓ ${label}`);
  else { failures++; console.log(`  ✗ ${label}`, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ""); }
}
function must(r, label) {
  if (!r.ok) { failures++; console.log(`  ✗ ${label}:`, r.status, JSON.stringify(r.error)); throw new Error(label); }
  console.log(`  ✓ ${label}`);
  return r.data;
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function rtClient(token) {
  // Uygulamadaki gibi: token geri çağrıyla verilir (setAuth(token) ilk abonelikten sonra eziliyor)
  return createClient(URL_, KEY, { accessToken: async () => token });
}

/** Kanala abone ol; gelen olayları `events` dizisinde biriktir. */
async function listen(client, topic) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const events = [];
    const channel = client.channel(topic, { config: { private: true } });
    channel.on("broadcast", { event: "*" }, (m) => events.push({ event: m.event, payload: m.payload }));
    const result = await new Promise((resolve) => {
      let done = false;
      channel.subscribe((s, err) => {
        if (done) return;
        if (s === "SUBSCRIBED") { done = true; resolve("ok"); }
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") { done = true; resolve(err?.message ?? s); }
      });
      setTimeout(() => { if (!done) { done = true; resolve("BEKLEME"); } }, 12000);
    });
    if (result === "ok") return { ok: true, events, channel };
    await client.removeChannel(channel);
    if (/unauthorized/i.test(result)) return { ok: false, error: result };
    await sleep(2000 * (attempt + 1));
  }
  return { ok: false, error: "tekrar denemeleri bitti" };
}

const PASSWORD = process.env.SOFRA_DEMO_PASSWORD;
if (!PASSWORD) throw new Error("SOFRA_DEMO_PASSWORD yok");

const customer = new Client("müşteri");
const vendor = new Client("işletme");
const courier = new Client("kurye");
const admin = new Client("yönetici");
const clients = [];

async function main() {
  console.log("\n▶ Girişler");
  must(await customer.post("/api/v1/auth/demo"), "müşteri");
  must(await vendor.post("/api/v1/vendor/auth/login", { email: "kasap-burger-co@sofra.app", password: PASSWORD }), "işletme (Kasap)");
  const otp = must(await courier.post("/api/v1/courier/auth/otp/start", { phone: "5321110004" }), "kurye kodu");
  const courierAuth = must(await courier.post("/api/v1/courier/auth/otp/verify", { challengeId: otp.challengeId, code: otp.devCode }), "kurye");
  must(await admin.post("/api/v1/admin/auth/login", { email: "yonetim@sofra.app", password: PASSWORD }), "yönetici");
  const courierId = courierAuth.courier.id;

  console.log("\n▶ Token ucu");
  const tokens = {};
  for (const [c, role] of [[customer, "customer"], [vendor, "vendor"], [courier, "courier"], [admin, "admin"]]) {
    const r = await c.get(`/api/v1/realtime/token?rol=${role}`);
    tokens[role] = r.data?.accessToken;
    check(`${role}: token + konular ${JSON.stringify(r.data?.topics)}`, r.ok && typeof r.data.accessToken === "string" && Array.isArray(r.data.topics) && r.headers.get("cache-control") === "no-store", r.error);
  }
  const anon = await new Client("anon").get("/api/v1/realtime/token?rol=customer");
  check("oturumsuz → 401", anon.status === 401, anon.status);
  const cross = await customer.get("/api/v1/realtime/token?rol=admin");
  check("müşteri çereziyle yönetici token'ı → 401", cross.status === 401, cross.status);
  const bad = await customer.get("/api/v1/realtime/token?rol=root");
  check("geçersiz rol → 400", bad.status === 400, bad.status);

  console.log("\n▶ Kanal yetkileri");
  const rc = {};
  for (const role of Object.keys(tokens)) { rc[role] = await rtClient(tokens[role]); clients.push(rc[role]); }
  const vendorCh = await listen(rc.vendor, "restaurant:rst_kasap");
  check("işletme kendi restoran kanalını dinliyor", vendorCh.ok, vendorCh.error);
  const vendorOther = await listen(rc.vendor, "restaurant:rst_sekerli");
  check("işletme başka restoranın kanalını dinleyemiyor", !vendorOther.ok, vendorOther);
  const vendorAdmin = await listen(rc.vendor, "admin:ops");
  check("işletme admin:ops dinleyemiyor", !vendorAdmin.ok, vendorAdmin);
  const courierCh = await listen(rc.courier, `courier:${courierId}`);
  check("kurye kendi kanalını dinliyor", courierCh.ok, courierCh.error);
  const courierOther = await listen(rc.courier, "courier:cr_baskasi");
  check("kurye başka kuryenin kanalını dinleyemiyor", !courierOther.ok, courierOther);
  const userCh = await listen(rc.customer, "user:usr_demo");
  check("müşteri kendi kanalını dinliyor", userCh.ok, userCh.error);
  const customerAdmin = await listen(rc.customer, "admin:ops");
  check("müşteri admin:ops dinleyemiyor", !customerAdmin.ok, customerAdmin);
  const adminCh = await listen(rc.admin, "admin:ops");
  check("yönetici admin:ops dinliyor", adminCh.ok, adminCh.error);
  const adminSupport = await listen(rc.admin, "admin:support");
  check("yönetici admin:support dinliyor", adminSupport.ok, adminSupport.error);

  console.log("\n▶ Olay akışı");
  const stale = must(await admin.get("/api/v1/admin/overview"), "açık siparişler");
  for (const l of stale.live) await admin.post(`/api/v1/admin/orders/${l.order.id}`, { action: "cancel", reason: "Realtime testi temizliği" });
  await courier.post("/api/v1/courier/shift", { online: false });
  must(await vendor.patch("/api/v1/vendor/settings", { autoAccept: false, workingHours: { open: "00:00", close: "23:59" }, breakHours: null, temporarilyClosed: false }), "Kasap: elle onay, 24 saat açık");
  must(await courier.post("/api/v1/courier/shift", { online: true, point: { lat: 40.9906, lng: 29.0291 } }), "kurye mesaide (konumla)");
  await sleep(1500);
  vendorCh.events.length = 0; adminCh.events.length = 0; courierCh.events.length = 0;

  const r = must(await customer.get("/api/v1/restaurants/kasap-burger-co?lat=40.9872&lng=29.0263"), "menü");
  const product = r.restaurant.menu.flatMap((c) => c.products).find((p) => !p.soldOut && p.optionGroups.every((g) => !g.required));
  const me = must(await customer.get("/api/v1/auth/me"), "adresler");
  const wallet = must(await customer.get("/api/v1/wallet"), "cüzdan");
  if (wallet.balance < 2000) must(await customer.post("/api/v1/wallet", { amount: 3000 }), "cüzdana yükleme");
  const created = must(await customer.post("/api/v1/orders", {
    restaurantId: r.restaurant.id, addressId: me.addresses[0].id, paymentMethod: "wallet",
    lines: [{ lineId: "ln_rt", productId: product.id, name: product.name, emoji: product.emoji, basePrice: 1, unitPrice: 1, quantity: 1, selections: [] }],
    preferences: { contactless: true, ringDoorbell: false, cutlery: false, note: "" },
  }), "sipariş verildi (onay bekliyor)");
  const orderId = created.order.id;
  const orderCh = await listen(rc.customer, `order:${orderId}`);
  check("müşteri sipariş kanalını dinliyor", orderCh.ok, orderCh.error);
  await sleep(2500);
  const has = (ch, event, pred = () => true) => ch.events.some((e) => e.event === event && pred(e.payload));
  check("işletmeye order_changed geldi (yeni sipariş)", has(vendorCh, "order_changed", (p) => p.id === orderId), vendorCh.events.map((e) => e.event));
  check("yöneticiye order_changed geldi", has(adminCh, "order_changed", (p) => p.id === orderId), adminCh.events.map((e) => e.event));

  must(await vendor.post(`/api/v1/vendor/orders/${orderId}`, { action: "approve", prepMinutes: 10 }), "işletme onayladı");
  await sleep(2500);
  check("müşteriye order_changed (hazırlanıyor)", has(orderCh, "order_changed", (p) => p.status === "preparing"), orderCh.events.map((e) => [e.event, e.payload.status]));
  check("kuryeye offer_changed (yeni teklif)", has(courierCh, "offer_changed", (p) => p.orderId === orderId && p.status === "pending"), courierCh.events.map((e) => [e.event, e.payload.status]));

  const board = must(await courier.get("/api/v1/courier/board"), "kurye panosu");
  check("panoda teklif + kalan süre", board.offer?.orderId === orderId && board.offer.secondsLeft > 30, board.offer && { id: board.offer.orderId, s: board.offer.secondsLeft });
  must(await courier.post(`/api/v1/courier/offers/${board.offer.id}`, { action: "accept" }), "kurye kabul etti");
  await sleep(2500);
  check("kuryeye order_changed (atandı)", has(courierCh, "order_changed", (p) => p.id === orderId && p.courierId === courierId), courierCh.events.map((e) => [e.event, e.payload.courierId]));

  const counts = () => ({ order: orderCh.events.length, vendor: vendorCh.events.length, courier: courierCh.events.length, admin: adminCh.events.length });
  const point = { lat: 40.99 + Math.random() / 100, lng: 29.03 + Math.random() / 100 };
  let before = counts();
  must(await courier.post("/api/v1/courier/location", { point }), "konum bildirimi (yeni nokta)");
  await sleep(2500);
  const movedEvents = orderCh.events.slice(before.order);
  check("müşteriye courier_moved geldi", movedEvents.some((e) => e.event === "courier_moved" && Math.abs(e.payload.courierPoint.lat - point.lat) < 1e-9), movedEvents);
  check("müşteriye konum için order_changed gelmedi", !movedEvents.some((e) => e.event === "order_changed"), movedEvents.map((e) => e.event));
  check("işletmeye konum olayı gitmedi", vendorCh.events.length === before.vendor, vendorCh.events.slice(before.vendor));
  check("kuryeye yalnızca courier_changed gitti", courierCh.events.slice(before.courier).every((e) => e.event === "courier_changed"), courierCh.events.slice(before.courier).map((e) => e.event));

  before = counts();
  must(await courier.post("/api/v1/courier/location", { point }), "aynı noktayı tekrar bildir");
  await sleep(2500);
  const after = counts();
  check("aynı nokta hiçbir ekrana yayın üretmedi", JSON.stringify(after) === JSON.stringify(before), { before, after });

  before = counts();
  must(await customer.post(`/api/v1/orders/${orderId}/cancel`, { reason: "Realtime testi" }), "müşteri iptal etti");
  await sleep(2500);
  check("iptal herkese ulaştı", ["order", "vendor", "courier", "admin"].every((k) => counts()[k] > before[k]), { before, after: counts() });
  must(await courier.post("/api/v1/courier/shift", { online: false }), "kurye mesai kapattı");
  must(await vendor.patch("/api/v1/vendor/settings", { autoAccept: true }), "Kasap: otomatik onay geri açıldı");
}

try {
  await main();
} catch (err) {
  failures++;
  console.log("  ✗ durdu:", err.message);
} finally {
  for (const c of clients) await c.removeAllChannels();
  console.log(failures === 0 ? "\nTÜMÜ GEÇTİ" : `\n${failures} HATA`);
  process.exit(failures === 0 ? 0 : 1);
}
