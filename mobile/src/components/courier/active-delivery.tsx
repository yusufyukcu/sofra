import { MapPin, Navigation, Phone, StickyNote } from "lucide-react-native";
import { Alert, Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import {
  currentRoute,
  formatDistance,
  formatPrice,
  liveLeg,
  type CourierStage,
  type Order,
} from "@sofra/core";
import { useMaskedCall } from "@/components/call/masked-call";
import { MapView } from "@/components/map/map-view";
import { Button } from "@/components/ui/button";
import { Badge, Card, Divider } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { courierApi } from "@/lib/api";
import { useTheme } from "@/theme";

/**
 * Aktif teslimat.
 *
 * Tek bir birincil eylem gösterilir — kurye sürüş halindeyken karar
 * vermesin diye. Aşama sırası sunucuda zorunlu: sırasız bildirim
 * `invalid_stage` ile reddedilir.
 *
 * Haritadaki çizgi, sunucunun yol tarifi servisinden aldığı gerçek yoldur
 * (yalnızca önündeki kısmı); kalan mesafe ve süre o yoldan hesaplanır.
 * "Yol tarifi" cihazın navigasyon uygulamasını açar (Android'de Google
 * Haritalar navigasyonu, iOS'ta Apple Haritalar).
 */

const NEXT: Record<
  string,
  { action: "arrived" | "pickup" | "deliver"; label: string; hint: string }
> = {
  assigned: {
    action: "arrived",
    label: "Restorana vardım",
    hint: "Restorana ulaştığında bildir",
  },
  at_restaurant: {
    action: "pickup",
    label: "Siparişi teslim aldım",
    hint: "Paketi aldıktan sonra bildir",
  },
  picked_up: {
    action: "deliver",
    label: "Müşteriye teslim ettim",
    hint: "Teslimat tamamlandığında bildir",
  },
};

const STAGE_LABEL: Partial<Record<CourierStage, string>> = {
  assigned: "Restorana gidiyorsun",
  at_restaurant: "Restorandasın",
  picked_up: "Müşteriye gidiyorsun",
};

export function ActiveDelivery({
  order,
  onAdvance,
  busy,
}: {
  order: Order;
  onAdvance: (action: "arrived" | "pickup" | "deliver") => void;
  busy?: boolean;
}) {
  const t = useTheme();
  const stage = order.courierStage ?? "assigned";
  const next = NEXT[stage];
  // Müşterinin numarası kuryeye hiç gelmez: platform hattı + dahili kod
  const call = useMaskedCall(courierApi, `/courier/orders/${order.id}/call`);

  // Hedef: paketi almadıysan restoran, aldıysan müşteri.
  const heading =
    stage === "picked_up" ? order.address.point : order.restaurantLocation;
  const headingLabel =
    stage === "picked_up"
      ? `${order.address.title} · ${order.address.district}`
      : order.restaurantName;

  // Kuryenin önündeki gerçek yol ve kalan mesafe/süre
  const live = liveLeg(order);
  const path = live?.path ?? currentRoute(order);
  const remaining =
    live && stage !== "at_restaurant"
      ? `${formatDistance(live.remainingM / 1000)} · ~${Math.max(1, Math.ceil(live.remainingS / 60))} dk`
      : null;

  function openDirections() {
    const { lat, lng } = heading;
    const bike = order.courier?.vehicle === "bisiklet";
    const web = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${bike ? "bicycling" : "driving"}`;
    const native = Platform.select({
      android: `google.navigation:q=${lat},${lng}&mode=${bike ? "b" : "d"}`,
      ios: `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`,
      default: web,
    });
    Linking.openURL(native)
      .catch(() => Linking.openURL(web))
      .catch(() => Alert.alert("Açılamadı", "Cihazda harita uygulaması bulunamadı."));
  }

  return (
    <Card elevation="md" style={{ gap: t.spacing.md }}>
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="label" tone="brand">
            Aktif teslimat · {order.code}
          </Text>
          <Text variant="title">{STAGE_LABEL[stage] ?? "Teslimat"}</Text>
        </View>
        {order.courierFee ? (
          <Badge label={formatPrice(order.courierFee)} tone="pistachio" />
        ) : null}
      </View>

      <MapView
        height={190}
        path={path}
        markers={[
          {
            point: order.restaurantLocation,
            icon: "Store" as const,
            color: stage === "picked_up" ? t.colors.muted : t.colors.deep,
          },
          ...(order.courierPoint
            ? [
                {
                  point: order.courierPoint,
                  icon: "Bike" as const,
                  color: t.colors.brand,
                  size: 38,
                },
              ]
            : []),
          {
            point: order.address.point,
            icon: "House" as const,
            color:
              stage === "picked_up" ? t.colors.pistachio : t.colors.muted,
          },
        ]}
      />

      {/* Hedef */}
      <View style={styles.target}>
        <Navigation size={17} color={t.colors.brand} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text variant="caption" tabular>
            {remaining ? `Sıradaki durak · ${remaining}` : "Sıradaki durak"}
          </Text>
          <Text variant="body" weight="semibold" tone="ink" numberOfLines={2}>
            {headingLabel}
          </Text>
        </View>
        <Button label="Yol tarifi" size="sm" variant="secondary" onPress={openDirections} />
      </View>

      <Divider />

      {/* Teslimat bilgileri */}
      <View style={{ gap: t.spacing.sm }}>
        <View style={styles.info}>
          <MapPin size={15} color={t.colors.muted} />
          <View style={{ flex: 1, gap: 1 }}>
            <Text variant="body" tone="ink">
              {order.address.line1}
            </Text>
            {order.address.directions ? (
              <Text variant="caption">{order.address.directions}</Text>
            ) : null}
            {order.address.buildingNo || order.address.apartmentNo ? (
              <Text variant="caption">
                {[
                  order.address.buildingNo && `Bina ${order.address.buildingNo}`,
                  order.address.floor && `Kat ${order.address.floor}`,
                  order.address.apartmentNo && `Daire ${order.address.apartmentNo}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Müşteriyi maskeli hattan ara"
            disabled={call.busy}
            onPress={call.start}
            style={({ pressed }) => [
              styles.call,
              {
                backgroundColor: t.colors.pistachioSoft,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Phone size={16} color={t.colors.pistachio} />
          </Pressable>
        </View>

        {order.preferences.note ? (
          <View style={styles.info}>
            <StickyNote size={15} color={t.colors.saffron} />
            <Text variant="small" style={{ flex: 1 }}>
              {order.preferences.note}
            </Text>
          </View>
        ) : null}

        <View style={styles.prefs}>
          {order.preferences.contactless ? (
            <Badge label="Temassız" tone="info" />
          ) : null}
          {order.preferences.ringDoorbell ? (
            <Badge label="Zili çal" tone="neutral" />
          ) : null}
          <Badge
            label={order.paymentLabel}
            tone={
              order.paymentMethod === "cash_on_delivery" ||
              order.paymentMethod === "card_on_delivery"
                ? "saffron"
                : "neutral"
            }
          />
        </View>
      </View>

      {call.sheet}

      {next ? (
        <View style={{ gap: 6 }}>
          <Button
            label={next.label}
            onPress={() => onAdvance(next.action)}
            loading={busy}
            size="lg"
            fullWidth
          />
          <Text variant="caption" center>
            {next.hint}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  target: { flexDirection: "row", alignItems: "center", gap: 10 },
  info: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  call: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  prefs: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
});
