// lib/realtime.ts modülünü tarayıcı olmadan, gerçek sunucuya karşı dener.
// Çalıştırma: npm run test:e2e ya da node --env-file-if-exists=.env.local --env-file-if-exists=.env.development.local --import tsx <dosya>
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const postgres = require("postgres");

const BASE = process.env.BASE ?? "http://localhost:3000";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PASSWORD = process.env.SOFRA_DEMO_PASSWORD!;

const realFetch = globalThis.fetch;
const jars: Record<string, string> = {};
let tokenCalls = 0;

async function call(role: string, method: string, path: string, body?: unknown) {
  const res = await realFetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", cookie: jars[role] ?? "" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const set = res.headers.getSetCookie().map((c) => c.split(";")[0]).filter((c) => !c.endsWith("="));
  if (set.length) jars[role] = [jars[role], ...set].filter(Boolean).join("; ");
  return res.json();
}

// Modülün göreli `fetch("/api/v1/realtime/token?rol=…")` çağrısını rolün çereziyle sunucuya yönlendir
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === "string" && input.startsWith("/")) {
    const url = new URL(input, BASE);
    const role = url.searchParams.get("rol") ?? "";
    if (url.pathname === "/api/v1/realtime/token") tokenCalls++;
    return realFetch(url, { ...init, headers: { ...(init?.headers ?? {}), cookie: jars[role] ?? "" } });
  }
  return realFetch(input, init);
}) as typeof fetch;

const { subscribeRealtime, closeRealtime } = await import(new URL("../../lib/realtime.ts", import.meta.url).href);

let failures = 0;
function check(label: string, cond: boolean, extra?: unknown) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.log(`  ✗ ${label}`, extra === undefined ? "" : JSON.stringify(extra).slice(0, 300));
  }
}
async function until(fn: () => boolean, ms = 15000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (fn()) return true;
    await sleep(150);
  }
  return fn();
}
type Sub = { status: string; events: { event: string; topic: string }[]; stop: () => void };
function sub(role: "customer" | "admin", topics: string[]): Sub {
  const state: Sub = { status: "init", events: [], stop: () => undefined };
  state.stop = subscribeRealtime(role, topics, (m: { event: string; topic: string }) => state.events.push(m), (s: string) => {
    state.status = s;
  });
  return state;
}

const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { ssl: "require", max: 1, onnotice: () => {} });

try {
  console.log("\n▶ Girişler");
  check("yönetici", (await call("admin", "POST", "/api/v1/admin/auth/login", { email: "yonetim@sofra.app", password: PASSWORD })).ok);
  check("müşteri", (await call("customer", "POST", "/api/v1/auth/demo")).ok);
  const otp = await call("courier", "POST", "/api/v1/courier/auth/otp/start", { phone: "5321110002" });
  check("kurye", (await call("courier", "POST", "/api/v1/courier/auth/otp/verify", { challengeId: otp.data.challengeId, code: otp.data.devCode })).ok);
  await call("courier", "POST", "/api/v1/courier/shift", { online: false });

  console.log("\n▶ Paylaşılan kanal (iki ekran aynı konuyu dinliyor)");
  const a = sub("admin", ["admin:ops"]);
  check("A canlı", await until(() => a.status === "live"), a.status);
  await sleep(800);
  const b = sub("admin", ["admin:ops", "admin:support"]);
  check("B canlı (aynı bağlantıda sonradan eklenen admin:support dahil)", await until(() => b.status === "live"), b.status);

  await call("courier", "POST", "/api/v1/courier/shift", { online: true });
  check("A olayı aldı", await until(() => a.events.some((e) => e.event === "courier_changed")), a.events);
  check("B olayı aldı", await until(() => b.events.some((e) => e.event === "courier_changed")), b.events);
  check("olay bir kez geldi (tek abonelik)", a.events.filter((e) => e.event === "courier_changed").length === 1, a.events);

  a.stop();
  await sleep(2500);
  const aBefore = a.events.length;
  b.events.length = 0;
  await call("courier", "POST", "/api/v1/courier/shift", { online: false });
  check("A ayrıldıktan sonra B hâlâ alıyor", await until(() => b.events.some((e) => e.event === "courier_changed")), b.events);
  check("A ayrıldıktan sonra olay almıyor", a.events.length === aBefore);

  console.log("\n▶ StrictMode benzeri: abone ol → hemen bırak → yeniden abone ol");
  const c1 = sub("customer", ["user:usr_demo"]);
  c1.stop();
  const c2 = sub("customer", ["user:usr_demo"]);
  check("yeniden abonelik canlı", await until(() => c2.status === "live"), c2.status);
  await sql`insert into public.notifications (id, user_id, title, body) values (${"ntf_mod_" + Date.now()}, 'usr_demo', 'Modül denemesi', 'Deneme')`;
  check("bildirim olayı geldi", await until(() => c2.events.some((e) => e.event === "notification")), c2.events);

  console.log("\n▶ Aynı bağlantıda sonradan ikinci kanal (önceki hata)");
  const orders = await call("customer", "GET", "/api/v1/orders");
  const oid = orders.data.orders[0]?.id;
  const c3 = sub("customer", [`order:${oid}`]);
  check(`order:${oid} canlı`, await until(() => c3.status === "live"), c3.status);

  console.log("\n▶ Yetkisiz kanal");
  const bad = sub("customer", ["order:ord_yok"]);
  check("yetkisiz kanal offline", await until(() => bad.status === "offline"), bad.status);
  check("yetkisiz kanal diğer abonelikleri bozmadı", c2.status === "live" && c3.status === "live", [c2.status, c3.status]);
  bad.stop();

  check(`token isteği rol başına önbellekli (${tokenCalls} istek)`, tokenCalls <= 2, tokenCalls);

  console.log("\n▶ Çıkış");
  closeRealtime("admin");
  closeRealtime("customer");
  check("closeRealtime sonrası abonelikler offline", b.status === "offline" && c2.status === "offline" && c3.status === "offline", [b.status, c2.status, c3.status]);
  b.stop();
  c2.stop();
  c3.stop();
} catch (err) {
  failures++;
  console.log("  ✗ durdu:", (err as Error).message);
} finally {
  await sql`delete from public.notifications where id like 'ntf_mod_%'`;
  await sql.end();
  console.log(failures === 0 ? "\nTÜMÜ GEÇTİ" : `\n${failures} HATA`);
  process.exit(failures === 0 ? 0 : 1);
}
