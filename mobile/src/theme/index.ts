import { Platform, useColorScheme } from "react-native";
import {
  darkPalette,
  fontSize,
  lightPalette,
  radius,
  spacing,
  type ThemePalette,
} from "@sofra/core";

/**
 * Tema katmanı.
 *
 * Palet, tipografi ölçeği, boşluk ritmi ve köşe yarıçapları `@sofra/core`
 * içinden gelir — web ile birebir aynı değerler. Burada yalnızca React
 * Native'e özgü olanlar var: gölge tanımları (CSS `box-shadow` yerine
 * `shadowColor`/`elevation`) ve yazı tipi aile adları.
 *
 * Koyu mod cihaz tercihini izler; adımlar açık paletin tersi değil, ayrıca
 * seçilmiş değerlerdir.
 */

export { fontSize, radius, spacing };
export type { ThemePalette };

/**
 * Yazı tipi aileleri — `_layout.tsx` bu adlarla yükler.
 *
 * Webde arkasına sistem yığını ekleniyor: Figtree'de ₺ (U+20BA)
 * glifi yok, yığın olmadan tarayıcı rastgele bir yedekten benzeyen ama yanlış
 * bir karakter çiziyordu. Native'de işletim sistemi bu yedeklemeyi zaten
 * kendisi yapıyor, orada tek aile adı yeterli.
 */
const FALLBACK = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

const stack = (name: string) =>
  Platform.OS === "web" ? `${name}, ${FALLBACK}` : name;

export const fontFamily = {
  /** Başlıklar — web'deki Bricolage Grotesque */
  display: stack("BricolageGrotesque_700Bold"),
  displaySemi: stack("BricolageGrotesque_600SemiBold"),
  /** Arayüz metni — web'deki Figtree */
  regular: stack("Figtree_400Regular"),
  medium: stack("Figtree_500Medium"),
  semibold: stack("Figtree_600SemiBold"),
  bold: stack("Figtree_700Bold"),
} as const;

export interface Shadow {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
}

/** Sıcak tonlu gölgeler — webdeki `--shadow-*` jetonlarının RN karşılığı. */
function shadows(dark: boolean): Record<"sm" | "md" | "lg", Shadow> {
  const color = dark ? "#000000" : "#1c1214";
  return {
    sm: {
      shadowColor: color,
      shadowOpacity: dark ? 0.4 : 0.06,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    md: {
      shadowColor: color,
      shadowOpacity: dark ? 0.5 : 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    lg: {
      shadowColor: color,
      shadowOpacity: dark ? 0.6 : 0.16,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 12 },
      elevation: 12,
    },
  };
}

export interface Theme {
  colors: ThemePalette;
  dark: boolean;
  shadow: Record<"sm" | "md" | "lg", Shadow>;
  spacing: typeof spacing;
  fontSize: typeof fontSize;
  radius: typeof radius;
  fontFamily: typeof fontFamily;
}

const themes: Record<"light" | "dark", Theme> = {
  light: {
    colors: lightPalette,
    dark: false,
    shadow: shadows(false),
    spacing,
    fontSize,
    radius,
    fontFamily,
  },
  dark: {
    colors: darkPalette,
    dark: true,
    shadow: shadows(true),
    spacing,
    fontSize,
    radius,
    fontFamily,
  },
};

export function useTheme(): Theme {
  return themes[useColorScheme() === "dark" ? "dark" : "light"];
}

/** Bileşen dışından (ör. navigatör seçenekleri) tema okumak için. */
export function themeFor(scheme: "light" | "dark" | null | undefined): Theme {
  return themes[scheme === "dark" ? "dark" : "light"];
}
