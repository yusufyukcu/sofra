import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/theme";
import { Text } from "./text";

/**
 * Düğme.
 *
 * Dört görünüm: `primary` (biber salçası dolgu), `secondary` (yüzey + çerçeve),
 * `ghost` (yalnız metin) ve `danger`. Web'deki karşılıklarıyla aynı renk
 * jetonlarını kullanır.
 *
 * Dokunma geri bildirimi: basılı tutarken hafif ölçek yerine opaklık —
 * liste içinde ölçek animasyonu komşu satırları kırpıyor. Ana eylemlerde
 * dokunuşta haptik titreşim var; bu mobilin web'de olmayan tek eklentisi.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Metnin soluna yerleşen ikon */
  icon?: ReactNode;
  /** Sağa yerleşen ikincil metin — ör. tutar */
  trailing?: string;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Haptik geri bildirimi kapat (liste içi küçük düğmelerde gürültü olur) */
  noHaptics?: boolean;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  icon,
  trailing,
  fullWidth,
  style,
  noHaptics,
}: ButtonProps) {
  const t = useTheme();
  const inactive = disabled || loading;

  const heights: Record<ButtonSize, number> = { sm: 36, md: 48, lg: 56 };
  const paddings: Record<ButtonSize, number> = {
    sm: t.spacing.md,
    md: t.spacing.lg,
    lg: t.spacing.xl,
  };

  const skins: Record<
    ButtonVariant,
    { bg: string; border: string; fg: string }
  > = {
    primary: {
      bg: t.colors.brand,
      border: t.colors.brand,
      fg: t.colors.brandContrast,
    },
    secondary: {
      bg: t.colors.surface,
      border: t.colors.border,
      fg: t.colors.ink,
    },
    ghost: { bg: "transparent", border: "transparent", fg: t.colors.brand },
    danger: {
      bg: t.colors.dangerSoft,
      border: t.colors.dangerSoft,
      fg: t.colors.danger,
    },
  };
  const skin = skins[variant];

  function handlePress() {
    if (inactive) return;
    if (!noHaptics && variant === "primary" && Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      accessibilityLabel={trailing ? `${label}, ${trailing}` : label}
      onPress={handlePress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        {
          height: heights[size],
          paddingHorizontal: paddings[size],
          backgroundColor: skin.bg,
          borderColor: skin.border,
          borderRadius: t.radius.md,
          opacity: inactive ? 0.45 : pressed ? 0.82 : 1,
        },
        fullWidth && styles.full,
        variant === "primary" && !inactive ? t.shadow.sm : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={skin.fg} size="small" />
      ) : (
        <>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text
            variant={size === "sm" ? "small" : "body"}
            weight="semibold"
            style={{ color: skin.fg }}
            numberOfLines={1}
          >
            {label}
          </Text>
          {trailing ? (
            <Text
              variant={size === "sm" ? "small" : "body"}
              weight="semibold"
              tabular
              style={[styles.trailing, { color: skin.fg }]}
            >
              {trailing}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth * 2,
    gap: 8,
  },
  full: { alignSelf: "stretch" },
  icon: { marginRight: 2 },
  trailing: { marginLeft: "auto", opacity: 0.92 },
});
