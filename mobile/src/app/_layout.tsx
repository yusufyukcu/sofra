import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from "@expo-google-fonts/bricolage-grotesque";
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from "@expo-google-fonts/figtree";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View, useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
// Arka plan konum görevi açılışta tanımlanmalı (uygulama arka planda uyanınca da)
import "@/lib/courier-tracking";
import { BRAND_COLORS } from "@sofra/core";
import { hydrateTokens } from "@/lib/token-store";
import { useSession } from "@/store/session";
import { themeFor } from "@/theme";

/**
 * Kök yerleşim.
 *
 * Üç şey yapar: web'le aynı yazı tiplerini yükler (Bricolage Grotesque +
 * Figtree), cihazın güvenli alanındaki oturum token'larını okur ve oturumu
 * sunucudan doğrular. Üçü de bitmeden açılış ekranı kapanmaz, böylece
 * kullanıcı hiçbir zaman yarı yüklü bir ekran görmez.
 */

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = themeFor(scheme === "dark" ? "dark" : "light");
  const status = useSession((s) => s.status);
  const bootstrap = useSession((s) => s.bootstrap);

  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });

  // Önce diskteki token, sonra sunucu doğrulaması.
  useEffect(() => {
    void hydrateTokens().then(bootstrap);
  }, [bootstrap]);

  const ready = (fontsLoaded || !!fontError) && status !== "loading";

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) {
    // Açılış ekranıyla aynı zemin: yazı tipleri yüklenirken renk sıçramasın
    return <View style={{ flex: 1, backgroundColor: BRAND_COLORS.red }} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.paper },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(musteri)" />
        <Stack.Screen
          name="giris"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen name="restoran/[slug]" />
        <Stack.Screen
          name="sepet"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen name="odeme" />
        <Stack.Screen name="siparis/[id]" />
        <Stack.Screen
          name="siparis/[id]/degerlendir"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen name="kurye" />
        <Stack.Screen name="destek" />
        <Stack.Screen name="bildirimler" />
        <Stack.Screen name="kartlar" />
        <Stack.Screen
          name="adres-ekle"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
