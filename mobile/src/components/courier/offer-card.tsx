import * as Haptics from "expo-haptics";
import { Clock, MapPin, Navigation } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import {
  OFFER_TTL_SECONDS,
  formatDistance,
  formatPrice,
  type DeliveryOffer,
  type Order,
} from "@sofra/core";
import { MapView } from "@/components/map/map-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

/**
 * Teslimat teklifi.
 *
 * 45 saniyelik geri sayım (`OFFER_TTL_SECONDS` çekirdekten gelir, web ile
 * aynı değer). Süre dolarsa sunucu teklifi bir sonraki kuryeye geçirir —
 * bu bileşen yalnızca kalan süreyi gösterir, kararı sunucu verir.
 *
 * Teklif düştüğünde titreşim var: kurye telefona bakmıyor olabilir.
 */

export function OfferCard({
  offer,
  order,
  onAccept,
  onReject,
  busy,
}: {
  offer: DeliveryOffer;
  order: Order;
  onAccept: () => void;
  onReject: () => void;
  busy?: boolean;
}) {
  const t = useTheme();
  const [remaining, setRemaining] = useState(() => secondsLeft(offer.expiresAt));

  // Yeni teklif geldiğinde dikkat çek.
  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (announced.current === offer.id) return;
    announced.current = offer.id;
    if (Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [offer.id]);

  useEffect(() => {
    setRemaining(secondsLeft(offer.expiresAt));
    const timer = setInterval(
      () => setRemaining(secondsLeft(offer.expiresAt)),
      250
    );
    return () => clearInterval(timer);
  }, [offer.expiresAt]);

  const ratio = Math.max(0, Math.min(1, remaining / OFFER_TTL_SECONDS));
  const urgent = remaining <= 10;

  return (
    <Card
      elevation="md"
      style={{
        gap: t.spacing.md,
        borderColor: urgent ? t.colors.danger : t.colors.brand,
        borderWidth: 1.6,
      }}
    >
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" tone="brand">
            Yeni teslimat teklifi
          </Text>
          <Text variant="title">{formatPrice(offer.fee)}</Text>
        </View>

        <View
          style={[
            styles.timer,
            {
              backgroundColor: urgent ? t.colors.dangerSoft : t.colors.surface2,
              borderRadius: t.radius.pill,
            },
          ]}
        >
          <Clock size={14} color={urgent ? t.colors.danger : t.colors.muted} />
          <Text
            variant="body"
            weight="bold"
            tabular
            style={{ color: urgent ? t.colors.danger : t.colors.ink }}
          >
            {remaining}
          </Text>
        </View>
      </View>

      {/* Kalan süre çubuğu */}
      <View
        style={[
          styles.track,
          { backgroundColor: t.colors.surface2, borderRadius: 999 },
        ]}
      >
        <View
          style={{
            width: `${ratio * 100}%`,
            height: "100%",
            borderRadius: 999,
            backgroundColor: urgent ? t.colors.danger : t.colors.brand,
          }}
        />
      </View>

      <MapView
        height={150}
        markers={[
          { point: order.restaurantLocation, icon: "Store", color: t.colors.deep },
          { point: order.address.point, icon: "House", color: t.colors.pistachio },
        ]}
      />

      <View style={{ gap: t.spacing.sm }}>
        <Leg
          icon={<Navigation size={15} color={t.colors.muted} />}
          title={order.restaurantName}
          subtitle={`Alım · ${formatDistance(offer.pickupKm)} uzakta`}
        />
        <Leg
          icon={<MapPin size={15} color={t.colors.muted} />}
          title={`${order.address.title} · ${order.address.district}`}
          subtitle={`Teslim · ${formatDistance(offer.dropoffKm)} kuş uçuşu`}
        />
      </View>

      <View style={styles.actions}>
        <Button
          label="Reddet"
          variant="secondary"
          onPress={onReject}
          disabled={busy}
          style={{ flex: 1 }}
        />
        <Button
          label="Siparişi al"
          onPress={onAccept}
          loading={busy}
          style={{ flex: 2 }}
          size="lg"
        />
      </View>
    </Card>
  );
}

function Leg({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.leg}>
      {icon}
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="body" weight="semibold" tone="ink" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption">{subtitle}</Text>
      </View>
    </View>
  );
}

function secondsLeft(expiresAt: string): number {
  return Math.max(
    0,
    Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  timer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 66,
    justifyContent: "center",
  },
  track: { height: 6, overflow: "hidden" },
  leg: { flexDirection: "row", alignItems: "center", gap: 9 },
  actions: { flexDirection: "row", gap: 8 },
});
