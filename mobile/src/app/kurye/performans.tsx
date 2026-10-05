import { useFocusEffect } from "expo-router";
import { Check, Clock, Star, WifiOff, X, Zap } from "lucide-react-native";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Header, SectionTitle, Screen } from "@/components/ui/screen";
import { Card, Divider, EmptyState, Row, Skeleton } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { courierApi, errorMessage } from "@/lib/api";
import { useTheme } from "@/theme";

/**
 * Performans.
 *
 * Puan, kabul oranı, ortalama teslim süresi ve teklif dağılımı. Rakamlar
 * sunucuda `courier.performanceReport` ile hesaplanır — panel ve uygulama
 * aynı sayıyı görür.
 *
 * Kabul oranı çubuğu üç renk taşır: kabul (fıstık), ret (marka), süresi
 * dolan (safran). Renk burada dekorasyon değil, üç farklı davranışı ayırt
 * etmenin yolu.
 */

interface Report {
  rating: number;
  ratingCount: number;
  totalDeliveries: number;
  avgDeliveryMinutes: number;
  fastestMinutes: number | null;
  acceptanceRate: number;
  offers: { accepted: number; rejected: number; expired: number };
  avgDistanceKm: number;
  weekDeliveries: number;
}

export default function PerformanceScreen() {
  const t = useTheme();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await courierApi.get<{ report: Report }>(
        "/courier/performance"
      );
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

  const offers = report?.offers;
  const totalOffers = offers
    ? offers.accepted + offers.rejected + offers.expired
    : 0;

  return (
    <Screen>
      <Header title="Performans" large />

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
              <Skeleton height={110} radius={t.radius.lg} />
              <Skeleton height={140} radius={t.radius.lg} />
            </View>
          )
        ) : (
          <>
            {/* Puan */}
            <Card style={{ gap: t.spacing.sm, alignItems: "center" }}>
              <Text variant="label">Müşteri puanı</Text>
              <View style={styles.ratingRow}>
                <Star size={28} color={t.colors.saffron} fill={t.colors.saffron} />
                <Text variant="hero" tabular>
                  {report.rating.toFixed(1)}
                </Text>
              </View>
              <Text variant="caption">
                {report.ratingCount} değerlendirme · {report.totalDeliveries} teslimat
              </Text>
            </Card>

            {/* Kartlar */}
            <View style={styles.grid}>
              <Metric
                icon={<Check size={16} color={t.colors.pistachio} />}
                label="Kabul oranı"
                value={`%${Math.round(report.acceptanceRate)}`}
              />
              <Metric
                icon={<Clock size={16} color={t.colors.info} />}
                label="Ort. teslim"
                value={
                  report.avgDeliveryMinutes > 0
                    ? `${report.avgDeliveryMinutes} dk`
                    : "—"
                }
              />
              <Metric
                icon={<Zap size={16} color={t.colors.saffron} />}
                label="En hızlı"
                value={
                  report.fastestMinutes !== null
                    ? `${report.fastestMinutes} dk`
                    : "—"
                }
              />
              <Metric
                icon={<Star size={16} color={t.colors.brand} />}
                label="Bu hafta"
                value={`${report.weekDeliveries} teslimat`}
              />
            </View>

            {/* Teklif dağılımı */}
            <View>
              <SectionTitle title="Teklif dağılımı" />
              <Card style={{ gap: t.spacing.md }}>
                {totalOffers === 0 ? (
                  <Text variant="small">
                    Henüz teklif almadın. Mesaiyi açtığında buraya dağılım
                    düşecek.
                  </Text>
                ) : (
                  <>
                    <View style={[styles.stack, { borderRadius: 999 }]}>
                      <Segment
                        flex={offers!.accepted}
                        color={t.colors.pistachio}
                      />
                      <Segment flex={offers!.rejected} color={t.colors.brand} />
                      <Segment flex={offers!.expired} color={t.colors.saffron} />
                    </View>

                    <View style={{ gap: 2 }}>
                      <Legend
                        color={t.colors.pistachio}
                        label="Kabul edilen"
                        value={offers!.accepted}
                      />
                      <Legend
                        color={t.colors.brand}
                        label="Reddedilen"
                        value={offers!.rejected}
                      />
                      <Legend
                        color={t.colors.saffron}
                        label="Süresi dolan"
                        value={offers!.expired}
                      />
                    </View>

                    <Divider />
                    <Row
                      label="Ortalama mesafe"
                      value={
                        report.avgDistanceKm > 0
                          ? `${report.avgDistanceKm.toFixed(1)} km`
                          : "—"
                      }
                    />
                  </>
                )}
              </Card>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card style={styles.metric}>
      <View style={styles.metricHead}>
        {icon}
        <Text variant="caption">{label}</Text>
      </View>
      <Text variant="title" tabular>
        {value}
      </Text>
    </Card>
  );
}

function Segment({ flex, color }: { flex: number; color: string }) {
  if (flex <= 0) return null;
  // 2px'lik yüzey boşluğu bitişik dilimleri ayırır.
  return <View style={{ flex, backgroundColor: color, marginRight: 2 }} />;
}

function Legend({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.legend}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text variant="small" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="small" weight="semibold" tone="ink" tabular>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { flexGrow: 1, flexBasis: "45%", gap: 6 },
  metricHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  stack: { flexDirection: "row", height: 12, overflow: "hidden" },
  legend: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
});
