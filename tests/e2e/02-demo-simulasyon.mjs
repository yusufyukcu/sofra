// Demo simülasyonu: vardiyada hiç kurye yokken sipariş kendiliğinden teslim edilmeli.
// Ön koşulları kendisi kurar (demo modu açık, mesaide kurye yok) ve ayarı geri alır.
// Çalıştırma: npm run test:e2e (hepsi) ya da node --env-file-if-exists=.env.local --env-file-if-exists=.env.development.local <dosya>
const BASE = process.env.BASE ?? "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client() {
  const jar = new Map();
  return async function call(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: { "content-type": "application/json", cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";");
      const i = pair.indexOf("=");
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return res.json();
  };
}

const call = client();
const admin = client();

// Ön koşullar
const adminLogin = await admin("POST", "/api/v1/admin/auth/login", { email: "yonetim@sofra.app", password: process.env.SOFRA_DEMO_PASSWORD });
if (!adminLogin.ok) throw new Error(JSON.stringify(adminLogin.error));
const before = (await admin("GET", "/api/v1/admin/settings")).data.settings;
if (!before.demoMode) {
  await admin("PATCH", "/api/v1/admin/settings", { demoMode: true });
  console.log("  · demo modu test için açıldı");
  await sleep(5500); // sunucudaki ayar önbelleği
}
const overview = (await admin("GET", "/api/v1/admin/overview")).data;
for (const courier of overview.couriers) {
  // Askıya alınan kurye mesaiden düşer; hemen yeniden aktifleştirilir
  await admin("POST", `/api/v1/admin/couriers/${courier.id}`, { action: "suspend", reason: "Demo simülasyonu testi" });
  await admin("POST", `/api/v1/admin/couriers/${courier.id}`, { action: "activate" });
  console.log(`  · ${courier.name} mesaiden çıkarıldı`);
}

const login = await call("POST", "/api/v1/auth/demo");
if (!login.ok) throw new Error(JSON.stringify(login));
const r = (await call("GET", "/api/v1/restaurants/kasap-burger-co")).data.restaurant;
const product = r.menu.flatMap((c) => c.products).find((p) => !p.soldOut && p.optionGroups.length === 0) ?? r.menu[0].products[0];
const selections = [];
for (const g of product.optionGroups) {
  const pick = g.options.find((o) => o.default) ?? g.options[0];
  if (g.required || g.minSelect) selections.push({ groupId: g.id, groupName: g.name, optionIds: [pick.id], optionNames: [], priceDelta: 0 });
}
const me = (await call("GET", "/api/v1/auth/me")).data;
const created = await call("POST", "/api/v1/orders", {
  restaurantId: r.id, addressId: me.addresses[0].id, paymentMethod: "cash_on_delivery",
  lines: [{ lineId: "x", productId: product.id, name: product.name, emoji: "", basePrice: 0, unitPrice: 0, quantity: 3, selections }],
  preferences: { contactless: false, ringDoorbell: true, cutlery: false },
});
if (!created.ok) throw new Error(JSON.stringify(created.error));
const id = created.data.order.id;
console.log("sipariş:", created.data.order.code, created.data.order.status, "· travel", created.data.order.travelMinutes, "dk");

const seen = [];
const started = Date.now();
while (Date.now() - started < 150_000) {
  const { data } = await call("GET", `/api/v1/orders/${id}`);
  const key = `${data.order.status}/${data.order.courierStage ?? "-"}`;
  if (seen.at(-1)?.key !== key) {
    seen.push({ key, at: Math.round((Date.now() - started) / 1000) });
    console.log(`  +${seen.at(-1).at}s  ${key}  kurye=${data.order.courier?.name ?? "-"}  sim=${Boolean(data.order.simulated)}  ilerleme=${data.progress.toFixed(2)}`);
  }
  if (data.order.status === "delivered") {
    console.log("  zaman çizelgesi:", data.order.timeline.map((t) => t.note).join(" → "));
    break;
  }
  await sleep(3000);
}
const final = (await call("GET", `/api/v1/orders/${id}`)).data.order;
const passed = final.status === "delivered" && final.simulated;
console.log(passed ? "✓ Demo simülasyonu siparişi teslim etti" : "✗ Teslim edilmedi: " + final.status);
if (!passed && final.status !== "cancelled") {
  await admin("POST", `/api/v1/admin/orders/${id}`, { action: "cancel", reason: "Test temizliği" });
}
if (!before.demoMode) await admin("PATCH", "/api/v1/admin/settings", { demoMode: false });
process.exitCode = passed ? 0 : 1;
