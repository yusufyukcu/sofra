import "server-only";
import { supabaseAdmin } from "../supabase/admin";

/**
 * Restoranların yüklediği fotoğrafların deposu: Supabase Storage'daki özel
 * `media` bucket'ı. Bucket herkese açık değil; dosyalar `/media/<ad>`
 * rotasından onay durumuna göre sunulur (onay bekleyeni yalnızca yükleyen
 * restoran ve yönetici görür).
 */

const BUCKET = "media";

/** Dosya adları sunucuda üretilir; bu kalıp dışındaki her ad reddedilir. */
const SAFE_NAME = /^med_[a-z0-9]+\.webp$/;

export async function saveMedia(name: string, data: Buffer): Promise<void> {
  if (!SAFE_NAME.test(name)) throw new Error(`Geçersiz dosya adı: ${name}`);
  const { error } = await supabaseAdmin()
    .storage.from(BUCKET)
    .upload(name, data, { contentType: "image/webp", upsert: false, cacheControl: "31536000" });
  if (error) throw new Error(`Fotoğraf depoya yazılamadı: ${error.message}`);
}

export async function readMedia(name: string): Promise<Buffer | null> {
  if (!SAFE_NAME.test(name)) return null;
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).download(name);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteMedia(names: string[]): Promise<void> {
  const safe = names.filter((n) => SAFE_NAME.test(n));
  if (safe.length === 0) return;
  const { error } = await supabaseAdmin().storage.from(BUCKET).remove(safe);
  if (error) console.warn("[sofra/media] silinemedi:", error.message);
}
