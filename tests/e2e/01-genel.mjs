// Uçtan uca API testi — dört rol aynı anda. Kullanım: node e2e.mjs [bölüm]
const BASE = process.env.BASE ?? "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Client {
  constructor(name) { this.name = name; this.jar = new Map(); }
  cookieHeader() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "); }
  store(res) {
    const list = res.headers.getSetCookie?.() ?? [];
    for (const raw of list) {
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
    return { status: res.status, ...json };
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

const customer = new Client("müşteri");
const vendor = new Client("işletme");
const courier = new Client("kurye");
const admin = new Client("yönetici");
const POINT = { lat: 40.9872, lng: 29.0263 }; // demo adres (Moda)

function defaultLine(product) {
  const selections = [];
  for (const g of product.optionGroups) {
    let picked = g.options.filter((o) => o.default && !o.soldOut).map((o) => o.id);
    if (g.type === "single" && picked.length === 0 && g.required) picked = [g.options.find((o) => !o.soldOut).id];
    if (g.type === "multi" && g.minSelect) picked = g.options.filter((o) => !o.soldOut).slice(0, g.minSelect).map((o) => o.id);
    if (picked.length) selections.push({ groupId: g.id, groupName: g.name, optionIds: picked, optionNames: [], priceDelta: 0 });
  }
  return { lineId: "ln_test_" + Math.random().toString(36).slice(2, 7), productId: product.id, name: product.name, emoji: product.emoji, basePrice: 1, unitPrice: 1, quantity: 2, selections };
}

async function placeOrder(restaurantSlug, payment = "wallet", extra = {}) {
  const r = must(await customer.get(`/api/v1/restaurants/${restaurantSlug}?lat=${POINT.lat}&lng=${POINT.lng}`), `restoran detayı (${restaurantSlug})`);
  const products = r.restaurant.menu.flatMap((c) => c.products).filter((p) => !p.soldOut);
  const lines = [defaultLine(products[0]), defaultLine(products[1])];
  const me = must(await customer.get("/api/v1/auth/me"), "auth/me");
  const quote = must(await customer.post("/api/v1/coupons/validate", { restaurantId: r.restaurant.id, lines, paymentMethod: payment }), "tutar hesabı");
  const created = await customer.post("/api/v1/orders", {
    restaurantId: r.restaurant.id, addressId: me.addresses[0].id, lines, paymentMethod: payment,
    mealCardBrand: payment === "meal_card" ? "multinet" : undefined,
    preferences: { contactless: true, ringDoorbell: false, cutlery: false, note: "Test" }, ...extra,
  });
  const data = must(created, `sipariş oluştu (${payment}, ${quote.totals.grandTotal} ₺)`);
  return { order: data.order, walletBalance: data.walletBalance, quote, restaurant: r.restaurant };
}

async function main() {
  console.log("\n▶ Girişler");
  const PASSWORD = process.env.SOFRA_DEMO_PASSWORD;
  if (!PASSWORD) throw new Error("SOFRA_DEMO_PASSWORD yok (node --env-file=.env.development.local)");
  const demo = must(await customer.post("/api/v1/auth/demo"), "müşteri demo girişi (Supabase oturumu)");
  check("mobil için erişim ve yenileme token'ı döndü", Boolean(demo.accessToken && demo.refreshToken), Object.keys(demo));
  check("müşteri çerezi httpOnly", [...customer.jar.keys()].some((k) => k.startsWith("sofra-auth-musteri")), [...customer.jar.keys()]);

  const wrong = await vendor.post("/api/v1/vendor/auth/login", { email: "kasap-burger-co@sofra.app", password: "yanlis-parola" });
  check("yanlış parola reddedildi", wrong.status === 401 && wrong.error?.code === "invalid_credentials", wrong.error);
  must(await vendor.post("/api/v1/vendor/auth/login", { email: "kasap-burger-co@sofra.app", password: PASSWORD }), "işletme girişi (Kasap, e-posta + parola)");
  const crossRole = await new Client("karışık").post("/api/v1/admin/auth/login", { email: "kasap-burger-co@sofra.app", password: PASSWORD });
  check("işletme hesabıyla yönetici paneline girilemiyor", crossRole.status === 403 && crossRole.error?.code === "wrong_account_type", crossRole.error);

  const otp = must(await courier.post("/api/v1/courier/auth/otp/start", { phone: "5321110001" }), "kurye kodu istendi");
  check("test modunda kod ekranda (devCode)", /^\d{6}$/.test(otp.devCode ?? ""), otp);
  const badCode = await courier.post("/api/v1/courier/auth/otp/verify", { challengeId: otp.challengeId, code: "000000" });
  check("hatalı kod reddedildi", badCode.error?.code === "otp_invalid", badCode.error);
  must(await courier.post("/api/v1/courier/auth/otp/verify", { challengeId: otp.challengeId, code: otp.devCode }), "kurye girişi (Mert, telefon + kod)");
  const reuse = await new Client("tekrar").post("/api/v1/courier/auth/otp/verify", { challengeId: otp.challengeId, code: otp.devCode });
  check("aynı kod ikinci kez kullanılamıyor", reuse.error?.code === "otp_not_found", reuse.error);

  must(await admin.post("/api/v1/admin/auth/login", { email: "yonetim@sofra.app", password: PASSWORD }), "yönetici girişi (e-posta + parola)");

  console.log("\n▶ Rol ayrımı ve Bearer (mobil)");
  const asCustomerOnCourier = await customer.get("/api/v1/courier/board");
  check("müşteri oturumuyla kurye ucu 401", asCustomerOnCourier.status === 401, asCustomerOnCourier.status);
  const bearer = await fetch(`${BASE}/api/v1/auth/me`, { headers: { authorization: `Bearer ${demo.accessToken}` } }).then((r) => r.json());
  check("çerezsiz, yalnızca Bearer ile /auth/me çalışıyor", bearer.ok && bearer.data.user.id === "usr_demo", bearer.error);
  const bearerWrongRole = await fetch(`${BASE}/api/v1/vendor/orders`, { headers: { authorization: `Bearer ${demo.accessToken}` } });
  check("müşteri token'ıyla işletme ucu 401", bearerWrongRole.status === 401, bearerWrongRole.status);
  const refreshed = must(await new Client("mobil").post("/api/v1/auth/refresh", { refreshToken: demo.refreshToken }), "mobil oturum yenileme");
  check("yenilemede rol korunuyor", refreshed.role === "customer" && refreshed.accessToken !== demo.accessToken, refreshed.role);
  const pageRedirect = await fetch(`${BASE}/yonetim`, { redirect: "manual" });
  check("oturumsuz /yonetim → giriş sayfasına yönlendirme", pageRedirect.status === 307 && pageRedirect.headers.get("location")?.includes("/yonetim/giris"), pageRedirect.status);
  const pageOk = await fetch(`${BASE}/yonetim`, { redirect: "manual", headers: { cookie: admin.cookieHeader() } });
  check("yönetici oturumuyla /yonetim açılıyor", pageOk.status === 200, pageOk.status);

  console.log("\n▶ Temizlik (önceki denemelerden kalan açık siparişler)");
  const stale = must(await admin.get("/api/v1/admin/overview"), "canlı operasyon");
  for (const l of stale.live) await admin.post(`/api/v1/admin/orders/${l.order.id}`, { action: "cancel", reason: "Test temizliği" });
  console.log(`    ${stale.live.length} açık sipariş iptal edildi`);
  await courier.post("/api/v1/courier/shift", { online: false });

  console.log("\n▶ Keşif ve güvenlik");
  const list = must(await customer.get(`/api/v1/restaurants?lat=${POINT.lat}&lng=${POINT.lng}`), "restoran listesi");
  check(`listede ${list.restaurants.length} restoran, öne çıkan ${list.featured?.length}`, list.restaurants.length > 5 && list.featured?.length === 3);
  const pending = await customer.get("/api/v1/restaurants/bogaz-manti-evi");
  check("onaysız restoran API'den 404 (hata #6)", pending.status === 404, pending.status);
  const noAuth = await new Client("anon").get("/api/v1/auth/me");
  check("oturumsuz /auth/me → 401", noAuth.status === 401);

  // Hazırlık süresini kısalt (demo hızı 12×: 5 dk → 25 sn)
  must(await vendor.patch("/api/v1/vendor/settings", { defaultPrepMinutes: 5, autoAccept: true, workingHours: { open: "00:00", close: "23:59" }, breakHours: null, temporarilyClosed: false }), "işletme: hazırlık 5 dk, otomatik onay, 24 saat açık");
  const topped = must(await customer.post("/api/v1/wallet", { amount: 5000 }), "cüzdana 5000 ₺ yüklendi");
  check("yükleme defterde görünüyor", topped.transactions[0]?.kind === "topup" && topped.transactions[0]?.direction === "in", topped.transactions[0]);

  console.log("\n▶ Kurye mesaisi ve teklif");
  must(await courier.post("/api/v1/courier/shift", { online: true, point: { lat: 40.9906, lng: 29.0291 } }), "kurye mesaiye başladı (konumla)");
  const before = must(await customer.get("/api/v1/wallet"), "cüzdan");
  const o1 = await placeOrder("kasap-burger-co", "wallet");
  check("otomatik onay → Hazırlanıyor", o1.order.status === "preparing", o1.order.status);
  check("cüzdan düştü", Math.abs(before.balance - o1.order.totals.grandTotal - o1.walletBalance) < 0.01, { before: before.balance, total: o1.order.totals.grandTotal, after: o1.walletBalance });
  await sleep(1500);
  let board = must(await courier.get("/api/v1/courier/board"), "kurye panosu");
  check("teklif kuryeye düştü", board.offer?.orderId === o1.order.id, board.offer);
  check("teklifte müşterinin gerçek telefonu yok", board.offer && board.offer.order.address.contactPhone === undefined, board.offer?.order?.address);
  must(await courier.post(`/api/v1/courier/offers/${board.offer.id}`, { action: "accept" }), "teklif kabul edildi");

  console.log("\n▶ Hata #1: kurye kabul ettikten sonra müşteri iptal ediyor");
  const cancel = must(await customer.post(`/api/v1/orders/${o1.order.id}/cancel`, { reason: "Test iptali" }), "müşteri iptal etti");
  check(`iade ${cancel.refunded} ₺ = sipariş tutarı`, Math.abs(cancel.refunded - o1.order.totals.grandTotal) < 0.01);
  board = must(await courier.get("/api/v1/courier/board"), "kurye panosu");
  check("kuryenin üzerinde açık teslimat kalmadı", board.activeOrder === null, board.activeOrder?.status);
  const off = await courier.post("/api/v1/courier/shift", { online: false });
  check("kurye mesaiyi kapatabiliyor", off.ok, off.error);
  must(await courier.post("/api/v1/courier/shift", { online: true, point: { lat: 40.9906, lng: 29.0291 } }), "kurye tekrar mesaide");

  console.log("\n▶ Tam teslimat akışı");
  const o2 = await placeOrder("kasap-burger-co", "online_card");
  await sleep(1500);
  board = must(await courier.get("/api/v1/courier/board"), "kurye panosu");
  check("yeni teklif geldi", board.offer?.orderId === o2.order.id, board.offer?.orderId);
  must(await courier.post(`/api/v1/courier/offers/${board.offer.id}`, { action: "accept" }), "kabul");
  must(await courier.post(`/api/v1/courier/orders/${o2.order.id}`, { action: "arrived" }), "restorana vardım");
  const picked = must(await courier.post(`/api/v1/courier/orders/${o2.order.id}`, { action: "pickup" }), "teslim aldım");
  check("müşteri tarafında Yolda", picked.order.status === "on_the_way");
  must(await courier.post("/api/v1/courier/location", { point: { lat: 40.985, lng: 29.0265 } }), "konum bildirimi");
  const tracked = must(await customer.get(`/api/v1/orders/${o2.order.id}`), "müşteri takibi");
  check("müşteri haritası kuryenin konumunu görüyor", tracked.order.courierPoint?.lat === 40.985, tracked.order.courierPoint);
  const delivered = must(await courier.post(`/api/v1/courier/orders/${o2.order.id}`, { action: "deliver" }), "teslim ettim");
  check("Teslim edildi", delivered.order.status === "delivered");
  const { report: earnings } = must(await courier.get("/api/v1/courier/earnings"), "kurye kazancı");
  check("kazanç yazıldı ve hakedişe tahakkuk etti", earnings.totals.deliveries >= 1 && earnings.payouts.length >= 1, earnings.totals);
  const { report: perf } = must(await courier.get("/api/v1/courier/performance"), "kurye performansı");
  check(`kabul oranı %${perf.acceptanceRate}, ortalama ${perf.avgDeliveryMinutes} dk`, perf.offers.accepted >= 2, perf.offers);

  console.log("\n▶ Hata #5: değerlendirme restoran puanını güncelliyor + bahşiş");
  const rBefore = must(await vendor.get("/api/v1/vendor/reviews"), "işletme yorumları");
  const w0 = (await customer.get("/api/v1/wallet")).data.balance;
  const rated = must(await customer.post(`/api/v1/orders/${o2.order.id}/rating`, { restaurantScore: 1, restaurantComment: "Test yorumu", courierScore: 5, courierTip: 20 }), "değerlendirme + 20 ₺ bahşiş");
  check("bahşiş cüzdandan düştü", Math.abs(w0 - 20 - rated.walletBalance) < 0.01, { w0, after: rated.walletBalance });
  const rAfter = must(await vendor.get("/api/v1/vendor/reviews"), "işletme yorumları");
  check(`restoran puan sayısı arttı (${rBefore.ratingCount} → ${rAfter.ratingCount})`, rAfter.ratingCount === rBefore.ratingCount + 1);
  const wallet = must(await customer.get("/api/v1/wallet"), "cüzdan hareketleri");
  const kinds = wallet.transactions.map((t) => t.kind);
  check("defterde ödeme, iade ve bahşiş var", ["order_payment", "order_refund", "tip"].every((k) => kinds.includes(k)), kinds.slice(0, 8));

  console.log("\n▶ Hata #3: onaylanan haftaya sonradan gelen hakediş kaybolmuyor");
  let fin = must(await admin.get("/api/v1/admin/finance"), "yönetici finans");
  const vendorPending = fin.payouts.find((p) => p.kind === "vendor" && p.targetId === "rst_kasap" && p.status === "pending");
  check("Kasap için bekleyen hakediş var", Boolean(vendorPending), fin.payouts.map((p) => [p.kind, p.targetId, p.status]));
  must(await admin.post(`/api/v1/admin/payouts/${vendorPending.id}`, { action: "approve" }), "hakediş onaylandı");
  const o3 = await placeOrder("kasap-burger-co", "cash_on_delivery");
  await sleep(1500);
  board = must(await courier.get("/api/v1/courier/board"), "kurye panosu");
  must(await courier.post(`/api/v1/courier/offers/${board.offer.id}`, { action: "accept" }), "kabul");
  for (const action of ["arrived", "pickup", "deliver"]) must(await courier.post(`/api/v1/courier/orders/${o3.order.id}`, { action }), action);
  fin = must(await admin.get("/api/v1/admin/finance"), "yönetici finans");
  const kasapRows = fin.payouts.filter((p) => p.kind === "vendor" && p.targetId === "rst_kasap");
  check("aynı hafta için 'ek' hakediş açıldı, onaylı tutar donmuş", kasapRows.some((p) => p.status === "approved") && kasapRows.some((p) => p.status === "pending" && p.periodLabel.includes("ek")), kasapRows.map((p) => [p.periodLabel, p.status, p.net]));
  const cod = fin.gateway.find((g) => g.method === "cash_on_delivery");
  check("kapıda nakit ödeme tahsil edildi olarak sayıldı", cod && cod.volume > 0, cod);

  console.log("\n▶ Hata #4: iade üst sınırı");
  const total = o2.order.totals.grandTotal;
  const part = must(await admin.post(`/api/v1/admin/orders/${o2.order.id}`, { action: "refund", amount: 50, reason: "Eksik ürün" }), "50 ₺ kısmi iade");
  const tooMuch = await admin.post(`/api/v1/admin/orders/${o2.order.id}`, { action: "refund", amount: total, reason: "Tekrar" });
  check("kalan tutarı aşan iade reddedildi", !tooMuch.ok && tooMuch.error?.code === "amount_too_large", tooMuch.error);
  must(await admin.post(`/api/v1/admin/orders/${o2.order.id}`, { action: "refund", amount: Math.round((total - 50) * 100) / 100, reason: "Kalan" }), "kalan tutar iade edildi");
  const again = await admin.post(`/api/v1/admin/orders/${o2.order.id}`, { action: "refund", amount: 1, reason: "Bir daha" });
  check("tamamı iade edilmiş siparişe yeni iade yok", !again.ok && again.error?.code === "already_refunded", again.error);
  const search = must(await admin.get(`/api/v1/admin/orders?q=${o2.order.code}`), "yönetici sipariş araması");
  check("teslim edilmiş sipariş aramada bulundu", search.orders[0]?.id === o2.order.id && search.orders[0]?.refundedTotal === total);

  console.log("\n▶ Hata #2: vardiyada kurye varken sipariş kendiliğinden ilerlemiyor");
  const o4 = await placeOrder("kasap-burger-co", "wallet");
  await sleep(1500);
  board = must(await courier.get("/api/v1/courier/board"), "kurye panosu");
  must(await courier.post(`/api/v1/courier/offers/${board.offer.id}`, { action: "reject" }), "kurye teklifi reddetti");
  console.log("    … hazırlık süresi (25 sn) + pay bekleniyor");
  await sleep(36_000);
  const waiting = must(await customer.get(`/api/v1/orders/${o4.order.id}`), "müşteri takibi");
  check("sipariş hâlâ Hazırlanıyor (kuryesiz Yolda yok)", waiting.order.status === "preparing" && !waiting.order.courier, { status: waiting.order.status, courier: waiting.order.courier });
  const ops = must(await admin.get("/api/v1/admin/overview"), "canlı operasyon");
  const live = ops.live.find((l) => l.order.id === o4.order.id);
  check("yönetici ekranında 'kurye bekliyor' görünüyor", live?.waitingCourier === true, live && { waitingCourier: live.waitingCourier });
  must(await admin.post(`/api/v1/admin/orders/${o4.order.id}`, { action: "cancel", reason: "Test temizliği" }), "yönetici iptal etti");

  console.log("\n▶ Destek: temsilci kuyruğu");
  const chat = must(await customer.post("/api/v1/support/chat", { quickReplyId: "missing_item", orderId: o2.order.id }), "eksik ürün bildirimi");
  check("konuşma temsilci kuyruğunda", chat.session.escalated === true && chat.session.status === "waiting_agent", chat.session.status);
  check("bot sahte vaat vermiyor", !JSON.stringify(chat.session.messages).includes("50 ₺"));
  const overview = must(await admin.get("/api/v1/admin/overview"), "yönetici özeti");
  check("yönetici KPI: temsilci bekleyen ≥ 1", overview.kpi.waitingSupport >= 1, overview.kpi.waitingSupport);

  console.log("\n▶ Pazarlama: push → bildirim kutusu");
  const push = must(await admin.post("/api/v1/admin/marketing", { action: "push-send", push: { title: "Test kampanyası", body: "Bu bir test bildirimidir.", segment: "all" } }), "push gönderildi");
  check(`hedef kitle ${push.sent.recipientCount} kişi`, push.sent.recipientCount >= 1);

  must(await courier.post("/api/v1/courier/shift", { online: false }), "kurye mesaiyi kapattı");
  console.log(failures ? `\n✗ ${failures} kontrol başarısız` : "\n✓ Tüm kontroller geçti");
  process.exitCode = failures ? 1 : 0;
}

main().catch((err) => { console.error("\nTest durdu:", err.message); process.exitCode = 1; });
