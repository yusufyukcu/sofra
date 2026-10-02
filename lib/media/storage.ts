import fs from "node:fs";
import path from "node:path";

/**
 * Restoranların yüklediği fotoğrafların deposu.
 *
 * Prototipte `.data/uploads` klasörü kullanılır (git'e girmez, `.data`
 * silinince sıfırlanır). Üretimde nesne deposuna (Vercel Blob, S3) geçmek
 * için yalnızca bu dosyanın değişmesi yeterli: okuma, yazma ve silme
 * başka hiçbir yerde yapılmaz.
 */

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

/** Dosya adları sunucuda üretilir; bu kalıp dışındaki her ad reddedilir
 *  (`../` ile klasör dışına çıkılamasın). */
const SAFE_NAME = /^med_[a-z0-9]+\.webp$/;

export function saveMedia(name: string, data: Buffer): void {
  if (!SAFE_NAME.test(name)) throw new Error(`Geçersiz dosya adı: ${name}`);
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, name), data);
}

export function readMedia(name: string): Buffer | null {
  if (!SAFE_NAME.test(name)) return null;
  try {
    return fs.readFileSync(path.join(UPLOAD_DIR, name));
  } catch {
    return null;
  }
}

export function deleteMedia(name: string): void {
  if (!SAFE_NAME.test(name)) return;
  try {
    fs.unlinkSync(path.join(UPLOAD_DIR, name));
  } catch {
    /* dosya zaten yok */
  }
}
