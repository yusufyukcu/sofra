import { hashString } from "./utils";

/**
 * Tasarım jetonları — web ve mobilin paylaştığı tek palet.
 *
 * Palet Türk mutfağından türetildi: patlıcan koyusu (başlık/alt bilgi
 * çapası), biber salçası kırmızısı (marka), safran (puan), antep fıstığı
 * (olumlu durum). Zemin nötr bej değil, neredeyse beyaz sıcak kâğıt.
 *
 * `app/globals.css` aynı değerleri CSS değişkeni olarak taşır. İkisinin
 * ayrışmaması `npm run check:theme` ile doğrulanır — betik CSS'i ayrıştırıp
 * buradaki her jetonla karşılaştırır, fark varsa hata verir.
 */

export interface ThemePalette {
  /* Zemin & yüzeyler */
  paper: string;
  surface: string;
  surface2: string;
  surface3: string;
  border: string;
  borderStrong: string;

  /* Metin */
  ink: string;
  text: string;
  muted: string;

  /* Patlıcan */
  deep: string;
  deep2: string;
  deep3: string;
  onDeep: string;
  onDeepMuted: string;

  /* Marka — biber salçası */
  brand: string;
  brandHover: string;
  brandSoft: string;
  brandContrast: string;

  /* Safran — puan, kampanya */
  saffron: string;
  saffronSoft: string;

  /* Antep fıstığı — olumlu durum */
  pistachio: string;
  pistachioSoft: string;

  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;

  /* Grafik serileri — dataviz doğrulayıcısından geçmiş kategorik çift */
  chartNet: string;
  chartCommission: string;
  chartGrid: string;
}

/** CSS değişkeni adı ↔ jeton adı eşlemesi. Doğrulama betiği bunu okur. */
export const CSS_VARIABLE_MAP: Record<keyof ThemePalette, string> = {
  paper: "--paper",
  surface: "--surface",
  surface2: "--surface-2",
  surface3: "--surface-3",
  border: "--border",
  borderStrong: "--border-strong",
  ink: "--ink",
  text: "--text",
  muted: "--muted",
  deep: "--deep",
  deep2: "--deep-2",
  deep3: "--deep-3",
  onDeep: "--on-deep",
  onDeepMuted: "--on-deep-muted",
  brand: "--brand",
  brandHover: "--brand-hover",
  brandSoft: "--brand-soft",
  brandContrast: "--brand-contrast",
  saffron: "--saffron",
  saffronSoft: "--saffron-soft",
  pistachio: "--pistachio",
  pistachioSoft: "--pistachio-soft",
  danger: "--danger",
  dangerSoft: "--danger-soft",
  info: "--info",
  infoSoft: "--info-soft",
  chartNet: "--chart-net",
  chartCommission: "--chart-commission",
  chartGrid: "--chart-grid",
};

export const lightPalette: ThemePalette = {
  paper: "#fcfaf7",
  surface: "#ffffff",
  surface2: "#f5f0ea",
  surface3: "#eae2d9",
  border: "#e9e1d7",
  borderStrong: "#d4c8ba",

  ink: "#1c1214",
  text: "#241a1b",
  muted: "#7a6b66",

  deep: "#2e1720",
  deep2: "#3e2029",
  deep3: "#522b36",
  onDeep: "#f8f1ec",
  onDeepMuted: "#c3a7ac",

  brand: "#df4128",
  brandHover: "#c4351e",
  brandSoft: "#fceae5",
  brandContrast: "#ffffff",

  saffron: "#c47f0a",
  saffronSoft: "#fbf1dc",

  pistachio: "#4b7f3e",
  pistachioSoft: "#e8f1e4",

  danger: "#c42b1f",
  dangerSoft: "#fceae8",
  info: "#2a62c4",
  infoSoft: "#e8effc",

  chartNet: "#c4351e",
  chartCommission: "#2f6bb5",
  chartGrid: "#ece5dd",
};

/** Koyu mod adımları ayrı seçildi — açık paletin otomatik tersi değil. */
export const darkPalette: ThemePalette = {
  paper: "#131011",
  surface: "#1b1617",
  surface2: "#241d1f",
  surface3: "#312629",
  border: "#302729",
  borderStrong: "#463a3c",

  ink: "#f9f4f1",
  text: "#efe7e4",
  muted: "#a6938f",

  deep: "#1d0f15",
  deep2: "#291620",
  deep3: "#3a1f2a",
  onDeep: "#f8f1ec",
  onDeepMuted: "#b6999f",

  brand: "#ff5c3e",
  brandHover: "#ff7357",
  brandSoft: "#3a1710",
  brandContrast: "#190a06",

  saffron: "#eeac36",
  saffronSoft: "#33240c",

  pistachio: "#72b25e",
  pistachioSoft: "#182710",

  danger: "#f5695c",
  dangerSoft: "#331512",
  info: "#6d9bf5",
  infoSoft: "#13203a",

  chartNet: "#ea6244",
  chartCommission: "#4e8fe2",
  chartGrid: "#2b2325",
};

/**
 * Tipografi ölçeği. Web `clamp()` ile akışkan çalışır; mobilde sabit
 * basamaklar kullanılır çünkü ekran genişliği zaten dar bir aralıkta.
 */
export const fontSize = {
  micro: 11,
  caption: 12,
  small: 13,
  body: 15,
  bodyLarge: 17,
  title: 20,
  heading: 24,
  display: 30,
  hero: 36,
} as const;

/** 4 katlı boşluk ölçeği — iki istemcide de aynı ritim. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

/**
 * Mutfağa göre renklenen ürün görseli tonları.
 *
 * Fotoğraf yerine katmanlı bir degrade üretilir: kebapçı sıcak kırmızıya,
 * sağlıklı mutfak yeşile, balıkçı maviye oturur. Renk dekorasyon değil bilgi
 * taşır — listeyi tararken kategori göz ucuyla ayırt edilir.
 *
 * Web bunu CSS `radial-gradient` katmanlarıyla, mobil `react-native-svg`
 * `<RadialGradient>` ile çizer. Geometri de burada üretildiği için aynı
 * restoran iki istemcide birebir aynı görseli alır.
 */
export type FoodTone =
  | "burger"
  | "kebap"
  | "pizza"
  | "tatli"
  | "saglikli"
  | "tavuk"
  | "cigkofte"
  | "deniz"
  | "kahvalti"
  | "uzakdogu"
  | "evyemekleri"
  | "kahve"
  | "tost"
  | "pide";

/** [leke1, leke2, leke3, tabanDegradeBaşı, tabanDegradeSonu] */
export const FOOD_TONES: Record<
  FoodTone,
  [string, string, string, string, string]
> = {
  burger:      ["#F0803C", "#D13A22", "#7C2214", "#C4451F", "#8E2A14"],
  kebap:       ["#E2542A", "#B31E1E", "#6E1410", "#B93A1C", "#7A1E11"],
  pide:        ["#E7A23C", "#C25B1C", "#7A3410", "#C9701F", "#8A4212"],
  tavuk:       ["#F2B441", "#D97A17", "#8A430A", "#D98A1E", "#96500F"],
  cigkofte:    ["#D94A4A", "#9B1B33", "#5C0F22", "#AE2438", "#6B1024"],
  pizza:       ["#EE7148", "#C22E2E", "#4E7A32", "#BE3A24", "#6C2317"],
  tatli:       ["#F58BB0", "#C7407C", "#7A1F4E", "#D4538A", "#832A55"],
  saglikli:    ["#8FCB5E", "#3E9457", "#1E5A3A", "#4C9E56", "#255F39"],
  deniz:       ["#5AC8D8", "#1E7FA8", "#0E3E62", "#2086AB", "#123F63"],
  kahvalti:    ["#F7C85A", "#DB9A2A", "#96601A", "#E0A733", "#9C6A1E"],
  uzakdogu:    ["#57C4A0", "#1F7D7A", "#2A2F6B", "#268A82", "#2C3470"],
  evyemekleri: ["#E9A05A", "#B4612C", "#6E3618", "#BC6F2F", "#77401C"],
  kahve:       ["#C99A6B", "#8B5A33", "#472B18", "#8E6039", "#4E301B"],
  tost:        ["#F3C069", "#D08A2C", "#8A5316", "#D2942F", "#8F5C1A"],
};

const TONE_ORDER = Object.keys(FOOD_TONES) as FoodTone[];

export interface FoodArtwork {
  tone: FoodTone;
  /** Üç lekenin rengi */
  blobs: [string, string, string];
  /** Taban degradesinin iki ucu */
  base: [string, string];
  /** Lekelerin yüzde cinsinden merkezleri — [x, y] */
  centers: [[number, number], [number, number], [number, number]];
  /** Taban degradesinin açısı (derece) */
  angle: number;
  /** Emoji'nin hafif eğimi (derece) */
  rotate: number;
}

/**
 * Tohumdan deterministik görsel üretir. Aynı tohum + aynı ton her zaman
 * aynı sonucu verir; iki istemci de bu fonksiyonu çağırdığı için görseller
 * birebir örtüşür.
 */
export function foodArtwork(seed: string, tone?: string): FoodArtwork {
  const hash = hashString(seed);
  const key: FoodTone =
    tone && tone in FOOD_TONES
      ? (tone as FoodTone)
      : TONE_ORDER[hash % TONE_ORDER.length];
  const [b1, b2, b3, base1, base2] = FOOD_TONES[key];

  // Lekelerin yerini tohuma göre kaydır — her restoran kendine özgü görünsün
  const jx = (hash % 24) - 12;
  const jy = ((hash >> 5) % 24) - 12;

  return {
    tone: key,
    blobs: [b1, b2, b3],
    base: [base1, base2],
    centers: [
      [18 + jx, 22 + jy],
      [86 - jx, 26 + jy],
      [58 + jy, 102 - jx],
    ],
    angle: 145 + (hash % 5) * 12,
    rotate: ((hash >> 3) % 13) - 6,
  };
}
