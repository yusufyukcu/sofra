/**
 * Marka işareti — "buharlı kâse".
 *
 * Yeni pişmiş yemeğin kâsesi ve üstünden yükselen buhar; buhar Sofra'nın
 * "S"sini çizer. Hem "sıcak yemek" hem marka adı tek bakışta okunur ve
 * 16 piksellik favicon'da bile seçilir. Tek renkle çizilir; rengi kullanan
 * bağlam belirler (kırmızı kutuda krem, beyaz başlıkta kırmızı).
 *
 * Geometri tek yerde: web bileşeni (`components/brand/logo.tsx`), mobil
 * bileşen (`mobile/src/components/brand/logo.tsx`) ve uygulama simgelerini
 * üreten betik (`scripts/brand-assets.ts`) aynı ölçüleri kullanır.
 */

export const BRAND_COLORS = {
  /** Biber kırmızısı — marka zemini */
  red: "#CF2F1C",
  /** Kırmızı zemin üstündeki işaret rengi */
  cream: "#FFF6F0",
  /** Koyu bant — alt bilgi, açılış ekranı */
  deep: "#2E1720",
} as const;

export const LOGO_VIEWBOX = 48;

export const LOGO_MARK = {
  /** Kâse — dolu yarım daire, ağzı düz */
  bowl: "M7.5 24.5h33a16.5 16.5 0 0 1-33 0z",
  /** Buhar — "S" çizgisi (kalem, dolgusuz) */
  steam: {
    d: "M28.8 8.2c-2.2-1.9-7.6-1.6-8.4 1.7-.9 3.9 8.8 3.6 7.6 8.2-.8 3.1-5.6 3.9-8.4 2",
    strokeWidth: 3.7,
  },
} as const;

/**
 * Kişi avatarı: emoji yerine baş harfler, isimden türeyen sabit bir renk.
 * Tonlar beyaz yazıyla en az 5.5:1 kontrast verir.
 */
const AVATAR_TONES = [
  "#B02514",
  "#8F4A12",
  "#3A7531",
  "#2A5DA8",
  "#6B3C8C",
  "#2E1720",
  "#9C3D54",
  "#2F6B66",
] as const;

export function avatarFor(name: string): { initials: string; color: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return {
    initials: (first + last).toLocaleUpperCase("tr-TR"),
    color: AVATAR_TONES[hash % AVATAR_TONES.length],
  };
}

/** İşaretin SVG içeriği (dış `<svg>` olmadan) — betikler ve web için. */
export function logoMarkSvg(color: string): string {
  const { bowl, steam } = LOGO_MARK;
  return [
    `<path d="${bowl}" fill="${color}"/>`,
    `<path d="${steam.d}" fill="none" stroke="${color}" stroke-width="${steam.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`,
  ].join("");
}
