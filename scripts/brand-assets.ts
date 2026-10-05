/**
 * Marka simgelerini üretir.
 *
 *   npm run brand:assets
 *
 * Tek kaynak `packages/core/src/brand.ts`: işaretin geometrisi ve renkleri
 * oradan okunur, bütün boyutlar buradan yeniden üretilir. İşaret değişirse
 * yalnızca bu betik yeniden çalıştırılır.
 *
 *   Web     app/icon.svg, app/favicon.ico, app/apple-icon.png,
 *           public/icons/icon-{192,512}.png, icon-maskable-512.png, badge-96.png
 *   Mobil   mobile/assets/images/{icon,favicon,splash-icon}.png ve
 *           android-icon-{foreground,background,monochrome}.png
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { BRAND_COLORS, LOGO_VIEWBOX, logoMarkSvg } from "../packages/core/src/brand";

const root = process.cwd();
const out = (...parts: string[]) => {
  const file = path.join(root, ...parts);
  mkdirSync(path.dirname(file), { recursive: true });
  return file;
};

/**
 * Kare tuval: isteğe bağlı zemin (köşe yuvarlaklığıyla) ve ortada işaret.
 * `scale` işaretin tuvalin ne kadarını kaplayacağı (0–1).
 */
function canvas({
  size,
  background,
  radius = 0,
  color,
  scale,
}: {
  size: number;
  background?: string;
  radius?: number;
  color: string;
  scale: number;
}): string {
  const mark = size * scale;
  const offset = (size - mark) / 2;
  const unit = mark / LOGO_VIEWBOX;
  const bg = background
    ? `<rect width="${size}" height="${size}" rx="${radius}" fill="${background}"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg}<g transform="translate(${offset} ${offset}) scale(${unit})">${logoMarkSvg(color)}</g></svg>`;
}

const png = (svg: string) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();

/** Birden çok PNG'yi tek .ico dosyasına koyar (PNG gömülü ICO, tüm tarayıcılar okur). */
function ico(images: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries: Buffer[] = [];
  let offset = 6 + images.length * 16;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const { red, cream } = BRAND_COLORS;
/** Yuvarlatılmış kare simge (favicon ve web simgeleri) */
const rounded = (size: number, scale = 0.76) =>
  canvas({ size, background: red, radius: size * 0.23, color: cream, scale });
/** Köşesiz tam dolu kare (iOS ve Android köşeyi kendisi keser) */
const square = (size: number, scale: number) => canvas({ size, background: red, color: cream, scale });

async function main() {
  // Web
  writeFileSync(out("app", "icon.svg"), rounded(48));
  writeFileSync(
    out("app", "favicon.ico"),
    ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(rounded(size)) }))))
  );
  writeFileSync(out("app", "apple-icon.png"), await png(square(180, 0.62)));
  writeFileSync(out("public", "icons", "icon-192.png"), await png(rounded(192)));
  writeFileSync(out("public", "icons", "icon-512.png"), await png(rounded(512)));
  // Maskelenebilir: işaret %80'lik güvenli alanın içinde kalsın
  writeFileSync(out("public", "icons", "icon-maskable-512.png"), await png(square(512, 0.56)));
  // Bildirim rozeti: Android durum çubuğu yalnızca saydamlığı kullanır (tek renk)
  writeFileSync(out("public", "icons", "badge-96.png"), await png(canvas({ size: 96, color: "#ffffff", scale: 0.86 })));

  // Mobil
  const images = (...name: string[]) => out("mobile", "assets", "images", ...name);
  writeFileSync(images("icon.png"), await png(square(1024, 0.6)));
  writeFileSync(images("favicon.png"), await png(rounded(48)));
  writeFileSync(images("splash-icon.png"), await png(canvas({ size: 512, color: cream, scale: 1 })));
  // Uyarlanabilir simge: ön plan 108dp'nin ortadaki 66dp'lik güvenli dairesine sığar
  writeFileSync(images("android-icon-foreground.png"), await png(canvas({ size: 512, color: cream, scale: 0.5 })));
  writeFileSync(
    images("android-icon-background.png"),
    await sharp({ create: { width: 512, height: 512, channels: 4, background: red } }).png().toBuffer()
  );
  writeFileSync(images("android-icon-monochrome.png"), await png(canvas({ size: 432, color: "#ffffff", scale: 0.5 })));

  console.log("Marka simgeleri üretildi.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
