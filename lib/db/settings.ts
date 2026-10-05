import "server-only";
import { sql, type Db } from "./client";

/**
 * Uygulama ayarları (`app_settings`). Ayar veritabanında durur, ortam
 * değişkeninde değil: yönetici panelinden değişir, tüm sunucular aynı
 * değeri görür.
 */
export interface AppSettings {
  /**
   * Demo girişleri (sunum): giriş ekranlarında hazır demo hesapları
   * görünür. Teslimatı her zaman gerçek kuryeler yapar; süreler gerçektir.
   */
  demoMode: boolean;
}

const DEFAULTS: AppSettings = { demoMode: false };
const TTL_MS = 5_000;

let cache: { at: number; value: AppSettings } | null = null;

export async function appSettings(db: Db = sql): Promise<AppSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  const rows = await db<{ key: string; value: unknown }[]>`
    select key, value from public.app_settings where key = 'demo_mode'
  `;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const value: AppSettings = {
    demoMode:
      typeof map.get("demo_mode") === "boolean"
        ? (map.get("demo_mode") as boolean)
        : DEFAULTS.demoMode,
  };
  cache = { at: Date.now(), value };
  return value;
}

export async function updateAppSettings(
  patch: Partial<AppSettings>,
  db: Db = sql
): Promise<AppSettings> {
  if (patch.demoMode !== undefined) {
    await db`
      insert into public.app_settings (key, value, updated_at)
      values ('demo_mode', ${db.json(patch.demoMode)}, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()
    `;
  }
  cache = null;
  return appSettings(db);
}
