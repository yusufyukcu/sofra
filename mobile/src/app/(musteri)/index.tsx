import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ChevronDown, MapPin, SlidersHorizontal } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  CATEGORIES,
  FILTER_PARAM_KEYS,
  SORT_OPTIONS,
  type Banner,
  type LatLng,
  type RestaurantListItem,
  type SortKey,
} from "@sofra/core";
import { CartBar } from "@/components/customer/cart-bar";
import { RestaurantCard } from "@/components/customer/restaurant-card";
import { Header, Screen } from "@/components/ui/screen";
import { Badge, Card, EmptyState, Skeleton } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { api, errorMessage, isOffline } from "@/lib/api";
import { deliveryLabel, deliveryPoint, useSession } from "@/store/session";
import { useTheme } from "@/theme";

/**
 * Keşfet.
 *
 * Konum → kampanya vitrini → kategori şeridi → sıralama → restoran listesi.
 * Filtreleme ve sıralama sunucuda `@sofra/core/discovery` ile yapılır; mobil
 * yalnızca parametreleri gönderir, kural kopyalanmaz.
 *
 * Listenin ilki geniş kartla açılır — "en iyi eşleşme" bilgisi yapıyla
 * anlatılır.
 */

interface DiscoveryResponse {
  restaurants: RestaurantListItem[];
  total: number;
  banners: Banner[];
  categories: { id: string; count: number }[];
  point: LatLng;
}

export default function DiscoverScreen() {
  const t = useTheme();
  const label = useSession(deliveryLabel);
  const point = useSession(deliveryPoint);
  const status = useSession((s) => s.status);

  const [data, setData] = useState<DiscoveryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("recommended");

  const query = useMemo(() => {
    // Parametre adları `@sofra/core` içinden geliyor; web ile aynı sözleşme.
    const params = new URLSearchParams({
      lat: String(point.lat),
      lng: String(point.lng),
      [FILTER_PARAM_KEYS.sort]: sort,
    });
    if (category) params.set(FILTER_PARAM_KEYS.category, category);
    return params.toString();
  }, [point.lat, point.lng, sort, category]);

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setData(await api.get<DiscoveryResponse>(`/restaurants?${query}`));
      } catch (err) {
        setError(
          isOffline(err)
            ? "Sunucuya ulaşılamadı. Bağlantını kontrol et."
            : errorMessage(err)
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [query]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const list = data?.restaurants ?? [];
  const counts = useMemo(
    () => new Map((data?.categories ?? []).map((c) => [c.id, c.count])),
    [data]
  );

  return (
    <Screen>
      <Header title="Sofra" large subtitle={`${data?.total ?? 0} restoran`}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Teslimat konumunu değiştir"
          onPress={() =>
            router.push(status === "authenticated" ? "/hesabim" : "/giris")
          }
          style={({ pressed }) => [
            styles.location,
            {
              backgroundColor: t.colors.deep2,
              borderRadius: t.radius.md,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <MapPin size={16} color={t.colors.onDeepMuted} />
          <Text
            variant="small"
            weight="semibold"
            numberOfLines={1}
            style={{ color: t.colors.onDeep, flex: 1 }}
          >
            {label}
          </Text>
          <ChevronDown size={16} color={t.colors.onDeepMuted} />
        </Pressable>
      </Header>

      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: t.spacing.lg,
          paddingBottom: 110,
          gap: t.spacing.md,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load("refresh")}
            tintColor={t.colors.brand}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: t.spacing.lg, marginBottom: t.spacing.xs }}>
            {/* Kampanya vitrini */}
            {data?.banners.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: t.spacing.sm }}
                style={{ marginHorizontal: -t.spacing.lg }}
                contentInset={{ left: t.spacing.lg, right: t.spacing.lg }}
              >
                <View style={{ width: t.spacing.lg }} />
                {data.banners.map((banner) => (
                  <BannerCard key={banner.id} banner={banner} />
                ))}
                <View style={{ width: t.spacing.lg }} />
              </ScrollView>
            ) : null}

            {/* Kategoriler */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: t.spacing.sm }}
              style={{ marginHorizontal: -t.spacing.lg }}
            >
              <View style={{ width: t.spacing.lg }} />
              {/* "Tümü" listenin kendi ilk maddesi; ayrıca eklenmiyor. */}
              {CATEGORIES.map((c) => {
                const isAll = c.id === "all";
                const active = isAll ? category === null : category === c.id;
                return (
                  <Chip
                    key={c.id}
                    label={`${c.emoji} ${c.name}`}
                    count={isAll ? undefined : counts.get(c.id)}
                    active={active}
                    onPress={() =>
                      setCategory(isAll || active ? null : c.id)
                    }
                  />
                );
              })}
              <View style={{ width: t.spacing.lg }} />
            </ScrollView>

            {/* Sıralama */}
            <View style={styles.sortRow}>
              <SlidersHorizontal size={15} color={t.colors.muted} />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6 }}
              >
                {SORT_OPTIONS.map((option) => (
                  <Chip
                    key={option.id}
                    label={option.label}
                    small
                    active={sort === option.id}
                    onPress={() => setSort(option.id)}
                  />
                ))}
              </ScrollView>
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <RestaurantCard restaurant={item} featured={index === 0} />
        )}
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: t.spacing.md }}>
              <Skeleton height={230} radius={t.radius.lg} />
              <Skeleton height={98} radius={t.radius.lg} />
              <Skeleton height={98} radius={t.radius.lg} />
            </View>
          ) : error ? (
            <EmptyState
              emoji="📡"
              title="Liste yüklenemedi"
              description={error}
            />
          ) : (
            <EmptyState
              emoji="🍽️"
              title="Bu filtrelerle restoran yok"
              description="Kategoriyi kaldırmayı ya da başka bir sıralama seçmeyi dene."
            />
          )
        }
      />

      <CartBar bottomOffset={0} />
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function Chip({
  label,
  count,
  active,
  onPress,
  small,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
  small?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? t.colors.deep : t.colors.surface,
          borderColor: active ? t.colors.deep : t.colors.border,
          borderRadius: t.radius.pill,
          paddingVertical: small ? 6 : 9,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        variant="small"
        weight="semibold"
        style={{ color: active ? t.colors.onDeep : t.colors.text }}
      >
        {label}
      </Text>
      {count !== undefined ? (
        <Text
          variant="caption"
          tabular
          style={{ color: active ? t.colors.onDeepMuted : t.colors.muted }}
        >
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

function BannerCard({ banner }: { banner: Banner }) {
  const t = useTheme();
  return (
    <Card
      padded={false}
      elevation="sm"
      style={{ width: 268, overflow: "hidden" }}
    >
      {/* Afişin kendi degradesi — web vitriniyle aynı iki durak */}
      <LinearGradient
        colors={banner.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bannerArt}
      >
        <Text style={styles.bannerEmoji}>{banner.emoji}</Text>
      </LinearGradient>

      <View style={{ padding: t.spacing.md, gap: 3 }}>
        <Text variant="body" weight="semibold" tone="ink" numberOfLines={1}>
          {banner.title}
        </Text>
        <Text variant="caption" numberOfLines={2}>
          {banner.subtitle}
        </Text>
        {banner.code ? (
          <Badge
            label={banner.code}
            tone="brand"
            style={{ alignSelf: "flex-start", marginTop: 4 }}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  location: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  sortRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bannerArt: {
    height: 92,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerEmoji: { fontSize: 38, lineHeight: 46 },
});
