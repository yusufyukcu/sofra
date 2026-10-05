import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/theme";
import { Text } from "./text";

/**
 * Yüzeyler ve küçük parçalar: kart, rozet, ayırıcı, boş durum, iskelet.
 *
 * Hepsi web'deki `.card`, `.band-deep` ve rozet sınıflarının karşılığı;
 * aynı köşe yarıçapı, aynı çerçeve rengi, aynı gölge basamakları.
 */

/* ------------------------------------------------------------------ */
/* Kart                                                                */
/* ------------------------------------------------------------------ */

export function Card({
  children,
  style,
  onPress,
  padded = true,
  elevation = "sm",
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
  elevation?: "none" | "sm" | "md";
}) {
  const t = useTheme();
  const skin: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderColor: t.colors.border,
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: padded ? t.spacing.lg : 0,
    overflow: "hidden",
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          skin,
          elevation !== "none" ? t.shadow[elevation] : null,
          pressed && { opacity: 0.9 },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[skin, elevation !== "none" ? t.shadow[elevation] : null, style]}>
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Rozet                                                               */
/* ------------------------------------------------------------------ */

export type BadgeTone =
  | "neutral"
  | "brand"
  | "saffron"
  | "pistachio"
  | "danger"
  | "info"
  | "deep";

export function Badge({
  label,
  tone = "neutral",
  icon,
  style,
}: {
  label: string;
  tone?: BadgeTone;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const skins: Record<BadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: t.colors.surface2, fg: t.colors.muted },
    brand: { bg: t.colors.brandSoft, fg: t.colors.brand },
    saffron: { bg: t.colors.saffronSoft, fg: t.colors.saffron },
    pistachio: { bg: t.colors.pistachioSoft, fg: t.colors.pistachio },
    danger: { bg: t.colors.dangerSoft, fg: t.colors.danger },
    info: { bg: t.colors.infoSoft, fg: t.colors.info },
    deep: { bg: t.colors.deep, fg: t.colors.onDeep },
  };
  const skin = skins[tone];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: skin.bg, borderRadius: t.radius.pill },
        style,
      ]}
    >
      {icon}
      <Text variant="caption" weight="semibold" style={{ color: skin.fg }}>
        {label}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Ayırıcı                                                             */
/* ------------------------------------------------------------------ */

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View
      style={[
        { height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border },
        style,
      ]}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Satır — etiket solda, değer sağda                                   */
/* ------------------------------------------------------------------ */

export function Row({
  label,
  value,
  strong,
  tone,
  note,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "muted" | "pistachio" | "danger" | "brand";
  note?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLabel}>
        <Text
          variant={strong ? "bodyLarge" : "body"}
          weight={strong ? "semibold" : "regular"}
          tone={strong ? "ink" : "text"}
        >
          {label}
        </Text>
        {note ? <Text variant="caption">{note}</Text> : null}
      </View>
      <Text
        variant={strong ? "bodyLarge" : "body"}
        weight="semibold"
        tone={tone ?? (strong ? "ink" : "text")}
        tabular
      >
        {value}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Boş durum                                                           */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon: IconComponent,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={[styles.empty, { paddingVertical: t.spacing.xxxl }]}>
      <View style={[styles.emptyIcon, { backgroundColor: t.colors.brandSoft }]}>
        <IconComponent size={30} color={t.colors.brand} strokeWidth={1.9} />
      </View>
      <Text variant="title" center>
        {title}
      </Text>
      {description ? (
        <Text variant="body" tone="muted" center style={styles.emptyText}>
          {description}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: t.spacing.md }}>{action}</View> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* İskelet — yükleme sırasında yerleşim zıplamasın                     */
/* ------------------------------------------------------------------ */

export function Skeleton({
  height = 16,
  width = "100%",
  radius,
  style,
}: {
  height?: number;
  width?: number | `${number}%`;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          height,
          width,
          backgroundColor: t.colors.surface2,
          borderRadius: radius ?? t.radius.sm,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 5,
  },
  rowLabel: { flex: 1, gap: 1 },
  empty: { alignItems: "center", gap: 8, paddingHorizontal: 24 },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyText: { maxWidth: 280 },
});
