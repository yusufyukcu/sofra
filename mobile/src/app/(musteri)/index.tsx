import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  ChevronDown,
  Filter,
  MapPin,
  SlidersHorizontal,
  Sparkles,
  UtensilsCrossed,
  WifiOff,
} from "lucide-react-native";
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
  cuisineIcon,
  FILTER_PARAM_KEYS,
  SORT_OPTIONS,
  type Banner,
  type LatLng,
  type RestaurantListItem,
  type SortKey,
} from "@sofra/core";
import { CartBar } from "@/components/customer/cart-bar";
import { PartnerBanner } from "@/components/customer/partner-banner";
import { RestaurantCard } from "@/components/customer/restaurant-card";
import { FoodPhoto, photoUrl } from "@/components/ui/food-photo";
import { Icon } from "@/components/ui/icon";
import { Header, Screen } from "@/components/ui/screen";
import { EmptyState, Skeleton } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { api, errorMessage, isOffline } from "@/lib/api";
import { deliveryLabel, deliveryPoint, useSession } from "@/store/session";
import { useTheme } from "@/theme";

/**
 * Keşfet.
 *
 * Konum → kampanya vitrini → öne çıkanlar → kategori şeridi → sıralama ve
 * hızlı filtreler → restoran listesi.
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
  /** Yönetimin öne çıkardıkları (sıralı) */
  featured?: RestaurantListItem[];
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
  const [quick, setQuick] = useState({ openOnly: false, freeDeliveryOnly: false, topRated: false, fast: false });

  const query = useMemo(() => {
    // Parametre adları `@sofra/core` içinden geliyor; web ile aynı sözleşme.
    const params = new URLSearchParams({
      lat: String(point.lat),
      lng: String(point.lng),
      [FILTER_PARAM_KEYS.sort]: sort,
    });
    if (category) params.set(FILTER_PARAM_KEYS.category, category);
    if (quick.openOnly) params.set(FILTER_PARAM_KEYS.openOnly, "1");
    if (quick.freeDeliveryOnly) params.set(FILTER_PARAM_KEYS.freeDeliveryOnly, "1");
    if (quick.topRated) params.set(FILTER_PARAM_KEYS.minRating, "4.5");
    if (quick.fast) params.set(FILTER_PARAM_KEYS.maxEta, "30");
    return params.toString();
  }, [point.lat, point.lng, sort, category, quick]);

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
  const featured = (data?.featured ?? []).filter((r) => r.deliverable);
  const counts = useMemo(
    () => new Map((data?.categories ?? []).map((c) => [c.id, c.count])),
    [data]
  );

  return (
    <Screen>
      <Header
        title="Sofra"
        logo
        subtitle={data ? `${counts.get("all") ?? data.restaurants.length} restoran adresine teslim ediyor` : " "}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Teslimat konumunu değiştir"
          onPress={() =>
            router.push(status === "authenticated" ? "/hesabim" : "/giris")
          }
          style={({ pressed }) => [
            styles.location,
            {
              backgroundColor: t.colors.surface2,
              borderRadius: t.radius.pill,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <View style={[styles.locationIcon, { backgroundColor: t.colors.brandSoft }]}>
            <MapPin size={15} color={t.colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="caption" tone="muted">
              Teslimat adresi
            </Text>
            <Text variant="small" weight="semibold" tone="ink" numberOfLines={1}>
              {label}
            </Text>
          </View>
          <ChevronDown size={16} color={t.colors.muted} />
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
                  <BannerCard
                    key={banner.id}
                    banner={banner}
                    onPress={() => {
                      const params = new URLSearchParams(banner.href.split("?")[1] ?? "");
                      const target = params.get(FILTER_PARAM_KEYS.category);
                      if (target && target !== "all") setCategory(target);
                    }}
                  />
                ))}
                <View style={{ width: t.spacing.lg }} />
              </ScrollView>
            ) : null}

            {/* Restoran başvurusu — kalıcı afiş */}
            <PartnerBanner />

            {/* Öne çıkanlar — yalnızca kategori seçilmemişken */}
            {category === null && featured.length ? (
              <View style={{ gap: t.spacing.sm }}>
                <View style={styles.sortRow}>
                  <Sparkles size={16} color={t.colors.saffron} />
                  <Text variant="title">Öne çıkanlar</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: t.spacing.md }}
                  style={{ marginHorizontal: -t.spacing.lg }}
                >
                  <View style={{ width: t.spacing.lg - t.spacing.md }} />
                  {featured.map((item) => (
                    <View key={item.id} style={{ width: 280 }}>
                      <RestaurantCard restaurant={item} />
                    </View>
                  ))}
                  <View style={{ width: t.spacing.lg - t.spacing.md }} />
                </ScrollView>
              </View>
            ) : null}

            {/* Mutfaklar — fotoğraflı raf */}
            <View style={{ gap: t.spacing.sm }}>
              <Text variant="title">Mutfaklar</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: t.spacing.md }}
                style={{ marginHorizontal: -t.spacing.lg }}
              >
                <View style={{ width: t.spacing.lg - t.spacing.md }} />
                {/* "Tümü" listenin kendi ilk maddesi; ayrıca eklenmiyor. */}
                {CATEGORIES.map((c) => {
                  const isAll = c.id === "all";
                  const active = isAll ? category === null : category === c.id;
                  const count = isAll ? undefined : counts.get(c.id);
                  if (!isAll && c.id !== "top-rated" && !count && !active) return null;
                  return (
                    <CategoryTile
                      key={c.id}
                      id={c.id}
                      name={c.name}
                      image={c.image}
                      active={active}
                      onPress={() => setCategory(isAll || active ? null : c.id)}
                    />
                  );
                })}
                <View style={{ width: t.spacing.lg - t.spacing.md }} />
              </ScrollView>
            </View>

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

            {/* Hızlı filtreler */}
            <View style={styles.sortRow}>
              <Filter size={15} color={t.colors.muted} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {(
                  [
                    ["openOnly", "Şu an açık"],
                    ["freeDeliveryOnly", "Ücretsiz teslimat"],
                    ["topRated", "4,5+ puan"],
                    ["fast", "30 dk altı"],
                  ] as const
                ).map(([key, chipLabel]) => (
                  <Chip
                    key={key}
                    label={chipLabel}
                    small
                    active={quick[key]}
                    onPress={() => setQuick((current) => ({ ...current, [key]: !current[key] }))}
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
              icon={WifiOff}
              title="Liste yüklenemedi"
              description={error}
            />
          ) : (
            <EmptyState
              icon={UtensilsCrossed}
              title="Bu filtrelerle restoran yok"
              description="Kategoriyi ya da filtreleri kaldırmayı dene."
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
          backgroundColor: active ? t.colors.brand : t.colors.surface,
          borderColor: active ? t.colors.brand : t.colors.border,
          borderRadius: t.radius.pill,
          paddingVertical: small ? 6 : 9,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        variant="small"
        weight="semibold"
        style={{ color: active ? t.colors.brandContrast : t.colors.text }}
      >
        {label}
      </Text>
      {count !== undefined ? (
        <Text
          variant="caption"
          tabular
          style={{ color: active ? t.colors.brandContrast : t.colors.muted }}
        >
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Mutfak kutusu: fotoğraf (ya da ikon) ve altında adı — web'deki rafla aynı. */
function CategoryTile({
  id,
  name,
  image,
  active,
  onPress,
}: {
  id: string;
  name: string;
  image?: string;
  active: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.85 : 1 }]}
    >
      <View
        style={[
          styles.tileArt,
          {
            borderRadius: t.radius.lg,
            borderColor: active ? t.colors.brand : t.colors.border,
            borderWidth: active ? 2.5 : StyleSheet.hairlineWidth * 2,
          },
        ]}
      >
        {image ? (
          <FoodPhoto src={image} seed={id} tone={id} radius={0} iconSize={22} style={StyleSheet.absoluteFill} />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.tileIcon,
              { backgroundColor: active ? t.colors.brand : t.colors.brandSoft },
            ]}
          >
            <Icon
              name={cuisineIcon(id)}
              size={26}
              color={active ? t.colors.brandContrast : t.colors.brand}
              strokeWidth={1.9}
            />
          </View>
        )}
      </View>
      <Text
        variant="caption"
        weight="semibold"
        center
        numberOfLines={2}
        style={{ color: active ? t.colors.brand : t.colors.text }}
      >
        {name}
      </Text>
    </Pressable>
  );
}

/**
 * Kampanya afişi — web vitriniyle aynı dil: sol tarafta afişin degradesi ve
 * yazı, sağda degradeye karışan yemek fotoğrafı.
 */
function BannerCard({ banner, onPress }: { banner: Banner; onPress: () => void }) {
  const t = useTheme();
  const [from, to] = banner.gradient;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={banner.title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.banner,
        { borderRadius: t.radius.xl, transform: [{ scale: pressed ? 0.985 : 1 }] },
        t.shadow.md,
      ]}
    >
      <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {banner.image ? (
        <>
          <Image
            source={{ uri: photoUrl(banner.image) }}
            style={styles.bannerPhoto}
            contentFit="cover"
            transition={220}
            cachePolicy="memory-disk"
          />
          {/* Fotoğraf soldan degradeye karışsın; yazı düz renk üstünde okunur kalsın */}
          <LinearGradient
            colors={[from, `${from}00`]}
            start={{ x: 0.42, y: 0.5 }}
            end={{ x: 0.72, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : null}

      <View style={styles.bannerBody}>
        <Text variant="title" numberOfLines={2} style={styles.bannerTitle}>
          {banner.title}
        </Text>
        <Text variant="caption" numberOfLines={2} style={styles.bannerSubtitle}>
          {banner.subtitle}
        </Text>
        {banner.code ? (
          <View style={styles.bannerCode}>
            <Text variant="caption" weight="bold" style={{ color: "#ffffff", letterSpacing: 0.5 }}>
              {banner.code}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  location: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 6,
  },
  locationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  tile: { width: 76, alignItems: "center", gap: 6 },
  tileArt: { width: 72, height: 72, overflow: "hidden" },
  tileIcon: { alignItems: "center", justifyContent: "center" },
  banner: { width: 300, height: 148, overflow: "hidden" },
  bannerPhoto: { position: "absolute", right: 0, top: 0, bottom: 0, width: "58%" },
  bannerBody: { width: "64%", padding: 16, gap: 4, flex: 1, justifyContent: "center" },
  bannerTitle: { color: "#ffffff" },
  bannerSubtitle: { color: "rgba(255,255,255,0.88)" },
  bannerCode: {
    alignSelf: "flex-start",
    marginTop: 6,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  sortRow: { flexDirection: "row", alignItems: "center", gap: 8 },
});
