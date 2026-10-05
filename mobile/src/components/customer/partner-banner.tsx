import * as WebBrowser from "expo-web-browser";
import { ArrowRight, ChefHat, Store } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { API_BASE_URL } from "@/lib/api";
import { useTheme } from "@/theme";

/**
 * "Sofra'da restoranın olsun" — keşif ekranındaki kalıcı başvuru afişi.
 * Başvuru formu web'de; uygulama içi tarayıcıda açılır.
 */
export function PartnerBanner() {
  const t = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Restoranını Sofra'ya ekle, ücretsiz başvur"
      onPress={() => void WebBrowser.openBrowserAsync(`${API_BASE_URL}/isletme-basvuru`)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: t.colors.deep, borderRadius: t.radius.xl, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={styles.watermark} pointerEvents="none">
        <ChefHat size={130} color={t.colors.onDeep} strokeWidth={1.2} />
      </View>
      <View style={[styles.icon, { backgroundColor: t.colors.brand }]}>
        <Store size={24} color={t.colors.brandContrast} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="title" style={{ color: t.colors.onDeep }}>
          Sofra&apos;da restoranın olsun
        </Text>
        <Text variant="small" style={{ color: t.colors.onDeepMuted }}>
          %12 komisyon · 3 günde yayında · 0 ₺ kurulum
        </Text>
        <View style={styles.cta}>
          <Text variant="small" weight="bold" style={{ color: t.colors.onDeep }}>
            Ücretsiz başvur
          </Text>
          <ArrowRight size={15} color={t.colors.onDeep} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18, overflow: "hidden" },
  watermark: { position: "absolute", right: -18, top: -22, opacity: 0.08, transform: [{ rotate: "12deg" }] },
  icon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  cta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
});
