import { Tabs } from "expo-router";
import { BarChart3, Bike, Wallet } from "lucide-react-native";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { CourierLogin } from "@/components/courier/courier-login";
import { useCourier } from "@/store/courier";
import { useTheme } from "@/theme";

/**
 * Kurye modu geçidi.
 *
 * Web'deki `courier-gate` ile aynı desen: oturum yoksa sekmeler hiç
 * kurulmaz, doğrudan giriş ekranı gösterilir. Böylece korumalı ekranlar
 * bir an bile yetkisiz durumda render edilmez.
 *
 * Oturum açıkken üç sekme: Teslimat (mesai + teklif + aktif iş), Kazanç ve
 * Performans — web kurye panelindeki üç bölümün aynısı.
 */
export default function CourierLayout() {
  const t = useTheme();
  const status = useCourier((s) => s.status);
  const restore = useCourier((s) => s.restore);

  useEffect(() => {
    void restore();
  }, [restore]);

  if (status === "loading") {
    return <View style={{ flex: 1, backgroundColor: t.colors.paper }} />;
  }

  if (status === "guest") {
    return <CourierLogin />;
  }

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
        tabBarLabelStyle: { fontFamily: t.fontFamily.medium, fontSize: 11 },
        sceneStyle: { backgroundColor: t.colors.paper },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Teslimat",
          tabBarIcon: ({ color, size }) => <Bike color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="kazanc"
        options={{
          title: "Kazanç",
          tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="performans"
        options={{
          title: "Performans",
          tabBarIcon: ({ color, size }) => (
            <BarChart3 color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
