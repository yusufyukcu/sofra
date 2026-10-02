import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme";
import { Text } from "./text";

/**
 * Ekran çerçevesi.
 *
 * Web'de her sayfanın tepesinde sabit bir patlıcan bandı var; mobilde de
 * aynı bant başlık olarak duruyor. Durum çubuğu alanı banda dahil — böylece
 * koyu bant ekranın en üstüne kadar uzanır, web'deki görünümle eşleşir.
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
 * Koyu başlık bandı.
 *
 * `back` verilirse geri düğmesi çıkar; `title` başlık, `subtitle` altındaki
 * ikincil satır. Sağa bir eylem konabilir.
 */
export function Header({
  title,
  subtitle,
  back,
  right,
  large,
  children,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  /** Anasayfada başlık büyük gösterilir */
  large?: boolean;
  /** Bandın altına eklenen içerik — ör. arama çubuğu */
  children?: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        backgroundColor: t.colors.deep,
        paddingTop: insets.top + t.spacing.sm,
        paddingBottom: t.spacing.md,
        paddingHorizontal: t.spacing.lg,
        gap: children ? t.spacing.md : 0,
      }}
    >
      <View style={styles.bar}>
        {back ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Geri"
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
            hitSlop={12}
            style={({ pressed }) => [
              styles.backBtn,
              {
                backgroundColor: t.colors.deep2,
                borderRadius: t.radius.pill,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <ChevronLeft size={20} color={t.colors.onDeep} strokeWidth={2.4} />
          </Pressable>
        ) : null}

        <View style={styles.titles}>
          <Text
            variant={large ? "heading" : "title"}
            style={{ color: t.colors.onDeep }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              variant="caption"
              style={{ color: t.colors.onDeepMuted }}
              numberOfLines={1}
            >
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
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  titles: { flex: 1, gap: 1 },
  section: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
});
