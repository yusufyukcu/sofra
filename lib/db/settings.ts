import "server-only";
import { sql, type Db } from "./client";

/**
 * Uygulama ayarları (`app_settings`). Dağıtım fonksiyonu da aynı tabloyu
 * okur; bu yüzden ayar veritabanında durur, ortam değişkeninde değil.
 */
export interface AppSettings {
  /** Vardiyada kurye yokken teslimatı simülasyon üstlensin mi */
  demoMode: boolean;
  /** Demo süre çarpanı: 12 → 30 dakikalık teslimat 2,5 dakikada biter */
  simSpeed: number;
}

const DEFAULTS: AppSettings = { demoMode: true, simSpeed: 12 };
const TTL_MS = 5_000;

let cache: { at: number; value: AppSettings } | null = null;

export async function appSettings(db: Db = sql): Promise<AppSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  const rows = await db<{ key: string; value: unknown }[]>`
    select key, value from public.app_settings where key in ('demo_mode', 'sim_speed')
  `;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const value: AppSettings = {
    demoMode:
      typeof map.get("demo_mode") === "boolean"
        ? (map.get("demo_mode") as boolean)
        : DEFAULTS.demoMode,
    simSpeed: Math.max(1, Number(map.get("sim_speed") ?? DEFAULTS.simSpeed) || DEFAULTS.simSpeed),
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
  if (patch.simSpeed !== undefined) {
    const speed = Math.min(60, Math.max(1, Math.round(patch.simSpeed)));
    await db`
      insert into public.app_settings (key, value, updated_at)
      values ('sim_speed', ${db.json(speed)}, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()
    `;
  }
  cache = null;
  return appSettings(db);
}

/** Gerçek dakikayı demo süresine çevirir (ms). */
export function scaledMs(minutes: number, settings: AppSettings): number {
  return Math.round((minutes * 60_000) / (settings.demoMode ? settings.simSpeed : 1));
}
