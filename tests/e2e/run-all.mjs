// Uçtan uca testlerin hepsini sırayla çalıştırır.
//
//   npm run dev              (ayrı terminalde; farklı adres için BASE=http://…)
//   npm run test:e2e         hepsi
//   npm run test:e2e -- realtime yonetici   yalnızca adı eşleşenler
//
// Testler gerçek API'yi ve veritabanını kullanır: sipariş, iade, test kartı,
// destek konuşması… yazarlar. Geliştirme veritabanında çalıştır; bitince temiz
// demo verisi için: npm run db:seed -- --reset
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "../..");
const BASE = process.env.BASE ?? "http://localhost:3000";

try {
  const res = await fetch(`${BASE}/api/v1/restaurants`);
  if (!res.ok) throw new Error(String(res.status));
} catch {
  console.error(`Sunucuya ulaşılamadı (${BASE}). Önce "npm run dev" ile başlat; farklı adres için BASE=… ver.`);
  process.exit(1);
}
for (const name of ["SOFRA_DEMO_PASSWORD", "POSTGRES_URL_NON_POOLING", "NEXT_PUBLIC_SUPABASE_URL"]) {
  if (!process.env[name]) {
    console.error(`${name} tanımlı değil (.env.local / .env.development.local). Kurulum: README → Hızlı başlangıç.`);
    process.exit(1);
  }
}

const only = process.argv.slice(2);
const files = readdirSync(dir)
  .filter((f) => /^\d\d-.*\.(mjs|mts)$/.test(f))
  .filter((f) => only.length === 0 || only.some((o) => f.includes(o)))
  .sort();

const results = [];
for (const file of files) {
  console.log(`\n━━━ ${file} ━━━`);
  const started = Date.now();
  const target = path.join(dir, file);
  const args = file.endsWith(".mts") ? ["--import", "tsx", target] : [target];
  const run = spawnSync(process.execPath, args, { stdio: "inherit", env: process.env, cwd: root });
  results.push({ file, ok: run.status === 0, seconds: Math.round((Date.now() - started) / 1000) });
}

console.log("\n━━━ Özet ━━━");
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.file} (${r.seconds} sn)`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} test dosyası başarısız` : "\nTüm testler geçti");
process.exit(failed ? 1 : 0);
