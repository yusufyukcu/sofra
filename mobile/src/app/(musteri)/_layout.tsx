import { Tabs } from "expo-router";
import { Compass, Receipt, Search, User } from "lucide-react-native";
import { StyleSheet } from "react-native";
import { useTheme } from "@/theme";

/**
 * Müşteri sekmeleri.
 *
 * Dört sekme: Keşfet, Ara, Siparişlerim, Hesabım. Web'deki başlık
 * gezinmesiyle aynı bölümler — sıralama mobil kullanımına göre: en sık
 * kullanılan solda.
 *
 * Sepet ayrı bir sekme değil; ekranların altında beliren canlı sepet
 * çubuğundan açılır (bkz. `cart-bar.tsx`). Böylece boş bir sekme sürekli
 * yer kaplamaz.
 */

export default function CustomerTabs() {
  const t = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.colors.brand,
        tabBarInactiveTintColor: t.colors.muted,
        tabBarStyle: {
          backgroundColor: t.colors.surface,
          borderTopColor: t.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarLabelStyle: {
          fontFamily: t.fontFamily.medium,
          fontSize: 11,
        },
        sceneStyle: { backgroundColor: t.colors.paper },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Keşfet",
          tabBarIcon: ({ color, size }) => <Compass color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="arama"
        options={{
          title: "Ara",
          tabBarIcon: ({ color, size }) => <Search color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="siparisler"
        options={{
          title: "Siparişlerim",
          tabBarIcon: ({ color, size }) => <Receipt color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="hesabim"
        options={{
          title: "Hesabım",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
