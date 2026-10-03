// Başvuru → onay → kurulum bağlantısı → parola → giriş; kara liste akışı.
const BASE = process.env.BASE ?? "http://localhost:3000";
class Client {
  constructor() { this.jar = new Map(); }
  cookieHeader() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "); }
  async call(method, path, body) {
    const res = await fetch(BASE + path, { method, headers: { "content-type": "application/json", cookie: this.cookieHeader() }, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";"); const i = pair.indexOf("=");
      const k = pair.slice(0, i).trim(), v = pair.slice(i + 1).trim();
      if (!v || /max-age=0/i.test(raw)) this.jar.delete(k); else this.jar.set(k, v);
    }
    return { status: res.status, ...(await res.json().catch(() => ({}))) };
  }
  get(p) { return this.call("GET", p); }
  post(p, b) { return this.call("POST", p, b ?? {}); }
}
let failures = 0;
const check = (label, cond, extra) => { if (cond) console.log("  ✓", label); else { failures++; console.log("  ✗", label, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ""); } };
const must = (r, label) => { if (!r.ok) { failures++; console.log("  ✗", label, r.status, JSON.stringify(r.error)); throw new Error(label); } console.log("  ✓", label); return r.data; };

const admin = new Client();
must(await admin.post("/api/v1/admin/auth/login", { email: "yonetim@sofra.app", password: process.env.SOFRA_DEMO_PASSWORD }), "yönetici girişi");

console.log("\n▶ Restoran başvurusu ve panel kurulumu");
const stamp = Date.now().toString(36).slice(-5);
const phone = "53" + String(Date.now()).slice(-8);
const app = must(await new Client().post("/api/v1/partner/apply", {
  businessName: `Deneme Lokantası ${stamp}`, cuisine: "evyemekleri", city: "İstanbul", district: "Kadıköy",
  address: "Caferağa Mah. Moda Cad. No: 10", location: { lat: 40.986, lng: 29.027 }, branchCount: 1,
  contactName: "Ayşe Yılmaz", phone, email: `deneme.${stamp}@example.com`, hasOwnCourier: true,
}), `başvuru alındı (${stamp})`);
const status = must(await new Client().get(`/api/v1/partner/apply?kod=${app.code}`), "başvuru durumu sorgulandı");
check("durum: değerlendirmede", status.status === "received");

const rows = must(await admin.get("/api/v1/admin/restaurants"), "onay kuyruğu");
const row = rows.rows.find((r) => r.application?.code === app.code);
check("başvuru onay kuyruğunda", row?.restaurant.approvalStatus === "pending");
const approved = must(await admin.post(`/api/v1/admin/restaurants/${row.restaurant.id}`, { action: "approve" }), "yönetici onayladı");
check("kurulum bağlantısı üretildi (test modu: yöneticiye gösteriliyor)", approved.invite?.setupPath?.startsWith("/isletme-kurulum?anahtar=") && approved.invite.delivered === false, approved.invite);

const token = new URL(BASE + approved.invite.setupPath).searchParams.get("anahtar");
const info = must(await new Client().get(`/api/v1/vendor/auth/setup?anahtar=${token}`), "kurulum bağlantısı geçerli");
check("bağlantı doğru işletmeyi gösteriyor", info.email === `deneme.${stamp}@example.com`);
const weak = await new Client().post("/api/v1/vendor/auth/setup", { token, password: "123" });
check("zayıf parola reddedildi", weak.error?.code === "weak_password", weak.error);

const vendor = new Client();
const setup = must(await vendor.post("/api/v1/vendor/auth/setup", { token, password: "Lokanta-2026!" }), "parola belirlendi, panele girildi");
check("yeni işletme kendi restoranına bağlı", setup.restaurant.id === row.restaurant.id);
const me = must(await vendor.get("/api/v1/vendor/auth/me"), "işletme oturumu");
check("menü boş, mağaza geçici kapalı (işletme menüsünü hazırlayıp açacak)", me.restaurant.menu.length === 0 && me.restaurant.temporarilyClosed === true);
const reuse = await new Client().post("/api/v1/vendor/auth/setup", { token, password: "Baska-2026!" });
check("kurulum bağlantısı ikinci kez kullanılamıyor", reuse.error?.code === "invite_used", reuse.error);
must(await new Client().post("/api/v1/vendor/auth/login", { email: `deneme.${stamp}@example.com`, password: "Lokanta-2026!" }), "yeni parolayla normal giriş");
const status2 = must(await new Client().get(`/api/v1/partner/apply?kod=${app.code}`), "başvuru durumu tekrar sorgulandı");
check("durum: onaylandı", status2.status === "approved");

console.log("\n▶ Kara liste");
const customer = new Client();
const custPhone = "54" + String(Date.now()).slice(-8);
const start = must(await customer.post("/api/v1/auth/otp/start", { channel: "phone", target: custPhone }), "yeni müşteri kodu");
const verified = must(await customer.post("/api/v1/auth/otp/verify", { challengeId: start.challengeId, code: start.devCode, name: "Test Müşteri" }), "yeni müşteri hesabı açıldı");
check("hoş geldin bakiyesi 100 ₺", verified.user.walletBalance === 100 && verified.isNewUser === true, verified.user.walletBalance);
must(await admin.post(`/api/v1/admin/users/${verified.user.id}`, { action: "block", reason: "Test" }), "müşteri kara listeye alındı");
const afterBlock = await customer.get("/api/v1/auth/me");
check("engellenen müşterinin oturumu anında geçersiz", afterBlock.status === 401, afterBlock.status);
const start2 = must(await customer.post("/api/v1/auth/otp/start", { channel: "phone", target: custPhone }), "engelliyken kod istendi");
const relogin = await customer.post("/api/v1/auth/otp/verify", { challengeId: start2.challengeId, code: start2.devCode });
check("engelliyken yeniden giriş reddedildi", relogin.error?.code === "account_blocked", relogin.error);
must(await admin.post(`/api/v1/admin/users/${verified.user.id}`, { action: "unblock" }), "kara listeden çıkarıldı");
const start3 = must(await customer.post("/api/v1/auth/otp/start", { channel: "phone", target: custPhone }), "tekrar kod istendi");
must(await customer.post("/api/v1/auth/otp/verify", { challengeId: start3.challengeId, code: start3.devCode }), "yeniden giriş yapılabildi");

console.log(failures ? `\n✗ ${failures} kontrol başarısız` : "\n✓ Tüm kontroller geçti");
process.exitCode = failures ? 1 : 0;
