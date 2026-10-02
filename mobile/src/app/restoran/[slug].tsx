import { router, useLocalSearchParams } from "expo-router";
import { Bike, Clock, Heart, MapPin, Star } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  View,
} from "react-native";
import {
  formatPrice,
  toCartMeta,
  type MenuCategory,
  type Product,
  type Restaurant,
  type Review,
} from "@sofra/core";
import { CartBar } from "@/components/customer/cart-bar";
import { ProductSheet } from "@/components/customer/product-sheet";
import { FoodArt } from "@/components/ui/food-art";
import { Header, Screen } from "@/components/ui/screen";
import { Badge, Card, Divider, EmptyState, Skeleton } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { api, errorMessage } from "@/lib/api";
import { useCart } from "@/store/cart";
import { deliveryPoint, useSession } from "@/store/session";
import { useTheme } from "@/theme";

/**
 * Restoran ekranı.
 *
 * Kapak → bilgi şeridi → kategori sekmeleri → menü. Menü `SectionList` ile
 * çizilir, üstteki kategori şeridi listedeki bölüme atlar.
 *
 * Sepete ekleme kuralı web ile aynı: sepet tek restorana ait, farklı bir
 * restorandan ürün eklenmek istenirse onay sorulur.
 */

interface RestaurantResponse {
  restaurant: Restaurant;
  /** Kullanıcının konumuna göre hesaplanan teslimat bilgisi */
  delivery: {
    distanceKm: number;
    deliverable: boolean;
    etaText: string;
    open: boolean;
  };
  isFavorite: boolean;
  reviews: Review[];
}

export default function RestaurantScreen() {
  const t = useTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  // Paylaşılan seçiciyi kullan: her zaman kararlı bir referans döndürür.
  // Buraya nesne sabiti yazmak zustand'ın anlık görüntü karşılaştırmasını
  // bozar ve sonsuz render döngüsüne yol açar.
  const point = useSession(deliveryPoint);
  const authed = useSession((s) => s.status === "authenticated");
  const toggleFavorite = useSession((s) => s.toggleFavorite);

  const addLine = useCart((s) => s.addLine);
  const replaceWith = useCart((s) => s.replaceWith);

  const [data, setData] = useState<RestaurantResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);

  const listRef = useRef<SectionList<Product, MenuCategory>>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await api.get<RestaurantResponse>(
        `/restaurants/${slug}?lat=${point.lat}&lng=${point.lng}`
      );
      setData(result);
      setFavorite(result.isFavorite);
      setActive(result.restaurant.menu[0]?.id ?? null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [slug, point.lat, point.lng]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <Screen>
        <Header title="Restoran" back />
        <EmptyState emoji="🔍" title="Restoran bulunamadı" description={error} />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        <Header title="Yükleniyor" back />
        <View style={{ padding: t.spacing.lg, gap: t.spacing.md }}>
          <Skeleton height={160} radius={t.radius.lg} />
          <Skeleton height={70} radius={t.radius.lg} />
          <Skeleton height={70} radius={t.radius.lg} />
        </View>
      </Screen>
    );
  }

  const r = data.restaurant;
  // Açık olma ve teslimat kapsamı restoran nesnesinde değil, konuma göre
  // hesaplanan `delivery` bloğunda geliyor.
  const { deliverable, open } = data.delivery;
  const unavailable = !open || !deliverable;

  function handleAdd(product: Product, line: Parameters<typeof addLine>[1]) {
    const meta = toCartMeta(r);
    const result = addLine(meta, line);

    if (!result.ok) {
      Alert.alert(
        "Sepetinde başka restoran var",
        "Sepeti boşaltıp bu ürünü eklemek ister misin?",
        [
          { text: "Vazgeç", style: "cancel" },
          {
            text: "Sepeti boşalt",
            style: "destructive",
            onPress: () => {
              replaceWith(meta, line);
              setSelected(null);
            },
          },
        ]
      );
      return;
    }
    setSelected(null);
  }

  async function onToggleFavorite() {
    if (!authed) {
      router.push("/giris");
      return;
    }
    // İyimser güncelleme — sunucu reddederse geri alınır.
    setFavorite((f) => !f);
    try {
      setFavorite(await toggleFavorite(r.id));
    } catch {
      setFavorite((f) => !f);
    }
  }

  function jumpTo(sectionId: string) {
    const index = r.menu.findIndex((s) => s.id === sectionId);
    if (index < 0) return;
    setActive(sectionId);
    listRef.current?.scrollToLocation({
      sectionIndex: index,
      itemIndex: 0,
      viewOffset: 8,
      animated: true,
    });
  }

  return (
    <Screen>
      <Header
        title={r.name}
        subtitle={`${r.district} · ${data.delivery.etaText}`}
        back
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={favorite ? "Favorilerden çıkar" : "Favorilere ekle"}
            onPress={onToggleFavorite}
            hitSlop={10}
            style={({ pressed }) => [
              styles.fav,
              { backgroundColor: t.colors.deep2, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Heart
              size={18}
              color={favorite ? t.colors.brand : t.colors.onDeepMuted}
              fill={favorite ? t.colors.brand : "transparent"}
            />
          </Pressable>
        }
      />

      <SectionList
        ref={listRef}
        sections={r.menu.map((s) => ({ ...s, data: s.products }))}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        onViewableItemsChanged={({ viewableItems }) => {
          const first = viewableItems[0];
          if (first?.section) setActive((first.section as MenuCategory).id);
        }}
        viewabilityConfig={{ itemVisiblePercentThreshold: 40 }}
        ListHeaderComponent={
          <View>
            <FoodArt
              seed={r.coverSeed}
              emoji={r.emoji}
              tone={r.tags[0]}
              radius={0}
              emojiSize={62}
              style={{ height: 170, width: "100%" }}
            />

            <View style={{ padding: t.spacing.lg, gap: t.spacing.md }}>
              {unavailable ? (
                <Card
                  elevation="none"
                  style={{
                    backgroundColor: t.colors.dangerSoft,
                    borderColor: t.colors.dangerSoft,
                  }}
                >
                  <Text variant="small" weight="semibold" tone="danger">
                    {!deliverable
                      ? "Bu restoran adresine teslimat yapmıyor."
                      : r.temporarilyClosed
                        ? "Restoran şu an mola veriyor."
                        : "Restoran şu an kapalı."}
                  </Text>
                  <Text variant="caption" style={{ marginTop: 2 }}>
                    Menüyü inceleyebilirsin ama sipariş veremezsin.
                  </Text>
                </Card>
              ) : null}

              <Text variant="small">{r.description}</Text>

              <View style={styles.stats}>
                <Stat
                  icon={<Star size={15} color={t.colors.saffron} fill={t.colors.saffron} />}
                  value={r.rating.toFixed(1)}
                  label={`${r.ratingCount} değerlendirme`}
                />
                <Divider style={styles.vline} />
                <Stat
                  icon={<Clock size={15} color={t.colors.muted} />}
                  value={data.delivery.etaText}
                  label="teslimat"
                />
                <Divider style={styles.vline} />
                <Stat
                  icon={<Bike size={15} color={t.colors.muted} />}
                  value={
                    r.deliveryFee === 0 ? "Ücretsiz" : formatPrice(r.deliveryFee)
                  }
                  label={`min. ${formatPrice(r.minBasket)}`}
                />
              </View>

              <View style={styles.tags}>
                <MapPin size={13} color={t.colors.muted} />
                <Text variant="caption">
                  {r.district} · {r.tags.join(" · ")}
                </Text>
              </View>
            </View>

            {/* Kategori şeridi */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: t.spacing.sm,
                paddingHorizontal: t.spacing.lg,
                paddingBottom: t.spacing.md,
              }}
            >
              {r.menu.map((section) => (
                <Pressable
                  key={section.id}
                  onPress={() => jumpTo(section.id)}
                  style={({ pressed }) => [
                    styles.tab,
                    {
                      backgroundColor:
                        active === section.id ? t.colors.deep : t.colors.surface,
                      borderColor:
                        active === section.id ? t.colors.deep : t.colors.border,
                      borderRadius: t.radius.pill,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text
                    variant="small"
                    weight="semibold"
                    style={{
                      color:
                        active === section.id ? t.colors.onDeep : t.colors.text,
                    }}
                  >
                    {section.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View
            style={{
              paddingHorizontal: t.spacing.lg,
              paddingTop: t.spacing.lg,
              paddingBottom: t.spacing.sm,
              backgroundColor: t.colors.paper,
              gap: 2,
            }}
          >
            <Text variant="title">{section.name}</Text>
            {section.description ? (
              <Text variant="caption">{section.description}</Text>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => (
          <ProductRow
            product={item}
            disabled={unavailable}
            onPress={() => setSelected(item)}
          />
        )}
        ListFooterComponent={
          data.reviews.length ? (
            <View style={{ padding: t.spacing.lg, gap: t.spacing.md }}>
              <Text variant="title">Değerlendirmeler</Text>
              {data.reviews.slice(0, 5).map((review) => (
                <Card key={review.id} style={{ gap: 6 }}>
                  <View style={styles.reviewHead}>
                    <Text variant="body" weight="semibold" tone="ink">
                      {review.userName}
                    </Text>
                    <View style={styles.rating}>
                      <Star size={13} color={t.colors.saffron} fill={t.colors.saffron} />
                      <Text variant="small" weight="semibold" tone="ink" tabular>
                        {review.score}
                      </Text>
                    </View>
                  </View>
                  {review.comment ? (
                    <Text variant="small">{review.comment}</Text>
                  ) : null}
                  {review.reply ? (
                    <View
                      style={[
                        styles.reply,
                        {
                          backgroundColor: t.colors.surface2,
                          borderRadius: t.radius.sm,
                        },
                      ]}
                    >
                      <Text variant="caption" weight="semibold" tone="ink">
                        {r.name} yanıtladı
                      </Text>
                      <Text variant="caption">{review.reply}</Text>
                    </View>
                  ) : null}
                </Card>
              ))}
            </View>
          ) : null
        }
      />

      {selected ? (
        <ProductSheet
          key={selected.id}
          product={selected}
          visible
          onClose={() => setSelected(null)}
          onAdd={(line) => handleAdd(selected, line)}
        />
      ) : null}

      <CartBar />
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function ProductRow({
  product,
  disabled,
  onPress,
}: {
  product: Product;
  disabled?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.product,
        {
          marginHorizontal: t.spacing.lg,
          backgroundColor: t.colors.surface,
          borderColor: t.colors.border,
          borderRadius: t.radius.lg,
          opacity: disabled ? 0.55 : pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.productHead}>
          <Text variant="body" weight="semibold" tone="ink" style={{ flex: 1 }}>
            {product.name}
          </Text>
          {product.popular ? <Badge label="Çok satan" tone="saffron" /> : null}
        </View>
        {product.description ? (
          <Text variant="caption" numberOfLines={2}>
            {product.description}
          </Text>
        ) : null}
        <View style={styles.priceRow}>
          <Text variant="body" weight="semibold" tone="ink" tabular>
            {formatPrice(product.price)}
          </Text>
          {product.oldPrice ? (
            <Text variant="caption" tabular style={styles.oldPrice}>
              {formatPrice(product.oldPrice)}
            </Text>
          ) : null}
          {product.optionGroups.length ? (
            <Text variant="caption">· seçenekli</Text>
          ) : null}
        </View>
      </View>

      <FoodArt
        seed={product.id}
        emoji={product.emoji}
        radius={t.radius.md}
        emojiSize={28}
        style={{ width: 72, height: 72 }}
      />
    </Pressable>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.stat}>
      <View style={styles.statTop}>
        {icon}
        <Text variant="body" weight="semibold" tone="ink" tabular>
          {value}
        </Text>
      </View>
      <Text variant="caption" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fav: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  stats: { flexDirection: "row", alignItems: "center", gap: 12 },
  stat: { flex: 1, gap: 1 },
  statTop: { flexDirection: "row", alignItems: "center", gap: 5 },
  vline: { width: StyleSheet.hairlineWidth, height: 28 },
  tags: { flexDirection: "row", alignItems: "center", gap: 5 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth * 2 },
  product: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  productHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 7, marginTop: 2 },
  oldPrice: { textDecorationLine: "line-through" },
  reviewHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rating: { flexDirection: "row", alignItems: "center", gap: 3 },
  reply: { padding: 10, gap: 2, marginTop: 4 },
});
