// Kartlar, bildirimler (+ push aboneliği) ve maskeli arama — uçtan uca.
import crypto from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
const postgres = require("postgres");

const BASE = process.env.BASE ?? "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const COURIER_PHONE = process.env.COURIER_PHONE ?? "5321110001";

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
    const text = await res.text();
    let json = {};
    try { json = JSON.parse(text); } catch { /* boş gövde */ }
    return { status: res.status, raw: text, ...json };
  }
  get(p) { return this.call("GET", p); }
  post(p, b) { return this.call("POST", p, b ?? {}); }
  patch(p, b) { return this.call("PATCH", p, b ?? {}); }
  del(p) { return this.call("DELETE", p); }
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

const customer = new Client();
const courier = new Client();
const vendor = new Client();
const fresh = new Client();
const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { ssl: "require", max: 1, onnotice: () => {} });
let rt = null;
const addedCards = [];
let orderId = null;

async function placeOrder(paymentMethod, cardId) {
  const detail = must(await customer.get("/api/v1/restaurants/kasap-burger-co?lat=40.9872&lng=29.0263"), "menü");
  const product = detail.restaurant.menu.flatMap((c) => c.products).find((p) => !p.soldOut && p.optionGroups.every((g) => !g.required));
  const me = must(await customer.get("/api/v1/auth/me"), "adres");
  return customer.post("/api/v1/orders", {
    restaurantId: detail.restaurant.id, addressId: me.addresses[0].id, paymentMethod, cardId,
    lines: [{ lineId: "ln_e3", productId: product.id, name: product.name, emoji: product.emoji, basePrice: 1, unitPrice: 1, quantity: 2, selections: [] }],
    preferences: { contactless: true, ringDoorbell: false, cutlery: false },
  });
}

try {
  console.log("\n▶ Girişler");
  const demo = must(await customer.post("/api/v1/auth/demo"), "müşteri");
  const otp = must(await courier.post("/api/v1/courier/auth/otp/start", { phone: COURIER_PHONE }), "kurye kodu");
  const courierAuth = must(await courier.post("/api/v1/courier/auth/otp/verify", { challengeId: otp.challengeId, code: otp.devCode }), "kurye");
  must(await vendor.post("/api/v1/vendor/auth/login", { email: "kasap-burger-co@sofra.app", password: process.env.SOFRA_DEMO_PASSWORD }), "işletme");
  must(await vendor.patch("/api/v1/vendor/settings", { autoAccept: true, workingHours: { open: "00:00", close: "23:59" }, breakHours: null, temporarilyClosed: false, paymentMethods: ["online_card", "wallet", "cash_on_delivery", "card_on_delivery", "meal_card"] }), "Kasap: otomatik onay, 24 saat, tüm ödemeler");
  const me = must(await customer.get("/api/v1/auth/me"), "profil");
  const realPhone = me.user.phone;

  console.log("\n▶ Kartlar (ödeme simülasyonu)");
  const list = must(await customer.get("/api/v1/cards"), "kart listesi");
  check("simülasyon modu bildiriliyor", list.simulated === true);
  const cases = [
    [{ number: "4242424242424241", expiry: "12/30", cvc: "123", holder: "Deneme Kişi" }, "invalid_card_number", "Luhn hatası"],
    [{ number: "4111111111111111", expiry: "12/30", cvc: "123", holder: "Deneme Kişi" }, "test_card_required", "test kartı olmayan numara"],
    [{ number: "4242424242424242", expiry: "01/20", cvc: "123", holder: "Deneme Kişi" }, "card_expired", "süresi geçmiş"],
    [{ number: "4242424242424242", expiry: "13/30", cvc: "123", holder: "Deneme Kişi" }, "invalid_expiry", "geçersiz ay"],
    [{ number: "4242424242424242", expiry: "12/30", cvc: "12", holder: "Deneme Kişi" }, "invalid_cvc", "kısa CVC"],
    [{ number: "4242424242424242", expiry: "12/30", cvc: "123", holder: "A" }, "invalid_holder", "kısa ad"],
  ];
  for (const [body, code, label] of cases) {
    const r = await customer.post("/api/v1/cards", body);
    check(`${label} → ${code}`, !r.ok && r.error?.code === code, r.error);
  }
  for (const c of list.cards) {
    // Önceki test koşularından kalan test kartlarını temizle (tohum kartlarına dokunma)
    if (/^(E3|red)/.test(c.nickname)) await customer.del(`/api/v1/cards/${c.id}`);
  }
  const good = must(await customer.post("/api/v1/cards", { number: "4242 4242 4242 4242", expiry: "12/30", cvc: "123", holder: "Deneme Kişi", nickname: "E3 visa" }), "Visa test kartı eklendi");
  const goodCard = good.cards.find((c) => c.nickname === "E3 visa");
  addedCards.push(goodCard.id);
  check("yanıtta yalnızca son 4 hane ve marka (numara/CVC yok)", goodCard.last4 === "4242" && goodCard.brand === "visa" && !/4242424242424242|"cvc"|providerToken|provider_token/.test(JSON.stringify(good)), goodCard);
  check("kart sahibi büyük harfe çevrildi", goodCard.holder === "DENEME KİŞİ", goodCard.holder);
  const dup = await customer.post("/api/v1/cards", { number: "4242424242424242", expiry: "12/30", cvc: "321", holder: "Deneme Kişi" });
  check("aynı kart ikinci kez → 409 card_exists", dup.status === 409 && dup.error?.code === "card_exists", dup.error);
  const [stored] = await sql`select provider_token from public.saved_cards where id = ${goodCard.id}`;
  check("veritabanında kart numarası yok, sahte sağlayıcı token'ı var", /^tok_sim_/.test(stored.provider_token ?? ""), stored);
  const red = must(await customer.post("/api/v1/cards", { number: "4000000000000002", expiry: "12/30", cvc: "123", holder: "Deneme Kişi", nickname: "red e3" }), "reddedilir test kartı eklendi");
  const redCard = red.cards.find((c) => c.nickname === "red e3");
  addedCards.push(redCard.id);

  const topBad = await customer.post("/api/v1/wallet", { amount: 25, cardId: redCard.id });
  check("reddedilen kartla bakiye yükleme → 402 card_declined", topBad.status === 402 && topBad.error?.code === "card_declined", topBad.error);
  const topOk = must(await customer.post("/api/v1/wallet", { amount: 25, cardId: goodCard.id }), "Visa ile 25 ₺ yüklendi");
  check("hareket kartı gösteriyor", /VISA •••• 4242/.test(topOk.transactions[0]?.label ?? ""), topOk.transactions[0]);
  const orderBad = await placeOrder("online_card", redCard.id);
  check("reddedilen kartla sipariş → 402 card_declined", orderBad.status === 402 && orderBad.error?.code === "card_declined", orderBad.error);
  const otherCard = await placeOrder("online_card", "card_baskasinin");
  check("başkasının kartı → card_not_found", otherCard.error?.code === "card_not_found", otherCard.error);

  // Kartı olmayan yeni müşteri: online ödeme ve yükleme kart ister
  const freshOtp = must(await fresh.post("/api/v1/auth/otp/start", { channel: "phone", target: `555${String(Date.now()).slice(-7)}` }), "yeni müşteri kodu");
  must(await fresh.post("/api/v1/auth/otp/verify", { challengeId: freshOtp.challengeId, code: freshOtp.devCode, name: "Kartsız Deneme" }), "yeni müşteri girişi");
  const noCard = await fresh.post("/api/v1/wallet", { amount: 10 });
  check("kartsız müşteri bakiye yükleyemiyor → card_required", noCard.error?.code === "card_required", noCard.error);

  console.log("\n▶ Bildirimler");
  const tokenRes = await customer.get("/api/v1/realtime/token?rol=customer");
  rt = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { accessToken: async () => tokenRes.data.accessToken });
  await rt.realtime.setAuth();
  const events = [];
  const joined = await new Promise((resolve) => {
    const ch = rt.channel(`user:${me.user.id}`, { config: { private: true } });
    ch.on("broadcast", { event: "notification" }, (m) => events.push(m.payload));
    ch.subscribe((s, err) => { if (s === "SUBSCRIBED") resolve(true); else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") resolve(err?.message ?? s); });
    setTimeout(() => resolve("BEKLEME"), 12000);
  });
  check("müşteri user kanalına bağlandı", joined === true, joined);

  must(await courier.post("/api/v1/courier/shift", { online: false }), "kurye mesai kapalı (temiz başlangıç)");
  must(await courier.post("/api/v1/courier/shift", { online: true }), "kurye mesaide");
  const created = await placeOrder("online_card", goodCard.id);
  const order = must(created, "Visa ile online sipariş verildi").order;
  orderId = order.id;
  check("otomatik onay → hazırlanıyor", order.status === "preparing", order.status);
  const [pay] = await sql`select card_brand, card_last4, status from public.payments where order_id = ${orderId}`;
  check("ödeme kaydı kartla (visa •••• 4242) çekildi", pay && pay.card_brand === "visa" && pay.card_last4 === "4242" && pay.status === "captured", pay);
  check("sipariş etiketinde kart hanesi yok (restoran/kurye görmez)", !/4242/.test(order.paymentLabel), order.paymentLabel);
  await sleep(2500);
  const ev = events.find((e) => e.href === `/siparis/${orderId}`);
  check(`Realtime bildirim geldi: "${ev?.title}"`, ev && ev.kind === "order" && ev.title === "Siparişin hazırlanıyor", events);
  const inbox = must(await customer.get("/api/v1/notifications"), "bildirim kutusu");
  const item = inbox.notifications.find((n) => n.href === `/siparis/${orderId}`);
  check("kutuda sipariş bildirimi (tür: order, okunmamış)", item && item.kind === "order" && !item.readAt, item);
  check(`okunmamış sayısı ${inbox.unread}`, inbox.unread >= 1);
  const read = must(await customer.post("/api/v1/notifications", { action: "read", ids: [item.id] }), "tek bildirim okundu");
  check("okunmamış sayısı azaldı", read.unread === inbox.unread - 1, { before: inbox.unread, after: read.unread });
  const readAll = must(await customer.post("/api/v1/notifications", { action: "read" }), "tümü okundu");
  check("okunmamış 0", readAll.unread === 0, readAll);

  // Push aboneliği: gerçek P-256 anahtarı, erişilemeyen uç → şifreleme çalışır, gönderim hata sayar
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const endpoint = `https://push.sofra-test.invalid/e3/${Date.now()}`;
  const sub = must(await customer.post("/api/v1/push", { action: "subscribe", subscription: { endpoint, keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: crypto.randomBytes(16).toString("base64url") } } }), "push aboneliği kaydedildi");
  check(`cihaz sayısı ${sub.devices}`, sub.devices >= 1);
  const badSub = await customer.post("/api/v1/push", { action: "subscribe", subscription: { endpoint: "http://insecure.example/x", keys: { p256dh: "a", auth: "b" } } });
  check("https olmayan uç reddedildi", badSub.error?.code === "invalid_subscription", badSub.error);
  must(await customer.post("/api/v1/notifications", { action: "test" }), "deneme bildirimi");
  await sleep(1000);
  await customer.get("/api/v1/notifications"); // after() ile kuyruk boşalır
  await sleep(4000);
  const [subRow] = await sql`select failure_count from public.push_subscriptions where endpoint = ${endpoint}`;
  check(`gönderim denendi, erişilemeyen uç hata saydı (failure_count=${subRow?.failure_count})`, subRow && subRow.failure_count >= 1, subRow);
  const [queued] = await sql`select count(*)::int as n from public.notifications where user_id = ${me.user.id} and push_sent_at is null`;
  check("kuyrukta gönderilmemiş bildirim kalmadı", queued.n === 0, queued);
  const unsub = must(await customer.post("/api/v1/push", { action: "unsubscribe", endpoint }), "push aboneliği silindi");
  check("abonelik kalmadı", (await sql`select 1 from public.push_subscriptions where endpoint = ${endpoint}`).length === 0, unsub);

  console.log("\n▶ Maskeli arama");
  const early = await customer.post(`/api/v1/orders/${orderId}/call`);
  check("kurye atanmadan arama yok (no_courier) ya da kurye zaten atandı", early.error?.code === "no_courier" || early.ok, early.error);
  let board = null;
  for (let i = 0; i < 10 && !board?.offer; i++) {
    board = must(await courier.get("/api/v1/courier/board"), i === 0 ? "kurye panosu" : "kurye panosu (tekrar)");
    if (!board.offer) await sleep(2000);
  }
  if (board.offer?.orderId !== orderId) throw new Error("teklif bu kuryeye gelmedi");
  must(await courier.post(`/api/v1/courier/offers/${board.offer.id}`, { action: "accept" }), "kurye kabul etti");

  const c1 = await courier.post(`/api/v1/courier/orders/${orderId}/call`);
  const call = must(c1, "kurye müşteriyi arıyor (oturum)").call;
  check(`platform hattı ${call.proxyNumber}, dahili ${call.extension}`, /^0850 000 15 0\d$/.test(call.proxyNumber) && /^\d{4}$/.test(call.extension));
  check("telefon bağlantısı numara + dahili kod", call.dial === `tel:+90${call.proxyNumber.replace(/\D/g, "").replace(/^0/, "")},${call.extension}`, call.dial);
  check("test modu", call.testMode === true);
  check(`aranan etiketi "${call.calleeLabel}"`, /^Müşteri /.test(call.calleeLabel));
  check("yanıtta müşterinin gerçek numarası yok", realPhone && !c1.raw.includes(realPhone), realPhone);
  const c2 = must(await courier.post(`/api/v1/courier/orders/${orderId}/call`), "tekrar arama");
  check("açık oturum yeniden kullanıldı (aynı dahili)", c2.call.id === call.id && c2.call.extension === call.extension);

  const cc = await customer.post(`/api/v1/orders/${orderId}/call`);
  const ccall = must(cc, "müşteri kuryeyi arıyor").call;
  check(`müşteri kuryenin maskeli hattını arıyor (${ccall.proxyNumber})`, ccall.proxyNumber === courierAuth.courier.maskedPhone, ccall);
  check("yanıtta kuryenin gerçek numarası yok", !cc.raw.includes(courierAuth.courier.phone), courierAuth.courier.phone);
  must(await customer.post(`/api/v1/orders/${orderId}/call`, { action: "end", sessionId: ccall.id, durationSeconds: 42 }), "görüşme bitti (42 sn)");
  const [logRow] = await sql`select duration_seconds, ended_at from public.call_sessions where id = ${ccall.id}`;
  check("süre kaydedildi", logRow.duration_seconds === 42 && logRow.ended_at, logRow);
  const wrongEnd = await courier.post(`/api/v1/courier/orders/${orderId}/call`, { action: "end", sessionId: ccall.id, durationSeconds: 5 });
  check("kurye müşterinin oturumunu kapatamaz", wrongEnd.status === 404, wrongEnd.status);
  const stranger = await fresh.post(`/api/v1/orders/${orderId}/call`);
  check("başka müşteri bu siparişi arayamaz → 404", stranger.status === 404, stranger.status);

  must(await customer.post(`/api/v1/orders/${orderId}/cancel`, { reason: "E3 testi" }), "müşteri iptal etti");
  const [open] = await sql`select count(*)::int as n from public.call_sessions where order_id = ${orderId} and expires_at > now()`;
  check("iptalle tüm arama oturumları kapandı", open.n === 0, open);
  const after = await customer.post(`/api/v1/orders/${orderId}/call`);
  check("kapanan siparişte arama yok (order_closed)", after.error?.code === "order_closed", after.error);
  await sleep(2000);
  const cancelNote = must(await customer.get("/api/v1/notifications"), "bildirimler");
  check("iptal bildirimi yazıldı", cancelNote.notifications.some((n) => n.href === `/siparis/${orderId}` && n.title === "Siparişin iptal edildi"));
  const page = await fetch(`${BASE}/siparis/${orderId}`, { headers: { cookie: customer.cookieHeader() } });
  check("takip sayfası açılıyor", page.status === 200, page.status);
} catch (err) {
  failures++;
  console.log("  ✗ durdu:", err.message);
} finally {
  for (const id of addedCards) await customer.del(`/api/v1/cards/${id}`);
  await courier.post("/api/v1/courier/shift", { online: false }).catch(() => undefined);
  if (rt) await rt.removeAllChannels();
  await sql.end();
}
console.log(failures === 0 ? "\nTÜMÜ GEÇTİ" : `\n${failures} HATA`);
process.exit(failures === 0 ? 0 : 1);
