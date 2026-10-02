import { router, useLocalSearchParams } from "expo-router";
import { MessageCircle, Phone, Star, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  CANCELLABLE_STATUSES,
  CANCEL_REASONS,
  ORDER_FLOW,
  ORDER_STATUS_META,
  formatPrice,
  formatTime,
  type CourierStage,
  type Order,
} from "@sofra/core";
import { MapView } from "@/components/map/map-view";
import { Button } from "@/components/ui/button";
import { Header, Screen } from "@/components/ui/screen";
import { Badge, Card, Divider, Row, Skeleton } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { api, errorMessage } from "@/lib/api";
import { useLive } from "@/lib/use-live";
import { useSession } from "@/store/session";
import { useTheme } from "@/theme";

/**
 * Sipariş takibi.
 *
 * Durum çizgisi, canlı harita, kurye bilgisi ve sipariş özeti. Veriler
 * `useLive` ile saniyede bir tazelenir; web SSE kullanıyor, mobil aynı
 * gövdeyi GET ile yokluyor (bkz. `use-live.ts`).
 *
 * Kurye teslimatı üstlendiğinde ilerleme artık zamanlayıcıdan değil kuryenin
 * bildirdiği aşamadan geliyor — `courierStage` doluysa aşama etiketi
 * durumun yanında gösterilir.
 */

const COURIER_STAGE_LABEL: Partial<Record<CourierStage, string>> = {
  assigned: "Restorana gidiyor",
  at_restaurant: "Restoranda",
  picked_up: "Sana geliyor",
};

interface TrackingPayload {
  order: Order;
  progress: number;
  remainingMinutes: number;
}

export default function OrderScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const refresh = useSession((s) => s.refresh);

  const [finished, setFinished] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const { data, error, loading } = useLive<TrackingPayload>(
    api,
    `/orders/${id}`,
    { intervalMs: 2000, enabled: !finished }
  );

  const order = data?.order ?? null;
  const terminal =
    order?.status === "delivered" || order?.status === "cancelled";

  // Sipariş bittiyse yoklamayı durdur ve oturumu tazele (cüzdan, aktif liste).
  useEffect(() => {
    if (terminal && !finished) {
      setFinished(true);
      void refresh();
    }
  }, [terminal, finished, refresh]);

  if (loading && !order) {
    return (
      <Screen>
        <Header title="Sipariş" back />
        <View style={{ padding: t.spacing.lg, gap: t.spacing.md }}>
          <Skeleton height={110} radius={t.radius.lg} />
          <Skeleton height={200} radius={t.radius.lg} />
          <Skeleton height={140} radius={t.radius.lg} />
        </View>
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen>
        <Header title="Sipariş" back />
        <Card style={{ margin: t.spacing.lg }}>
          <Text variant="body" tone="danger">
            {error ?? "Sipariş bulunamadı."}
          </Text>
        </Card>
      </Screen>
    );
  }

  const meta = ORDER_STATUS_META[order.status];
  const cancellable = CANCELLABLE_STATUSES.includes(order.status);
  const stage = order.courierStage
    ? COURIER_STAGE_LABEL[order.courierStage]
    : null;

  function confirmCancel() {
    Alert.alert(
      "Siparişi iptal et",
      "Bu işlem geri alınamaz. Online ödemeler cüzdanına iade edilir.",
      [
        { text: "Vazgeç", style: "cancel" },
        ...CANCEL_REASONS.slice(0, 3).map((reason) => ({
          text: reason,
          onPress: () => void cancelOrder(reason),
        })),
      ]
    );
  }

  async function cancelOrder(reason: string) {
    setCancelling(true);
    try {
      await api.post(`/orders/${id}/cancel`, { reason });
      await refresh();
    } catch (err) {
      Alert.alert("İptal edilemedi", errorMessage(err));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Screen edges="both">
      <Header
        title={meta.label}
        subtitle={`${order.restaurantName} · ${order.code}`}
        back
      />

      <ScrollView
        contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md }}
      >
        {/* Durum */}
        <Card style={{ gap: t.spacing.md }}>
          <View style={styles.statusHead}>
            <Text style={styles.statusEmoji}>{meta.emoji}</Text>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={styles.statusRow}>
                <Text variant="title">{meta.label}</Text>
                {stage ? <Badge label={stage} tone="info" /> : null}
              </View>
              <Text variant="small">{meta.description}</Text>
            </View>
          </View>

          {!terminal ? (
            <>
              <Progress value={data?.progress ?? 0} />
              <View style={styles.etaRow}>
                <Text variant="caption">Tahmini teslimat</Text>
                <Text variant="body" weight="semibold" tone="ink" tabular>
                  {order.etaAt
                    ? formatTime(order.etaAt)
                    : "—"}
                  {data && data.remainingMinutes > 0
                    ? `  ·  ${data.remainingMinutes} dk`
                    : ""}
                </Text>
              </View>
            </>
          ) : null}

          {order.status === "cancelled" ? (
            <View
              style={[
                styles.notice,
                {
                  backgroundColor: t.colors.dangerSoft,
                  borderRadius: t.radius.md,
                },
              ]}
            >
              <Text variant="small" weight="semibold" tone="danger">
                {order.cancelledBy === "support"
                  ? "Platform iptali"
                  : order.cancelledBy === "vendor"
                    ? "Restoran iptal etti"
                    : "İptal ettin"}
              </Text>
              {order.cancelReason ? (
                <Text variant="caption">{order.cancelReason}</Text>
              ) : null}
            </View>
          ) : null}
        </Card>

        {/* Akış çizgisi */}
        {order.status !== "cancelled" ? (
          <Card>
            <Timeline order={order} />
          </Card>
        ) : null}

        {/* Harita */}
        {!terminal ? (
          <Card padded={false} style={{ overflow: "hidden" }}>
            <MapView
              height={210}
              rounded={0}
              route={{
                from: order.restaurantLocation,
                to: order.address.point,
              }}
              markers={[
                {
                  point: order.restaurantLocation,
                  emoji: "🏪",
                  color: t.colors.deep,
                },
                ...(order.courierPoint
                  ? [
                      {
                        point: order.courierPoint,
                        emoji: "🛵",
                        color: t.colors.brand,
                        size: 38,
                      },
                    ]
                  : []),
                {
                  point: order.address.point,
                  emoji: "🏠",
                  color: t.colors.pistachio,
                },
              ]}
            />
          </Card>
        ) : null}

        {/* Kurye */}
        {order.courier ? (
          <Card style={{ gap: t.spacing.sm }}>
            <View style={styles.courier}>
              <Text style={styles.courierAvatar}>{order.courier.emoji}</Text>
              <View style={{ flex: 1, gap: 1 }}>
                <Text variant="body" weight="semibold" tone="ink">
                  {order.courier.name}
                </Text>
                <View style={styles.courierMeta}>
                  <Star size={12} color={t.colors.saffron} fill={t.colors.saffron} />
                  <Text variant="caption" tabular>
                    {order.courier.rating.toFixed(1)}
                  </Text>
                  <Text variant="caption">· {order.courier.vehicle}</Text>
                  <Text variant="caption">· {order.courier.maskedPhone}</Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Kuryeyi ara"
                style={({ pressed }) => [
                  styles.circleBtn,
                  {
                    backgroundColor: t.colors.pistachioSoft,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                onPress={() =>
                  Alert.alert(
                    "Prototip",
                    "Gerçek sistemde kurye maskeli numarayla aranır."
                  )
                }
              >
                <Phone size={17} color={t.colors.pistachio} />
              </Pressable>
            </View>
          </Card>
        ) : null}

        {/* Sipariş özeti */}
        <Card style={{ gap: t.spacing.sm }}>
          <Text variant="title">Sipariş özeti</Text>
          {order.lines.map((line) => (
            <View key={line.lineId} style={styles.summaryLine}>
              <Text variant="body" tabular tone="muted" style={{ width: 26 }}>
                {line.quantity}×
              </Text>
              <View style={{ flex: 1, gap: 1 }}>
                <Text variant="body" tone="ink">
                  {line.name}
                </Text>
                {line.selections.map((s) => (
                  <Text key={s.groupId} variant="caption">
                    {s.optionNames.join(", ")}
                  </Text>
                ))}
              </View>
              <Text variant="body" weight="semibold" tone="ink" tabular>
                {formatPrice(line.unitPrice * line.quantity)}
              </Text>
            </View>
          ))}

          <Divider style={{ marginVertical: 4 }} />
          <Row label="Ara toplam" value={formatPrice(order.totals.subtotal)} />
          <Row
            label="Teslimat"
            value={
              order.totals.deliveryFee === 0
                ? "Ücretsiz"
                : formatPrice(order.totals.deliveryFee)
            }
          />
          <Row label="Hizmet bedeli" value={formatPrice(order.totals.serviceFee)} />
          {order.totals.discount > 0 ? (
            <Row
              label="İndirim"
              value={`−${formatPrice(order.totals.discount)}`}
              tone="pistachio"
            />
          ) : null}
          <Divider style={{ marginVertical: 4 }} />
          <Row
            label="Toplam"
            value={formatPrice(order.totals.grandTotal)}
            strong
          />
        </Card>

        {/* Eylemler */}
        <View style={{ gap: t.spacing.sm }}>
          {order.status === "delivered" && !order.rating ? (
            <Button
              label="Siparişi değerlendir"
              icon={<Star size={17} color={t.colors.brandContrast} />}
              onPress={() => router.push(`/siparis/${order.id}/degerlendir`)}
              size="lg"
              fullWidth
            />
          ) : null}

          {cancellable ? (
            <Button
              label="Siparişi iptal et"
              variant="danger"
              icon={<X size={17} color={t.colors.danger} />}
              onPress={confirmCancel}
              loading={cancelling}
              fullWidth
            />
          ) : null}

          <Button
            label="Destek"
            variant="secondary"
            icon={<MessageCircle size={17} color={t.colors.ink} />}
            onPress={() =>
              Alert.alert(
                "Destek",
                "Canlı destek sohbeti web uygulamasında açık. Mobilde sıradaki sürümde."
              )
            }
            fullWidth
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

/** `value` sunucudan 0–1 aralığında gelir (yüzde değil). */
function Progress({ value }: { value: number }) {
  const t = useTheme();
  const percent = Math.round(value * 100);
  return (
    <View
      style={[
        styles.track,
        { backgroundColor: t.colors.surface2, borderRadius: t.radius.pill },
      ]}
    >
      <View
        style={{
          width: `${Math.max(3, Math.min(100, percent))}%`,
          height: "100%",
          backgroundColor: t.colors.brand,
          borderRadius: 999,
        }}
      />
    </View>
  );
}

function Timeline({ order }: { order: Order }) {
  const t = useTheme();
  const currentIndex = ORDER_FLOW.indexOf(order.status);

  const timeOf: Record<string, string | undefined> = {
    pending_approval: order.createdAt,
    preparing: order.approvedAt,
    on_the_way: order.pickedUpAt,
    delivered: order.deliveredAt,
  };

  return (
    <View style={{ gap: 0 }}>
      {ORDER_FLOW.map((status, index) => {
        const meta = ORDER_STATUS_META[status];
        const done = index < currentIndex;
        const active = index === currentIndex;
        const at = timeOf[status];

        return (
          <View key={status} style={styles.step}>
            <View style={styles.stepRail}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      done || active ? t.colors.brand : t.colors.surface3,
                    borderColor: active ? t.colors.brandSoft : "transparent",
                    borderWidth: active ? 4 : 0,
                  },
                ]}
              />
              {index < ORDER_FLOW.length - 1 ? (
                <View
                  style={[
                    styles.rail,
                    {
                      backgroundColor: done ? t.colors.brand : t.colors.surface3,
                    },
                  ]}
                />
              ) : null}
            </View>

            <View style={styles.stepBody}>
              <Text
                variant="body"
                weight={active ? "semibold" : "regular"}
                tone={done || active ? "ink" : "muted"}
              >
                {meta.label}
              </Text>
              {at ? (
                <Text variant="caption" tabular>
                  {formatTime(at)}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  statusHead: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  statusEmoji: { fontSize: 34, lineHeight: 40 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  track: { height: 8, overflow: "hidden" },
  notice: { padding: 10, gap: 2 },
  step: { flexDirection: "row", gap: 12 },
  stepRail: { alignItems: "center", width: 20 },
  dot: { width: 14, height: 14, borderRadius: 7, marginTop: 4 },
  rail: { width: 2, flex: 1, minHeight: 22, marginVertical: 2 },
  stepBody: { flex: 1, paddingBottom: 14, gap: 1 },
  courier: { flexDirection: "row", alignItems: "center", gap: 12 },
  courierAvatar: { fontSize: 32, lineHeight: 38 },
  courierMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryLine: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
});
