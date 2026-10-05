// Adım E2 (yönetici): sipariş arama + iade sınırları, canlı destek konsolu, demo modu anahtarı.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");

const BASE = process.env.BASE ?? "http://localhost:3000";
const PASSWORD = process.env.SOFRA_DEMO_PASSWORD;
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

const admin = new Client();
const customer = new Client();
let rt = null;

try {
  must(await admin.post("/api/v1/admin/auth/login", { email: "yonetim@sofra.app", password: PASSWORD }), "yönetici girişi");
  must(await customer.post("/api/v1/auth/demo"), "müşteri girişi");

  console.log("\n▶ Sipariş arama ve iade sınırları");
  const recent = must(await admin.get("/api/v1/admin/orders?q="), "son kapanan siparişler");
  check("boş aramada yalnızca kapanmış siparişler", recent.orders.every((o) => o.status === "delivered" || o.status === "cancelled"));
  const target = recent.orders.find(
    (o) => o.status === "delivered" &&
      o.totals.grandTotal - (o.refundedTotal ?? 0) > 20
  );
  if (!target) throw new Error("iade denenecek teslim edilmiş sipariş yok");
  const byCode = must(await admin.get(`/api/v1/admin/orders?q=${encodeURIComponent(target.code)}`), `kodla arama (${target.code})`);
  check("kodla arama siparişi buldu", byCode.orders.some((o) => o.id === target.id));

  const remaining = Math.round((target.totals.grandTotal - (target.refundedTotal ?? 0)) * 100) / 100;
  const first = must(await admin.post(`/api/v1/admin/orders/${target.id}`, { action: "refund", amount: 10, reason: "Eksik içecek (test)" }), "10 ₺ kısmi iade");
  check("iade kaydı siparişe işlendi", Math.abs((first.order.refundedTotal ?? 0) - ((target.refundedTotal ?? 0) + 10)) < 0.01, first.order.refundedTotal);
  const tooMuch = await admin.post(`/api/v1/admin/orders/${target.id}`, { action: "refund", amount: remaining, reason: "fazla" });
  check(`kalandan fazlası reddedildi (${tooMuch.error?.code})`, !tooMuch.ok && tooMuch.error?.code === "amount_too_large", tooMuch.error);
  const rest = Math.round((remaining - 10) * 100) / 100;
  must(await admin.post(`/api/v1/admin/orders/${target.id}`, { action: "refund", amount: rest, reason: "kalan (test)" }), `kalan ${rest} ₺ iade edildi`);
  const again = await admin.post(`/api/v1/admin/orders/${target.id}`, { action: "refund", amount: 1, reason: "tekrar" });
  check(`tamamı iade edilmiş siparişe yeni iade yok (${again.error?.code})`, !again.ok && again.error?.code === "already_refunded", again.error);
  const deliveredCancel = await admin.post(`/api/v1/admin/orders/${target.id}`, { action: "cancel", reason: "test" });
  check("teslim edilmiş sipariş iptal edilemiyor", !deliveredCancel.ok, deliveredCancel.error);
  const fin = must(await admin.get("/api/v1/admin/finance"), "finans raporu");
  check("finansta iade toplamı > 0", fin.summary.refunds > 0, fin.summary.refunds);
  check("geçit raporunda iade sütunu verisi var", fin.gateway.some((g) => g.refunded > 0), fin.gateway.map((g) => [g.method, g.refunded]));

  console.log("\n▶ Canlı destek: aktarma → temsilci → müşteri anında görür");
  let chat = must(await customer.get("/api/v1/support/chat"), "destek oturumu");
  if (chat.session.status !== "bot") {
    // Önceki testten kalan açık görüşme varsa kapat
    await admin.post(`/api/v1/admin/support/${chat.session.id}`, { action: "close" });
    chat = must(await customer.get("/api/v1/support/chat"), "yeni destek oturumu");
  }
  chat = must(await customer.post("/api/v1/support/chat", { sessionId: chat.session.id, quickReplyId: "agent" }), "müşteri temsilci istedi");
  const sessionId = chat.session.id;
  check("oturum temsilci kuyruğunda", chat.session.status === "waiting_agent", chat.session.status);

  const kpi = must(await admin.get("/api/v1/admin/auth/me"), "yönetici sayaçları");
  check(`yan menü sayacı: ${kpi.kpi.waitingSupport} bekleyen`, kpi.kpi.waitingSupport >= 1, kpi.kpi);
  const queue = must(await admin.get("/api/v1/admin/support?durum=open"), "destek kuyruğu");
  const item = queue.sessions.find((s) => s.id === sessionId);
  check("kuyrukta, müşteri adı ve son mesajla", item && item.status === "waiting_agent" && item.customer.name && item.lastMessage, item);
  check("bekleyenler listenin başında", queue.sessions.findIndex((s) => s.status !== "waiting_agent") === -1 || queue.sessions.findIndex((s) => s.status !== "waiting_agent") > queue.sessions.findIndex((s) => s.id === sessionId));

  // Müşteri tarafı Realtime: support:<id> kanalı
  const tokenRes = await customer.get("/api/v1/realtime/token?rol=customer");
  rt = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    accessToken: async () => tokenRes.data.accessToken,
  });
  await rt.realtime.setAuth(); // uygulamadaki gibi: katılmadan önce token hazır olsun
  const events = [];
  const joined = await new Promise((resolve) => {
    const ch = rt.channel(`support:${sessionId}`, { config: { private: true } });
    ch.on("broadcast", { event: "*" }, (m) => events.push(m));
    ch.subscribe((s, err) => { if (s === "SUBSCRIBED") resolve(true); else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") resolve(err?.message ?? s); });
    setTimeout(() => resolve("BEKLEME"), 12000);
  });
  check("müşteri support kanalına bağlandı", joined === true, joined);

  const view = must(await admin.get(`/api/v1/admin/support/${sessionId}`), "konuşma ayrıntısı");
  check("ayrıntıda son siparişler var", Array.isArray(view.recentOrders) && view.recentOrders.length > 0);
  const replied = must(await admin.post(`/api/v1/admin/support/${sessionId}`, { action: "message", text: "Merhaba, eksik ürün için hemen bakıyorum." }), "temsilci yazdı (otomatik üstlenme)");
  check("görüşme temsilcide", replied.info.status === "with_agent" && replied.info.assignedAdmin?.id, replied.info);
  await sleep(2000);
  check("müşteriye support_message yayını geldi", events.some((e) => e.event === "support_message" && e.payload.role === "agent"), events.map((e) => [e.event, e.payload.role]));
  const seen = must(await customer.get(`/api/v1/support/chat?sessionId=${sessionId}`), "müşteri konuşmayı çekti");
  const agentMsg = seen.session.messages.find((m) => m.role === "agent");
  check(`müşteri temsilci mesajını adıyla görüyor (${agentMsg?.authorName})`, agentMsg && agentMsg.authorName && /eksik ürün/.test(agentMsg.text), agentMsg);
  check("katılım bilgisi müşteriye görünüyor", seen.session.messages.some((m) => /görüşmeye katıldı/.test(m.text)));

  const userReply = must(await customer.post("/api/v1/support/chat", { sessionId, text: "Kola eksikti" }), "müşteri yanıtladı");
  check("temsilcideyken asistan araya girmiyor", userReply.session.messages.at(-1).role === "user", userReply.session.messages.at(-1));

  const released = must(await admin.post(`/api/v1/admin/support/${sessionId}`, { action: "release" }), "kuyruğa bırakıldı");
  check("tekrar temsilci bekliyor", released.info.status === "waiting_agent" && !released.info.assignedAdmin, released.info);
  must(await admin.post(`/api/v1/admin/support/${sessionId}`, { action: "claim" }), "yeniden üstlenildi");
  const closed = must(await admin.post(`/api/v1/admin/support/${sessionId}`, { action: "close" }), "görüşme kapatıldı");
  check("durum kapandı", closed.info.status === "closed", closed.info.status);
  const bad = await admin.post(`/api/v1/admin/support/${sessionId}`, { action: "message", text: "   " });
  check("boş mesaj reddedildi", !bad.ok && bad.error?.code === "empty_message", bad.error);
  const unknown = await admin.post(`/api/v1/admin/support/${sessionId}`, { action: "sil" });
  check("geçersiz işlem reddedildi", !unknown.ok && unknown.error?.code === "unknown_action", unknown.error);
  const missing = await admin.get("/api/v1/admin/support/sup_yok");
  check("olmayan konuşma 404", missing.status === 404, missing.status);
  const after = must(await customer.post("/api/v1/support/chat", { sessionId, text: "merhaba" }), "kapandıktan sonra müşteri yazdı");
  check("asistan yeniden devrede", after.session.status === "bot" && after.session.messages.at(-1).role === "bot", after.session.status);
  const noCustomer = await customer.get(`/api/v1/admin/support?durum=open`);
  check("müşteri çereziyle destek kuyruğu → 401", noCustomer.status === 401, noCustomer.status);

  console.log("\n▶ Demo girişleri anahtarı");
  const settings = must(await admin.get("/api/v1/admin/settings"), "ayarlar");
  check(`şu an demo girişleri ${settings.settings.demoMode ? "açık" : "kapalı"}`, typeof settings.settings.demoMode === "boolean");
  check("simülasyon hızı ayarı yok", !("simSpeed" in settings.settings), settings.settings);
  const badFlag = await admin.patch("/api/v1/admin/settings", { demoMode: "evet" });
  check("demoMode metin reddedildi", badFlag.status === 400, badFlag);
  const demoButton = async () => (await fetch(BASE + "/giris").then((r) => r.text())).includes("Demo hesabıyla hızlı giriş");
  must(await admin.patch("/api/v1/admin/settings", { demoMode: false }), "demo modu kapalı");
  await sleep(5500); // sunucudaki ayar önbelleği (5 sn)
  const offConfig = await new Client().get("/api/v1/config");
  check("kapalıyken /config demoMode=false", offConfig.ok && offConfig.data.demoMode === false, offConfig.data);
  check("kapalıyken giriş ekranında demo düğmesi yok", !(await demoButton()));
  must(await admin.patch("/api/v1/admin/settings", { demoMode: true }), "demo modu açıldı");
  await sleep(5500);
  const onConfig = await new Client().get("/api/v1/config");
  check("açıkken /config demoMode=true", onConfig.ok && onConfig.data.demoMode === true, onConfig.data);
  check("açıkken giriş ekranında demo düğmesi var", await demoButton());
  must(await admin.patch("/api/v1/admin/settings", { demoMode: settings.settings.demoMode }), `demo modu eski hâline döndü (${settings.settings.demoMode ? "açık" : "kapalı"})`);
  const audit = must(await admin.get("/api/v1/admin/overview"), "iz kaydı");
  check("ayar değişikliği iz kaydında", audit.audit.some((a) => a.action === "Platform ayarını değiştirdi"));

  console.log("\n▶ Vitrin afişi görseli");
  const bannerBase = { subtitle: "deneme", gradient: ["#C4351E", "#DF9411"], href: "/?kategori=pizza", active: false };
  const foreignImage = await admin.post("/api/v1/admin/marketing", {
    action: "banner-upsert",
    banner: { ...bannerBase, title: "E2E afişi", image: "https://ornek.example/afis.png" },
  });
  check("site dışı afiş görseli reddedildi", foreignImage.status === 400 && foreignImage.error?.code === "invalid_image", foreignImage);
  const withImage = must(
    await admin.post("/api/v1/admin/marketing", {
      action: "banner-upsert",
      banner: { ...bannerBase, title: "E2E afişi", image: "/images/food/pizza-margherita.webp" },
    }),
    "fotoğraflı afiş eklendi"
  );
  const e2eBanner = withImage.banners.find((b) => b.title === "E2E afişi");
  check("afiş görseli kaydedildi", e2eBanner?.image === "/images/food/pizza-margherita.webp", e2eBanner);
  if (e2eBanner) {
    must(await admin.post("/api/v1/admin/marketing", { action: "banner-delete", id: e2eBanner.id }), "deneme afişi silindi");
  }

  for (const path of ["/yonetim/siparisler?q=" + encodeURIComponent(target.code), "/yonetim/destek"]) {
    const page = await fetch(BASE + path, { headers: { cookie: admin.cookieHeader() } });
    check(`${path} açılıyor`, page.status === 200, page.status);
  }
} catch (err) {
  failures++;
  console.log("  ✗ durdu:", err.message);
} finally {
  if (rt) await rt.removeAllChannels();
}
console.log(failures === 0 ? "\nTÜMÜ GEÇTİ" : `\n${failures} HATA`);
process.exit(failures === 0 ? 0 : 1);
