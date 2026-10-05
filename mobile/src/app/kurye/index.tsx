import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Location from "expo-location";
import { router } from "expo-router";
import { Bike, LogOut, MapPin, MapPinOff, Power, Radio } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  PRESENCE_HEARTBEAT_MS,
  formatPrice,
  type Courier,
  type DeliveryOffer,
  type LatLng,
  type Order,
} from "@sofra/core";
import { ActiveDelivery } from "@/components/courier/active-delivery";
import { OfferCard } from "@/components/courier/offer-card";
import { Button } from "@/components/ui/button";
import { Header, HeaderButton, Screen } from "@/components/ui/screen";
import { Card, EmptyState, Skeleton } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { courierApi, errorMessage } from "@/lib/api";
import {
  rememberPoint,
  sendPresence,
  setActiveDelivery,
  startCourierTracking,
  stopCourierTracking,
  type TrackingMode,
} from "@/lib/courier-tracking";
import { useLive } from "@/lib/use-live";
import { useCourier } from "@/store/courier";
import { useTheme } from "@/theme";

/**
 * Kurye operasyon ekranı.
 *
 * Mesai anahtarı, gelen teklif ve aktif teslimat. Pano `useLive` ile 3
 * saniyede bir tazelenir (web Realtime kullanıyor, sözleşme aynı).
 *
 * Konum: mesai açıkken cihazın gerçek GPS'i sunucuya bildirilir
 * (`lib/courier-tracking.ts`). Geliştirme ve mağaza derlemesinde arka planda
 * da akar; Expo Go'da yalnızca uygulama açıkken — ekran bunu kuryeye söyler
 * ve teslimat sürerken ekranı açık tutar. Müşterinin takip haritasında
 * görünen nokta budur.
 */

const KEEP_AWAKE_TAG = "sofra-courier-delivery";

interface BoardPayload {
  courier: Courier;
  offer: (DeliveryOffer & { order: Order }) | null;
  activeOrder: Order | null;
  stats: {
    online: boolean;
    todayDeliveries: number;
    todayEarnings: number;
    todayTips: number;
    weekEarnings: number;
    totalDeliveries: number;
    rating: number;
  };
}

export default function CourierBoardScreen() {
  const t = useTheme();
  const courier = useCourier((s) => s.courier);
  const setCourier = useCourier((s) => s.setCourier);
  const logout = useCourier((s) => s.logout);

  const [busy, setBusy] = useState(false);
  const [shiftBusy, setShiftBusy] = useState(false);

  const { data, loading, refresh } = useLive<BoardPayload>(
    courierApi,
    "/courier/board",
    { intervalMs: 3000 }
  );

  const online = data?.courier.online ?? courier?.online ?? false;
  const activeOrder = data?.activeOrder ?? null;
  const hasActive = Boolean(activeOrder);

  /* ---------------------------------------------------------------- */
  /* Konum paylaşımı                                                  */
  /* ---------------------------------------------------------------- */

  const [tracking, setTracking] = useState<TrackingMode | "denied" | null>(null);

  // Teslimattayken 3 sn'de, beklerken 15 sn'de bir
  useEffect(() => {
    setActiveDelivery(hasActive);
  }, [hasActive]);

  useEffect(() => {
    if (!online) {
      void stopCourierTracking();
      return;
    }
    let cancelled = false;
    (async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (cancelled) return;
      if (permission.status !== "granted") {
        setTracking("denied");
        return;
      }
      const mode = await startCourierTracking();
      if (!cancelled) setTracking(mode);
    })().catch(() => {
      if (!cancelled) setTracking("denied");
    });

    // Kurye dururken konum olayı seyrekleşir: dakikada bir "buradayım" sinyali.
    // Sunucu konumu 5 dk gelmeyen kuryeye teklif göndermez, 15 dk'da mesaiden düşürür.
    const heartbeat = setInterval(sendPresence, PRESENCE_HEARTBEAT_MS);
    return () => {
      cancelled = true;
      clearInterval(heartbeat);
    };
  }, [online]);

  // Arka plan konumu olmayan derlemede teslimat sürerken ekran kararmasın
  useEffect(() => {
    if (tracking !== "foreground" || !hasActive) return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [tracking, hasActive]);

  /* ---------------------------------------------------------------- */
  /* Eylemler                                                         */
  /* ---------------------------------------------------------------- */

  async function toggleShift() {
    setShiftBusy(true);
    try {
      // Mesai konumla başlar: en yakın kurye seçimi bu konuma göre yapılır
      let point: LatLng | undefined;
      if (!online) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          Alert.alert(
            "Konum izni gerekli",
            "Mesaiye başlamak için konum iznini açmalısın; konumu bilinmeyen kuryeye sipariş teklif edilmez."
          );
          return;
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        point = { lat: position.coords.latitude, lng: position.coords.longitude };
        rememberPoint(point);
      }
      const result = await courierApi.post<{ courier: Courier }>(
        "/courier/shift",
        { online: !online, point }
      );
      setCourier(result.courier);
      if (!result.courier.online) setTracking(null);
      await refresh();
    } catch (err) {
      Alert.alert("Mesai değiştirilemedi", errorMessage(err));
    } finally {
      setShiftBusy(false);
    }
  }

  async function answerOffer(action: "accept" | "reject") {
    if (!data?.offer) return;
    setBusy(true);
    try {
      await courierApi.post(`/courier/offers/${data.offer.id}`, { action });
      await refresh();
    } catch (err) {
      Alert.alert("İşlem yapılamadı", errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function advance(action: "arrived" | "pickup" | "deliver") {
    if (!activeOrder) return;
    setBusy(true);
    try {
      await courierApi.post(`/courier/orders/${activeOrder.id}`, { action });
      await refresh();
    } catch (err) {
      Alert.alert("Bildirilemedi", errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const stats = data?.stats;

  return (
    <Screen>
      <Header
        title={courier?.name ?? "Kurye"}
        subtitle={online ? "Mesaide" : "Mesai kapalı"}
        right={
          <HeaderButton
            icon={LogOut}
            label="Kurye oturumunu kapat"
            onPress={() =>
              Alert.alert("Çıkış yap", "Kurye oturumunu kapatmak istiyor musun?", [
                { text: "Vazgeç", style: "cancel" },
                {
                  text: "Çıkış yap",
                  style: "destructive",
                  onPress: async () => {
                    await logout();
                    router.replace("/");
                  },
                },
              ])
            }
          />
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md }}
      >
        {/* Mesai */}
        <Card
          style={[
            { gap: t.spacing.md },
            online && { borderColor: t.colors.pistachio, borderWidth: 1.4 },
          ]}
        >
          <View style={styles.shift}>
            <View
              style={[
                styles.shiftIcon,
                {
                  backgroundColor: online
                    ? t.colors.pistachioSoft
                    : t.colors.surface2,
                },
              ]}
            >
              <Power
                size={20}
                color={online ? t.colors.pistachio : t.colors.muted}
              />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text variant="body" weight="semibold" tone="ink">
                {online ? "Mesaidesin" : "Mesai kapalı"}
              </Text>
              <Text variant="caption">
                {online
                  ? "Yakındaki siparişler teklif olarak düşer"
                  : "Teklif almak için mesaiyi aç"}
              </Text>
            </View>
            <Button
              label={online ? "Kapat" : "Aç"}
              size="sm"
              variant={online ? "secondary" : "primary"}
              onPress={toggleShift}
              loading={shiftBusy}
              style={{ minWidth: 76 }}
            />
          </View>

          {stats ? (
            <View style={styles.stats}>
              <Stat label="Bugün" value={String(stats.todayDeliveries)} suffix="teslimat" />
              <Stat label="Kazanç" value={formatPrice(stats.todayEarnings)} />
              <Stat label="Bahşiş" value={formatPrice(stats.todayTips)} />
              <Stat label="Puan" value={stats.rating.toFixed(1)} />
            </View>
          ) : null}

          {online && tracking ? <TrackingNotice mode={tracking} /> : null}
        </Card>

        {/* Teklif */}
        {data?.offer ? (
          <OfferCard
            offer={data.offer}
            order={data.offer.order}
            onAccept={() => answerOffer("accept")}
            onReject={() => answerOffer("reject")}
            busy={busy}
          />
        ) : null}

        {/* Aktif teslimat */}
        {activeOrder ? (
          <ActiveDelivery order={activeOrder} onAdvance={advance} busy={busy} />
        ) : null}

        {/* Boş durum */}
        {!data?.offer && !activeOrder ? (
          loading ? (
            <Skeleton height={180} radius={t.radius.lg} />
          ) : online ? (
            <EmptyState
              icon={Radio}
              title="Teklif bekleniyor"
              description="Yakındaki bir restoran sipariş hazırlamaya başladığında ilk sen haberdar olacaksın."
            />
          ) : (
            <EmptyState
              icon={Bike}
              title="Mesai kapalı"
              description="Mesaiyi açtığında sana en yakın siparişler 45 saniyelik teklif olarak düşer."
            />
          )
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

/** Konum paylaşımının durumu: kilit ekranında da mı, yalnızca uygulama açıkken mi, izin yok mu. */
function TrackingNotice({ mode }: { mode: TrackingMode | "denied" }) {
  const t = useTheme();
  const tone =
    mode === "background"
      ? t.colors.pistachio
      : mode === "foreground"
        ? t.colors.saffron
        : t.colors.danger;
  const text =
    mode === "background"
      ? "Konumun arka planda da paylaşılıyor: ekranı kilitlesen ya da navigasyona geçsen de müşteri seni canlı görür."
      : mode === "foreground"
        ? "Bu derlemede arka plan konumu yok (Expo Go): teslimat boyunca uygulamayı açık tut, ekran kararmaz."
        : "Konum izni kapalı. Ayarlardan Sofra'ya konum izni ver; konumu bilinmeyen kuryeye sipariş teklif edilmez.";
  const Icon = mode === "denied" ? MapPinOff : MapPin;
  return (
    <View style={styles.notice}>
      <Icon size={15} color={tone} />
      <Text variant="caption" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text variant="caption">{label}</Text>
      <Text variant="bodyLarge" weight="semibold" tone="ink" tabular>
        {value}
      </Text>
      {suffix ? <Text variant="caption">{suffix}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shift: { flexDirection: "row", alignItems: "center", gap: 12 },
  shiftIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  stats: { flexDirection: "row", gap: 12 },
  stat: { flex: 1, gap: 1 },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
});
