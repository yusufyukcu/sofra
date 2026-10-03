// Adım E1 (işletme): poligon bölge, ayar doğrulamaları, tükendi gizleme, sipariş geçmişi.
const BASE = process.env.BASE ?? "http://localhost:3000";
const PASSWORD = process.env.SOFRA_DEMO_PASSWORD;

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

const vendor = new Client();
const customer = new Client();
const DEMO = { lat: 40.9872, lng: 29.0263 }; // demo müşteri adresi (Moda)

try {
  must(await vendor.post("/api/v1/vendor/auth/login", { email: "kasap-burger-co@sofra.app", password: PASSWORD }), "işletme girişi (Kasap)");
  must(await customer.post("/api/v1/auth/demo"), "müşteri girişi");
  const settings = must(await vendor.get("/api/v1/vendor/settings"), "ayarlar");
  const original = settings.restaurant;
  const center = original.location;

  console.log("\n▶ Poligon teslimat bölgesi");
  const bad = await vendor.patch("/api/v1/vendor/settings", { deliveryZone: [center, { lat: center.lat + 0.01, lng: center.lng }] });
  check("2 köşeli bölge reddedildi (400 invalid_zone)", bad.status === 400 && bad.error?.code === "invalid_zone", bad);
  const far = await vendor.patch("/api/v1/vendor/settings", { deliveryZone: [center, { lat: center.lat + 1, lng: center.lng }, { lat: center.lat, lng: center.lng + 1 }] });
  check("restorandan çok uzak köşe reddedildi", far.status === 400 && far.error?.code === "invalid_zone", far);

  // Demo adresini dışarıda bırakan küçük üçgen (restoranın hemen çevresi)
  const away = DEMO.lat > center.lat ? -1 : 1;
  const tiny = [
    { lat: center.lat + 0.002 * away, lng: center.lng - 0.002 },
    { lat: center.lat + 0.002 * away, lng: center.lng + 0.002 },
    { lat: center.lat - 0.004 * away, lng: center.lng },
  ];
  const saved = must(await vendor.patch("/api/v1/vendor/settings", { deliveryZone: tiny }), "küçük üçgen kaydedildi");
  check("bölge 3 köşeyle geri döndü", saved.restaurant.deliveryZone?.length === 3, saved.restaurant.deliveryZone);

  const list = must(await customer.get(`/api/v1/restaurants?lat=${DEMO.lat}&lng=${DEMO.lng}`), "restoran listesi");
  check("bölge dışındaki adreste varsayılan listede görünmüyor", !list.restaurants.some((r) => r.id === original.id));
  const listAll = must(await customer.get(`/api/v1/restaurants?lat=${DEMO.lat}&lng=${DEMO.lng}&bolge=0`), "restoran listesi (bölge=0)");
  const kasap = listAll.restaurants.find((r) => r.id === original.id);
  check("bölge=0 ile 'teslim edilemez' olarak listeleniyor", kasap?.deliverable === false, kasap && { deliverable: kasap.deliverable });

  const me = must(await customer.get("/api/v1/auth/me"), "adres");
  const detail = must(await customer.get(`/api/v1/restaurants/${original.slug}?lat=${DEMO.lat}&lng=${DEMO.lng}`), "menü");
  const product = detail.restaurant.menu.flatMap((c) => c.products).find((p) => !p.soldOut && p.optionGroups.every((g) => !g.required));
  const order = await customer.post("/api/v1/orders", {
    restaurantId: original.id, addressId: me.addresses[0].id, paymentMethod: "wallet",
    lines: [{ lineId: "ln_zone", productId: product.id, name: product.name, emoji: product.emoji, basePrice: 1, unitPrice: 1, quantity: 1, selections: [] }],
    preferences: { contactless: false, ringDoorbell: true, cutlery: false },
  });
  check(`bölge dışı sipariş reddedildi (${order.error?.code})`, !order.ok && /zone|area|bolge|delivery/i.test(order.error?.code ?? ""), order.error);

  // Demo adresini kapsayan büyük dörtgen → teslim edilebilir
  const big = [
    { lat: Math.min(center.lat, DEMO.lat) - 0.02, lng: Math.min(center.lng, DEMO.lng) - 0.02 },
    { lat: Math.min(center.lat, DEMO.lat) - 0.02, lng: Math.max(center.lng, DEMO.lng) + 0.02 },
    { lat: Math.max(center.lat, DEMO.lat) + 0.02, lng: Math.max(center.lng, DEMO.lng) + 0.02 },
    { lat: Math.max(center.lat, DEMO.lat) + 0.02, lng: Math.min(center.lng, DEMO.lng) - 0.02 },
  ];
  must(await vendor.patch("/api/v1/vendor/settings", { deliveryZone: big }), "kapsayan dörtgen kaydedildi");
  const list2 = must(await customer.get(`/api/v1/restaurants?lat=${DEMO.lat}&lng=${DEMO.lng}`), "restoran listesi");
  check("bölge içindeki adres 'teslim edilebilir'", list2.restaurants.find((r) => r.id === original.id)?.deliverable === true);

  const cleared = must(await vendor.patch("/api/v1/vendor/settings", { deliveryZone: null }), "bölge kaldırıldı (yarıçapa dönüş)");
  check("bölge null", !cleared.restaurant.deliveryZone, cleared.restaurant.deliveryZone);

  console.log("\n▶ Hazırlık süresi ve tükendi görünümü");
  const prepBad = await vendor.patch("/api/v1/vendor/settings", { defaultPrepMinutes: 3 });
  check("3 dk hazırlık reddedildi", prepBad.status === 400, prepBad);
  const prepOk = must(await vendor.patch("/api/v1/vendor/settings", { defaultPrepMinutes: 25 }), "25 dk kaydedildi");
  check("varsayılan hazırlık 25", prepOk.restaurant.defaultPrepMinutes === 25, prepOk.restaurant.defaultPrepMinutes);

  const target = detail.restaurant.menu.flatMap((c) => c.products)[0];
  must(await vendor.post("/api/v1/vendor/menu/products", { action: "stock", productId: target.id, soldOut: true }), `"${target.name}" tükendi yapıldı`);
  must(await vendor.patch("/api/v1/vendor/settings", { soldOutDisplay: "hide" }), "tükendi: menüden gizle");
  const hidden = must(await customer.get(`/api/v1/restaurants/${original.slug}`), "müşteri menüsü");
  check("tükenen ürün müşteri menüsünde yok", !hidden.restaurant.menu.flatMap((c) => c.products).some((p) => p.id === target.id));
  must(await vendor.patch("/api/v1/vendor/settings", { soldOutDisplay: "dim" }), "tükendi: soluk göster");
  const dimmed = must(await customer.get(`/api/v1/restaurants/${original.slug}`), "müşteri menüsü");
  const dimProduct = dimmed.restaurant.menu.flatMap((c) => c.products).find((p) => p.id === target.id);
  check("tükenen ürün soluk (soldOut=true) görünüyor", dimProduct?.soldOut === true, dimProduct && { soldOut: dimProduct.soldOut });
  must(await vendor.post("/api/v1/vendor/menu/products", { action: "stock", productId: target.id, soldOut: false }), "ürün yeniden satışta");
  must(await vendor.patch("/api/v1/vendor/settings", { defaultPrepMinutes: original.defaultPrepMinutes ?? 20, soldOutDisplay: original.soldOutDisplay ?? "dim" }), "ayarlar eski hâline döndü");

  console.log("\n▶ Sipariş geçmişi");
  const all = must(await vendor.get("/api/v1/vendor/orders?gecmis=1&durum=all&sayfa=1"), "tüm geçmiş");
  check(`toplam ${all.total}, sayfa boyu ${all.pageSize}, ${all.orders.length} satır`, all.total >= all.orders.length && all.orders.length <= all.pageSize);
  const cancelled = must(await vendor.get("/api/v1/vendor/orders?gecmis=1&durum=cancelled"), "yalnızca iptaller");
  check("iptal süzgeci yalnızca iptal döndürüyor", cancelled.orders.every((o) => o.status === "cancelled"), cancelled.orders.map((o) => o.status));
  check("özet iptal sayısı = toplam", cancelled.totals.cancelled === cancelled.total, cancelled.totals);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
  const ranged = must(await vendor.get(`/api/v1/vendor/orders?gecmis=1&baslangic=${today}&bitis=${today}`), "bugünün siparişleri");
  const dayOf = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date(iso));
  check("tarih süzgeci İstanbul gününe göre", ranged.orders.every((o) => dayOf(o.createdAt) === today), ranged.orders.map((o) => o.createdAt).slice(0, 3));
  const future = must(await vendor.get("/api/v1/vendor/orders?gecmis=1&baslangic=2030-01-01&bitis=2030-01-02"), "gelecek aralık");
  check("gelecek aralık boş", future.total === 0 && future.orders.length === 0);
  const page = await fetch(`${BASE}/isletme/gecmis`, { headers: { cookie: vendor.cookieHeader() } });
  check("/isletme/gecmis sayfası açılıyor", page.status === 200, page.status);
} catch (err) {
  failures++;
  console.log("  ✗ durdu:", err.message);
}
console.log(failures === 0 ? "\nTÜMÜ GEÇTİ" : `\n${failures} HATA`);
process.exit(failures === 0 ? 0 : 1);
