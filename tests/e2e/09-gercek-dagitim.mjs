// Gerçek kurye ataması: demo kapalı varsayılan, konumla mesai, bayat konuma teklif yok,
// kurye yokken sipariş bekler, sinyali kesilen kurye mesaiden düşer; anasayfa başvuru afişi.
// Çalıştırma: npm run test:e2e (hepsi) ya da node --env-file-if-exists=.env.local --env-file-if-exists=.env.development.local <dosya>
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const postgres = require("postgres");

const BASE = process.env.BASE ?? "http://localhost:3000";
const PASSWORD = process.env.SOFRA_DEMO_PASSWORD;
const COURIER_PHONE = "5321110003";
const NEAR = { lat: 40.9906, lng: 29.0291 }; // Kadıköy, Kasap Burger Co.'ya yakın
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

const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { ssl: "require", max: 1, onnotice: () => {} });
const admin = new Client();
const vendor = new Client();
const courier = new Client();
const customer = new Client();
let restoreDemo = null;
let restoreStore = null;
let orderId = null;
let courierId = null;

try {
  console.log("\n▶ Varsayılan: gerçek çalışma");
  must(await admin.post("/api/v1/admin/auth/login", { email: "yonetim@sofra.app", password: PASSWORD }), "yönetici girişi");
  const settings = must(await admin.get("/api/v1/admin/settings"), "ayarlar");
  if (settings.settings.demoMode) {
    restoreDemo = true;
    must(await admin.patch("/api/v1/admin/settings", { demoMode: false }), "demo modu test için kapatıldı");
    await sleep(5500);
  }
  const config = must(await new Client().get("/api/v1/config"), "genel ayarlar (/config)");
  check("demo modu kapalı", config.demoMode === false, config);
  const login = await fetch(BASE + "/giris").then((r) => r.text());
  check("giriş ekranında demo düğmesi yok", !login.includes("Demo hesabıyla hızlı giriş"));
  const home = await fetch(BASE + "/").then((r) => r.text());
  check("anasayfada kalıcı 'restoranın olsun' afişi", home.includes("restoranın olsun") && home.includes('href="/isletme-basvuru"'));
  check("açılır pencere yok", !home.includes('aria-labelledby="partner-invite-title"'));
  const cron = await sql`select schedule from cron.job where jobname = 'sofra-idle-couriers'`;
  check(`hayalet kurye temizliği zamanlanmış (${cron[0]?.schedule})`, cron.length === 1);

  console.log("\n▶ Hazırlık");
  must(await vendor.post("/api/v1/vendor/auth/login", { email: "kasap-burger-co@sofra.app", password: PASSWORD }), "işletme girişi (Kasap)");
  const store = must(await vendor.get("/api/v1/vendor/settings"), "mağaza ayarları").restaurant;
  restoreStore = { autoAccept: store.autoAccept, workingHours: store.workingHours, breakHours: store.breakHours ?? null, temporarilyClosed: store.temporarilyClosed };
  must(await vendor.patch("/api/v1/vendor/settings", { autoAccept: true, workingHours: { open: "00:00", close: "23:59" }, breakHours: null, temporarilyClosed: false }), "Kasap: otomatik onay, 24 saat açık");
  // Başka testlerden mesaide kalan kurye varsa çıkar (askıya al + geri aç)
  const overview = must(await admin.get("/api/v1/admin/overview"), "canlı operasyon");
  for (const c of overview.couriers) {
    await admin.post(`/api/v1/admin/couriers/${c.id}`, { action: "suspend", reason: "Gerçek dağıtım testi" });
    await admin.post(`/api/v1/admin/couriers/${c.id}`, { action: "activate" });
  }
  const otp = must(await courier.post("/api/v1/courier/auth/otp/start", { phone: COURIER_PHONE }), "kurye kodu");
  const auth = must(await courier.post("/api/v1/courier/auth/otp/verify", { challengeId: otp.challengeId, code: otp.devCode }), "kurye girişi");
  courierId = auth.courier.id;
  must(await customer.post("/api/v1/auth/demo"), "müşteri girişi (geliştirme)");

  console.log("\n▶ Konumu bayat kurye teklif almaz");
  must(await courier.post("/api/v1/courier/shift", { online: true }), "kurye konumsuz mesaiye girdi");
  await sql`update public.couriers set location_updated_at = now() - interval '30 minutes' where id = ${courierId}`;
  const detail = must(await customer.get("/api/v1/restaurants/kasap-burger-co?lat=40.9872&lng=29.0263"), "menü");
  const product = detail.restaurant.menu.flatMap((c) => c.products).find((p) => !p.soldOut && p.optionGroups.every((g) => !g.required));
  const me = must(await customer.get("/api/v1/auth/me"), "adres");
  const created = must(await customer.post("/api/v1/orders", {
    restaurantId: detail.restaurant.id, addressId: me.addresses[0].id, paymentMethod: "cash_on_delivery",
    lines: [{ lineId: "ln_real", productId: product.id, name: product.name, emoji: product.emoji, basePrice: 1, unitPrice: 1, quantity: 2, selections: [] }],
    preferences: { contactless: false, ringDoorbell: true, cutlery: false },
  }), "sipariş verildi");
  orderId = created.order.id;
  check("sipariş hazırlanıyor (otomatik onay)", created.order.status === "preparing", created.order.status);
  await sleep(7000); // en az bir dağıtım turu (5 sn)
  let board = must(await courier.get("/api/v1/courier/board"), "kurye panosu");
  check("konumu 30 dk önce gelen kuryeye teklif yok", !board.offer, board.offer && { order: board.offer.orderId });
  let tracking = must(await customer.get(`/api/v1/orders/${orderId}`), "müşteri takibi");
  check("sipariş kurye bekliyor; kurye ve uydurma kurye konumu yok", !tracking.order.courier && !tracking.order.courierPoint && tracking.order.status === "preparing", { courier: tracking.order.courier, point: tracking.order.courierPoint });

  console.log("\n▶ Konum gelince en yakın kurye olarak teklif alır");
  must(await courier.post("/api/v1/courier/location", { point: NEAR }), "kurye konumunu gönderdi");
  let offer = null;
  for (let i = 0; i < 6 && !offer; i++) {
    await sleep(2000);
    board = must(await courier.get("/api/v1/courier/board"), i === 0 ? "kurye panosu" : "kurye panosu (tekrar)");
    offer = board.offer?.orderId === orderId ? board.offer : null;
  }
  check(`teklif geldi (${offer?.secondsLeft} sn, ${offer?.fee} ₺)`, Boolean(offer), board.offer);
  must(await courier.post(`/api/v1/courier/offers/${offer.id}`, { action: "accept" }), "kurye kabul etti");
  tracking = must(await customer.get(`/api/v1/orders/${orderId}`), "müşteri takibi");
  check("siparişi gerçek kurye üstlendi, konumu cihazından", tracking.order.courier?.id === courierId && tracking.order.courierPoint?.lat === NEAR.lat, { courier: tracking.order.courier, point: tracking.order.courierPoint });
  must(await customer.post(`/api/v1/orders/${orderId}/cancel`, { reason: "Gerçek dağıtım testi" }), "müşteri iptal etti");
  orderId = null;

  console.log("\n▶ Sinyali kesilen kurye mesaiden düşer");
  await sql`update public.couriers set location_updated_at = now() - interval '20 minutes' where id = ${courierId}`;
  await sql`select app_private.expire_idle_couriers()`;
  const [row] = await sql`select online from public.couriers where id = ${courierId}`;
  check("15 dk sinyal yoksa mesaiden düştü", row.online === false, row);
  const me2 = must(await courier.get("/api/v1/courier/auth/me"), "kurye durumu");
  check("kurye uygulaması mesai kapalı görüyor", me2.courier.online === false, me2.courier.online);
  must(await courier.post("/api/v1/courier/shift", { online: true, point: NEAR }), "konumla yeniden mesaiye girdi");
  await sql`select app_private.expire_idle_couriers()`;
  const [row2] = await sql`select online from public.couriers where id = ${courierId}`;
  check("taze konumlu kurye mesaide kalıyor", row2.online === true, row2);
} catch (err) {
  failures++;
  console.log("  ✗ durdu:", err.message);
} finally {
  if (orderId) await customer.post(`/api/v1/orders/${orderId}/cancel`, { reason: "Test temizliği" }).catch(() => undefined);
  await courier.post("/api/v1/courier/shift", { online: false }).catch(() => undefined);
  if (restoreStore) await vendor.patch("/api/v1/vendor/settings", restoreStore).catch(() => undefined);
  if (restoreDemo) await admin.patch("/api/v1/admin/settings", { demoMode: true }).catch(() => undefined);
  await sql.end();
}
console.log(failures === 0 ? "\nTÜMÜ GEÇTİ" : `\n${failures} HATA`);
process.exit(failures === 0 ? 0 : 1);
