import * as Location from "expo-location";
import { router } from "expo-router";
import { LogOut, Power } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  IDLE_LOCATION_PING_MS,
  LOCATION_PING_MS,
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
import { Header, Screen } from "@/components/ui/screen";
import { Card, EmptyState, Skeleton } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { courierApi, errorMessage } from "@/lib/api";
import { useLive } from "@/lib/use-live";
import { useCourier } from "@/store/courier";
import { useTheme } from "@/theme";

/**
 * Kurye operasyon ekranı.
 *
 * Mesai anahtarı, gelen teklif ve aktif teslimat. Pano `useLive` ile 3
 * saniyede bir tazelenir (web SSE kullanıyor, sözleşme aynı).
 *
 * Konum: mesai açıkken cihazın gerçek GPS'i dinlenir ve sunucuya bildirilir.
 * Web panelinde bu konum "simüle sürüş" ile üretiliyordu; mobilde gerçek
 * olanı gönderiyoruz — uç nokta ve gövde aynı, yalnızca kaynak değişti.
 * Müşterinin takip haritasında görünen nokta budur.
 */

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

  /* ---------------------------------------------------------------- */
  /* Konum yayını                                                     */
  /* ---------------------------------------------------------------- */

  const watcher = useRef<Location.LocationSubscription | null>(null);
  const lastSent = useRef(0);
  const lastPoint = useRef<LatLng | null>(null);
  const hasActive = Boolean(activeOrder);
  const hasActiveRef = useRef(hasActive);
  hasActiveRef.current = hasActive;

  const pushLocation = useCallback(async (point: LatLng, force = false) => {
    // Teslimatta 3 sn'de, beklerken 15 sn'de bir; varlık sinyali beklemeden gönderir
    const interval = hasActiveRef.current ? LOCATION_PING_MS : IDLE_LOCATION_PING_MS;
    const now = Date.now();
    if (!force && now - lastSent.current < interval) return;
    lastSent.current = now;
    try {
      await courierApi.post("/courier/location", { point });
    } catch {
      /* konum bildirimi başarısızsa sessiz geç, sonraki tur dener */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || cancelled) return;

      watcher.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: LOCATION_PING_MS,
          distanceInterval: 10,
        },
        (position) => {
          const point = { lat: position.coords.latitude, lng: position.coords.longitude };
          lastPoint.current = point;
          void pushLocation(point);
        }
      );
    }

    if (online) void start();

    // Kurye dururken konum olayı gelmez: dakikada bir "buradayım" sinyali.
    // Sunucu konumu 5 dk gelmeyen kuryeye teklif göndermez, 15 dk'da mesaiden düşürür.
    const heartbeat = online
      ? setInterval(() => {
          if (lastPoint.current) void pushLocation(lastPoint.current, true);
        }, PRESENCE_HEARTBEAT_MS)
      : null;

    return () => {
      cancelled = true;
      watcher.current?.remove();
      watcher.current = null;
      if (heartbeat) clearInterval(heartbeat);
    };
  }, [online, pushLocation]);

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
        lastPoint.current = point;
      }
      const result = await courierApi.post<{ courier: Courier }>(
        "/courier/shift",
        { online: !online, point }
      );
      setCourier(result.courier);
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kurye oturumunu kapat"
            hitSlop={10}
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
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: t.colors.deep2, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <LogOut size={17} color={t.colors.onDeepMuted} />
          </Pressable>
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
              emoji="📡"
              title="Teklif bekleniyor"
              description="Yakındaki bir restoran sipariş hazırlamaya başladığında ilk sen haberdar olacaksın."
            />
          ) : (
            <EmptyState
              emoji="🛵"
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
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
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
});
