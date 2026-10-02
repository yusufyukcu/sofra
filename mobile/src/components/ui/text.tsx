import { Children } from "react";
import { Text as RNText, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "@/theme";

/**
 * Tipografi.
 *
 * Ölçek `@sofra/core/theme` içinden gelir; web'deki basamaklarla aynı.
 * Başlıklar Bricolage Grotesque, arayüz metni Geist — iki istemcide aynı
 * yazı tipleri.
 *
 * `tabular` sayı hizalaması içindir: fiyat listelerinde ve sayaçlarda
 * basamaklar kaymasın.
 */

export type TextVariant =
  | "hero"
  | "display"
  | "heading"
  | "title"
  | "bodyLarge"
  | "body"
  | "small"
  | "caption"
  | "label";

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  /** Renk jetonu adı; verilmezse varyantın varsayılanı kullanılır. */
  tone?: "ink" | "text" | "muted" | "brand" | "onDeep" | "onDeepMuted" | "pistachio" | "saffron" | "danger" | "info";
  weight?: "regular" | "medium" | "semibold" | "bold";
  tabular?: boolean;
  center?: boolean;
}

export function Text({
  variant = "body",
  tone,
  weight,
  tabular,
  center,
  style,
  ...rest
}: AppTextProps) {
  const t = useTheme();

  const base: Record<TextVariant, TextStyle> = {
    hero: {
      fontSize: t.fontSize.hero,
      lineHeight: t.fontSize.hero * 1.08,
      fontFamily: t.fontFamily.display,
      letterSpacing: -1,
      color: t.colors.ink,
    },
    display: {
      fontSize: t.fontSize.display,
      lineHeight: t.fontSize.display * 1.14,
      fontFamily: t.fontFamily.display,
      letterSpacing: -0.7,
      color: t.colors.ink,
    },
    heading: {
      fontSize: t.fontSize.heading,
      lineHeight: t.fontSize.heading * 1.2,
      fontFamily: t.fontFamily.display,
      letterSpacing: -0.4,
      color: t.colors.ink,
    },
    title: {
      fontSize: t.fontSize.title,
      lineHeight: t.fontSize.title * 1.25,
      fontFamily: t.fontFamily.displaySemi,
      letterSpacing: -0.2,
      color: t.colors.ink,
    },
    bodyLarge: {
      fontSize: t.fontSize.bodyLarge,
      lineHeight: t.fontSize.bodyLarge * 1.45,
      fontFamily: t.fontFamily.regular,
      color: t.colors.text,
    },
    body: {
      fontSize: t.fontSize.body,
      lineHeight: t.fontSize.body * 1.5,
      fontFamily: t.fontFamily.regular,
      color: t.colors.text,
    },
    small: {
      fontSize: t.fontSize.small,
      lineHeight: t.fontSize.small * 1.45,
      fontFamily: t.fontFamily.regular,
      color: t.colors.muted,
    },
    caption: {
      fontSize: t.fontSize.caption,
      lineHeight: t.fontSize.caption * 1.4,
      fontFamily: t.fontFamily.regular,
      color: t.colors.muted,
    },
    label: {
      fontSize: t.fontSize.micro,
      lineHeight: t.fontSize.micro * 1.3,
      fontFamily: t.fontFamily.semibold,
      letterSpacing: 0.9,
      color: t.colors.muted,
    },
  };

  const weights: Record<string, string> = {
    regular: t.fontFamily.regular,
    medium: t.fontFamily.medium,
    semibold: t.fontFamily.semibold,
    bold: t.fontFamily.bold,
  };

  return (
    <RNText
      {...rest}
      children={variant === "label" ? upperTr(rest.children) : rest.children}
      style={[
        base[variant],
        tone ? { color: t.colors[tone] } : null,
        weight ? { fontFamily: weights[weight] } : null,
        tabular ? { fontVariant: ["tabular-nums"] } : null,
        center ? { textAlign: "center" } : null,
        style,
      ]}
    />
  );
}

/**
 * Türkçe büyük harf.
 *
 * CSS `text-transform: uppercase` belge diline bakar; Expo web sayfası
 * İngilizce olduğu için "teslimat" → "TESLIMAT" oluyordu, oysa Türkçede
 * "TESLİMAT". Native tarafta da `textTransform` yerelden bağımsız çalışıyor.
 * Bu yüzden dönüşümü CSS'e bırakmayıp `tr` yereliyle kendimiz yapıyoruz.
 */
function upperTr(children: React.ReactNode): React.ReactNode {
  return Children.map(children, (child) =>
    typeof child === "string" ? child.toLocaleUpperCase("tr") : child
  );
}
