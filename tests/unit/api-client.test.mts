// Ortak API istemcisi: 401 → yenile → bir kez tekrar dene (mobil oturum yenileme).
// Çalıştırma: npm run test:unit
import { createApiClient } from "../../packages/core/src/api-client.ts";

let failures = 0;
function report(line: string) {
  if (line.startsWith("✗")) failures++;
  console.log(line);
}

let token = "eski";
const calls: string[] = [];
globalThis.fetch = (async (_url: string, init: RequestInit) => {
  const auth = (init.headers as Record<string, string>).authorization;
  calls.push(auth);
  if (auth === "Bearer eski") return new Response(JSON.stringify({ ok: false, error: { code: "unauthorized", message: "Oturum yok" } }), { status: 401 });
  return new Response(JSON.stringify({ ok: true, data: { merhaba: 1 } }), { status: 200 });
}) as typeof fetch;

let refreshed = 0, dropped = 0;
const client = createApiClient({
  baseUrl: "http://x",
  getToken: () => token,
  refreshOnUnauthorized: async () => { refreshed++; token = "yeni"; return true; },
  onUnauthorized: () => dropped++,
});
const data = await client.get<{ merhaba: number }>("/auth/me");
report(data.merhaba === 1 && refreshed === 1 && dropped === 0 && calls.join(",") === "Bearer eski,Bearer yeni" ? "✓ 401 → yenile → tekrar dene" : `✗ ${JSON.stringify({ data, refreshed, dropped, calls })}`);

// Yenileme başarısızsa: oturum düşer, istek tekrarlanmaz
token = "eski"; calls.length = 0; refreshed = 0;
const failing = createApiClient({ baseUrl: "http://x", getToken: () => token, refreshOnUnauthorized: async () => { refreshed++; return false; }, onUnauthorized: () => dropped++ });
try { await failing.get("/auth/me"); report("✗ hata bekleniyordu"); } catch (e) {
  report(calls.length === 1 && refreshed === 1 && dropped === 1 ? "✓ yenileme reddedilince oturum düşüyor, tek istek" : `✗ ${JSON.stringify({ calls, refreshed, dropped })}`);
}
// Yenileme sonrası yine 401: sonsuz döngü yok
token = "eski"; calls.length = 0; dropped = 0;
const looping = createApiClient({ baseUrl: "http://x", getToken: () => token, refreshOnUnauthorized: async () => true, onUnauthorized: () => dropped++ });
try { await looping.get("/auth/me"); } catch { report(calls.length === 2 && dropped === 1 ? "✓ yenileme işe yaramazsa en fazla bir tekrar" : `✗ ${JSON.stringify({ calls, dropped })}`); }

process.exitCode = failures ? 1 : 0;
