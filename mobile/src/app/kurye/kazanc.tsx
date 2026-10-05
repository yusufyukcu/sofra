import { WifiOff } from "lucide-react-native";
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { formatDateTime, formatPrice } from "@sofra/core";
import { Header, SectionTitle, Screen } from "@/components/ui/screen";
import { Badge, Card, Divider, EmptyState, Row, Skeleton } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { courierApi, errorMessage } from "@/lib/api";
import { useTheme } from "@/theme";

/**
 * Kazanç.
 *
 * Günlük kırılım, son teslimatlar ve hakediş defteri. Hakediş durumu
 * yönetici panelinden değişir (bekliyor → onaylandı → ödendi) ve buraya
 * aynı anda yansır; iki taraf da aynı defteri okuyor.
 *
 * Çubuk grafiği `react-native-svg` yerine basit `View` yükseklikleriyle
 * çizildi — yedi çubuk için SVG'ye gerek yok.
 */

interface Bucket {
  key: string;
  label: string;
  deliveries: number;
  fee: number;
  tip: number;
  total: number;
}

interface Earning {
  orderId: string;
  orderCode: string;
  restaurantName: string;
  fee: number;
  tip: number;
  distanceKm: number;
  at: string;
}

interface Payout {
  id: string;
  weekLabel: string;
  amount: number;
  status: "pending" | "approved" | "paid";
  paidAt?: string;
}

interface Report {
  totals: { deliveries: number; fee: number; tip: number; total: number };
  buckets: Bucket[];
  recent: Earning[];
  payouts: Payout[];
}

const PAYOUT_STATUS: Record<
  Payout["status"],
  { label: string; tone: "pistachio" | "info" | "saffron" }
> = {
  paid: { label: "Ödendi", tone: "pistachio" },
  approved: { label: "Onaylandı", tone: "info" },
  pending: { label: "Bekliyor", tone: "saffron" },
};

export default function EarningsScreen() {
  const t = useTheme();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await courierApi.get<{ report: Report }>("/courier/earnings");
      setReport(data.report);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const peak = Math.max(1, ...(report?.buckets.map((b) => b.total) ?? [1]));

  return (
    <Screen>
      <Header title="Kazanç" large subtitle="Son 7 gün" />

      <ScrollView
        contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.xl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={t.colors.brand}
          />
        }
      >
        {!report ? (
          error ? (
            <EmptyState icon={WifiOff} title="Yüklenemedi" description={error} />
          ) : (
            <View style={{ gap: t.spacing.md }}>
              <Skeleton height={120} radius={t.radius.lg} />
              <Skeleton height={160} radius={t.radius.lg} />
            </View>
          )
        ) : (
          <>
            {/* Toplam */}
            <Card style={{ gap: t.spacing.sm }}>
              <Text variant="label">Bu hafta</Text>
              <Text variant="hero" tabular>
                {formatPrice(report.totals.total)}
              </Text>
              <Divider style={{ marginVertical: 4 }} />
              <Row
                label="Paket ücreti"
                value={formatPrice(report.totals.fee)}
                note={`${report.totals.deliveries} teslimat`}
              />
              <Row
                label="Bahşiş"
                value={formatPrice(report.totals.tip)}
                tone="pistachio"
              />
            </Card>

            {/* Günlük kırılım */}
            <View>
              <SectionTitle title="Günlük" />
              <Card>
                <View style={styles.chart}>
                  {report.buckets.map((bucket) => {
                    const ratio = bucket.total / peak;
                    return (
                      <View key={bucket.key} style={styles.bar}>
                        <Text variant="caption" tabular style={styles.barValue}>
                          {bucket.total > 0 ? Math.round(bucket.total) : ""}
                        </Text>
                        <View
                          style={[
                            styles.barTrack,
                            { backgroundColor: t.colors.surface2 },
                          ]}
                        >
                          <View
                            style={{
                              height: `${Math.max(2, ratio * 100)}%`,
                              backgroundColor:
                                bucket.total > 0
                                  ? t.colors.brand
                                  : t.colors.surface3,
                              borderTopLeftRadius: 4,
                              borderTopRightRadius: 4,
                            }}
                          />
                        </View>
                        <Text variant="caption" numberOfLines={1}>
                          {bucket.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Card>
            </View>

            {/* Son teslimatlar */}
            <View>
              <SectionTitle title="Son teslimatlar" />
              <Card style={{ gap: t.spacing.sm }}>
                {report.recent.length === 0 ? (
                  <Text variant="small">
                    Henüz teslimat yok. Mesaiyi açıp ilk siparişini al.
                  </Text>
                ) : (
                  report.recent.map((earning, index) => (
                    <View key={earning.orderId} style={{ gap: t.spacing.sm }}>
                      {index > 0 ? <Divider /> : null}
                      <View style={styles.earning}>
                        <View style={{ flex: 1, gap: 1 }}>
                          <Text variant="body" weight="semibold" tone="ink" numberOfLines={1}>
                            {earning.restaurantName}
                          </Text>
                          <Text variant="caption" tabular>
                            {formatDateTime(earning.at)} · {earning.distanceKm.toFixed(1)} km
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text variant="body" weight="semibold" tone="ink" tabular>
                            {formatPrice(earning.fee + earning.tip)}
                          </Text>
                          {earning.tip > 0 ? (
                            <Text variant="caption" tone="pistachio" tabular>
                              +{formatPrice(earning.tip)} bahşiş
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </Card>
            </View>

            {/* Hakediş */}
            <View>
              <SectionTitle title="Hakedişler" />
              <Card style={{ gap: t.spacing.sm }}>
                {report.payouts.length === 0 ? (
                  <Text variant="small">
                    Teslimat yaptıkça haftalık hakedişler burada listelenir.
                  </Text>
                ) : (
                  report.payouts.map((payout, index) => {
                    const meta = PAYOUT_STATUS[payout.status];
                    return (
                      <View key={payout.id} style={{ gap: t.spacing.sm }}>
                        {index > 0 ? <Divider /> : null}
                        <View style={styles.earning}>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text variant="body" weight="semibold" tone="ink">
                              {payout.weekLabel}
                            </Text>
                            <Badge label={meta.label} tone={meta.tone} />
                          </View>
                          <Text variant="body" weight="semibold" tone="ink" tabular>
                            {formatPrice(payout.amount)}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </Card>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chart: { flexDirection: "row", gap: 6, height: 150, alignItems: "flex-end" },
  bar: { flex: 1, alignItems: "center", gap: 4, height: "100%" },
  barValue: { fontSize: 10, lineHeight: 13 },
  barTrack: {
    flex: 1,
    width: "100%",
    borderRadius: 4,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  earning: { flexDirection: "row", alignItems: "center", gap: 10 },
});
