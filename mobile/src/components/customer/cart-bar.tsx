import { router, usePathname } from "expo-router";
import { ShoppingBag } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatPrice } from "@sofra/core";
import { Text } from "@/components/ui/text";
import { cartCount, cartTotal, useCart } from "@/store/cart";
import { useTheme } from "@/theme";

/**
 * Canlı sepet çubuğu.
 *
 * Sepette ürün varken ekranın altında belirir; sekme çubuğunun hemen üstüne
 * oturur. Sepeti ayrı bir sekme yapmak yerine bunu seçtik — boş bir sekme
 * sürekli yer kaplamasın, dolu sepet ise her ekranda görünsün.
 *
 * Sepet ekranının kendisinde ve ödeme akışında gizlenir.
 */

const HIDDEN_ON = ["/sepet", "/odeme", "/giris"];

export function CartBar({ bottomOffset = 0 }: { bottomOffset?: number }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const count = useCart(cartCount);
  const total = useCart(cartTotal);
  const restaurant = useCart((s) => s.restaurant);

  if (count === 0 || !restaurant) return null;
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <View
      style={[
        styles.wrap,
        {
          bottom: bottomOffset + Math.max(insets.bottom, 8),
          paddingHorizontal: t.spacing.lg,
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Sepeti aç, ${count} ürün, ${formatPrice(total)}`}
        onPress={() => router.push("/sepet")}
        style={({ pressed }) => [
          styles.bar,
          {
            backgroundColor: t.colors.brand,
            borderRadius: t.radius.md,
            opacity: pressed ? 0.9 : 1,
          },
          t.shadow.lg,
        ]}
      >
        <View
          style={[styles.count, { backgroundColor: "rgba(255,255,255,0.22)" }]}
        >
          <ShoppingBag size={15} color={t.colors.brandContrast} />
          <Text
            variant="small"
            weight="bold"
            tabular
            style={{ color: t.colors.brandContrast }}
          >
            {count}
          </Text>
        </View>

        <Text
          variant="body"
          weight="semibold"
          numberOfLines={1}
          style={{ color: t.colors.brandContrast, flex: 1 }}
        >
          {restaurant.name}
        </Text>

        <Text
          variant="bodyLarge"
          weight="bold"
          tabular
          style={{ color: t.colors.brandContrast }}
        >
          {formatPrice(total)}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 54,
    paddingHorizontal: 12,
  },
  count: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
});
