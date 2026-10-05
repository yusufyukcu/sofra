import { router } from "expo-router";
import { ChevronLeft, type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Logo } from "@/components/brand/logo";
import { useTheme } from "@/theme";
import { Text } from "./text";

/**
 * Ekran çerçevesi.
 *
 * Web'in üst çubuğu gibi başlık da açık zeminde durur: sayfanın yıldızı
 * yemek fotoğrafları, başlık onların önüne geçmez. Marka rengi logoda ve
 * eylem düğmelerinde. Durum çubuğu alanı başlığa dahil, ekranın en üstüne
 * kadar uzanır.
 */

export function Screen({
  children,
  style,
  /** Alt gezinme çubuğu olmayan ekranlarda alt güvenli alan bırakılır */
  edges = "top",
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: "top" | "both" | "none";
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        { flex: 1, backgroundColor: t.colors.paper },
        edges !== "none" && { paddingTop: 0 },
        (edges === "both") && { paddingBottom: insets.bottom },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Başlık.
 *
 * `back` verilirse geri düğmesi çıkar; `title` başlık, `subtitle` altındaki
 * ikincil satır. `logo` verilirse başlık yerine Sofra logosu çizilir (keşfet
 * ekranı). Sağa bir eylem konabilir — `HeaderButton` ile.
 */
export function Header({
  title,
  subtitle,
  back,
  right,
  large,
  logo,
  children,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  /** Sekme ekranlarında başlık büyük gösterilir */
  large?: boolean;
  /** Başlık yerine logo (başlık erişilebilirlik etiketi olarak kalır) */
  logo?: boolean;
  /** Başlığın altına eklenen içerik — ör. arama çubuğu */
  children?: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        backgroundColor: t.colors.surface,
        borderBottomColor: t.colors.border,
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingTop: insets.top + t.spacing.sm,
        paddingBottom: t.spacing.md,
        paddingHorizontal: t.spacing.lg,
        gap: children ? t.spacing.md : 0,
      }}
    >
      <View style={styles.bar}>
        {back ? (
          <HeaderButton
            icon={ChevronLeft}
            label="Geri"
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          />
        ) : null}

        <View style={styles.titles} accessibilityRole="header" accessibilityLabel={logo ? title : undefined}>
          {logo ? (
            <Logo size={30} />
          ) : (
            <Text variant={large ? "heading" : "title"} tone="ink" numberOfLines={1}>
              {title}
            </Text>
          )}
          {subtitle ? (
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {right}
      </View>

      {children}
    </View>
  );
}

/** Başlıktaki yuvarlak eylem düğmesi (geri, favori, çıkış…). */
export function HeaderButton({
  icon: IconComponent,
  label,
  onPress,
  active,
  activeColor,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  /** Seçili durum — ör. favoriye eklenmiş */
  active?: boolean;
  activeColor?: string;
}) {
  const t = useTheme();
  const color = active ? (activeColor ?? t.colors.brand) : t.colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active === undefined ? undefined : { selected: active }}
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [
        styles.headerBtn,
        {
          backgroundColor: t.colors.surface2,
          borderRadius: t.radius.pill,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <IconComponent size={19} color={color} fill={active ? color : "transparent"} strokeWidth={2.2} />
    </Pressable>
  );
}

/** Bölüm başlığı — listeler arasında ayrım için. */
export function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.section, { marginBottom: t.spacing.sm }]}>
      <Text variant="title">{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text variant="small" weight="semibold" tone="brand">
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 40 },
  headerBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  titles: { flex: 1, gap: 1 },
  section: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
});
