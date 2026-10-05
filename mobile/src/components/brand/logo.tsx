import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { BRAND_COLORS, LOGO_MARK, LOGO_VIEWBOX } from "@sofra/core";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

/**
 * Buharlı kâse işareti — buhar Sofra'nın "S"sini çizer. Geometri
 * `@sofra/core`'daki `LOGO_MARK`'ta; web bileşeni ve uygulama simgeleri aynı
 * ölçüleri kullanır.
 */
export function LogoMark({ size = 32, color }: { size?: number; color?: string }) {
  const t = useTheme();
  const fill = color ?? t.colors.brand;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`}>
      <Path d={LOGO_MARK.bowl} fill={fill} />
      <Path
        d={LOGO_MARK.steam.d}
        fill="none"
        stroke={fill}
        strokeWidth={LOGO_MARK.steam.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Kırmızı kare içinde krem işaret — uygulama simgesinin kendisi. */
export function LogoTile({ size = 40, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size * 0.28, backgroundColor: BRAND_COLORS.red },
        style,
      ]}
    >
      <LogoMark size={size * 0.72} color={BRAND_COLORS.cream} />
    </View>
  );
}

/** İşaret + "sofra" yazısı. Yazı her zaman küçük harf. */
export function Logo({ size = 30, light }: { size?: number; light?: boolean }) {
  const t = useTheme();
  return (
    <View style={styles.row} accessibilityRole="image" accessibilityLabel="Sofra">
      <LogoMark size={size} color={light ? t.colors.onDeep : t.colors.brand} />
      <Text
        style={{
          fontFamily: t.fontFamily.display,
          fontSize: size * 0.86,
          lineHeight: size,
          letterSpacing: -size * 0.04,
          color: light ? t.colors.onDeep : t.colors.ink,
        }}
      >
        sofra
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 3 },
});
