import { router } from "expo-router";
import { Bike, Clock, MapPin, Star } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import {
  CATEGORIES,
  formatDistance,
  formatPrice,
  restaurantPhoto,
  type RestaurantListItem,
} from "@sofra/core";
import { FoodPhoto } from "@/components/ui/food-photo";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

/**
 * Restoran kartı — fotoğraf üstte, bilgi altta; web'deki kartla aynı dil.
 *
 * İki boy var: sıralamadaki ilk restoran geniş kartla açılır (`featured`,
 * açıklamasıyla), gerisi daha kısa fotoğraflı kart olur. Yapı "en iyi
 * eşleşme" bilgisini kodlar; süsleme değil.
 *
 * Kapalı veya teslimat alanı dışındaki restoran soluk gösterilir ama
 * gizlenmez — kullanıcı neden sipariş veremediğini görsün.
 */

const cuisineName = (tag: string) => CATEGORIES.find((c) => c.id === tag)?.name ?? tag;

export function RestaurantCard({
  restaurant,
  featured,
}: {
  restaurant: RestaurantListItem;
  featured?: boolean;
}) {
  const t = useTheme();
  const unavailable = !restaurant.open || !restaurant.deliverable;

  const reason = !restaurant.deliverable
    ? "Teslimat alanı dışında"
    : restaurant.temporarilyClosed
      ? "Şu an mola veriyor"
      : !restaurant.open
        ? `${restaurant.workingHours.open}'de açılıyor`
        : null;

  const freeDelivery =
    restaurant.freeDeliveryOver === null
      ? null
      : restaurant.freeDeliveryOver === 0
        ? "Teslimat ücretsiz"
        : `${restaurant.freeDeliveryOver} ₺ üzeri ücretsiz`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${restaurant.name}, ${restaurant.rating.toFixed(1)} puan, ${restaurant.etaText}`}
      onPress={() => router.push(`/restoran/${restaurant.slug}`)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: t.colors.surface,
          borderColor: t.colors.border,
          borderRadius: t.radius.lg,
          opacity: unavailable ? 0.7 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        featured ? t.shadow.md : t.shadow.sm,
      ]}
    >
      <View>
        <FoodPhoto
          src={restaurantPhoto(restaurant)}
          seed={restaurant.coverSeed}
          tone={restaurant.tags[0]}
          radius={0}
          iconSize={featured ? 40 : 32}
          priority={featured}
          style={{ height: featured ? 176 : 132, width: "100%" }}
        />

        {/* Fotoğrafın üstündeki rozetler */}
        <View style={styles.overlayRow} pointerEvents="none">
          {freeDelivery ? (
            <View style={[styles.pill, { backgroundColor: t.colors.pistachio }]}>
              <Text variant="caption" weight="bold" style={styles.pillText}>
                {freeDelivery}
              </Text>
            </View>
          ) : null}
          {restaurant.badges.slice(0, featured ? 2 : 1).map((badge) => (
            <View key={badge} style={[styles.pill, styles.pillDark]}>
              <Text variant="caption" weight="semibold" style={styles.pillText}>
                {badge}
              </Text>
            </View>
          ))}
        </View>

        {reason ? (
          <View style={[StyleSheet.absoluteFill, styles.closed]}>
            <View style={[styles.closedChip, { backgroundColor: t.colors.surface }]}>
              <Text variant="small" weight="bold" tone="ink">
                {reason}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={[styles.body, featured && { paddingVertical: 14 }]}>
        <View style={styles.titleRow}>
          <Text variant={featured ? "title" : "bodyLarge"} weight="semibold" tone="ink" numberOfLines={1} style={{ flex: 1 }}>
            {restaurant.name}
          </Text>
          <View style={[styles.rating, { backgroundColor: t.colors.saffronSoft }]}>
            <Star size={12} color={t.colors.saffron} fill={t.colors.saffron} />
            <Text variant="caption" weight="bold" tabular style={{ color: t.colors.saffron }}>
              {restaurant.rating.toFixed(1)}
            </Text>
          </View>
        </View>

        <Text variant="caption" numberOfLines={1}>
          {restaurant.tags.slice(0, 3).map(cuisineName).join(", ")} · {restaurant.ratingCount} değerlendirme
        </Text>

        {featured && restaurant.description ? (
          <Text variant="small" tone="muted" numberOfLines={2}>
            {restaurant.description}
          </Text>
        ) : null}

        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Clock size={13} color={t.colors.muted} />
            <Text variant="caption" tabular>
              {restaurant.etaText}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <MapPin size={13} color={t.colors.muted} />
            <Text variant="caption" tabular>
              {formatDistance(restaurant.distanceKm)}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Bike size={13} color={t.colors.muted} />
            <Text variant="caption" tabular>
              {restaurant.deliveryFee === 0 ? "Ücretsiz" : formatPrice(restaurant.deliveryFee)}
            </Text>
          </View>
          <Text variant="caption" tabular>
            Min. {formatPrice(restaurant.minBasket)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { overflow: "hidden", borderWidth: StyleSheet.hairlineWidth * 2 },
  overlayRow: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillDark: { backgroundColor: "rgba(0,0,0,0.5)" },
  pillText: { color: "#ffffff" },
  closed: {
    backgroundColor: "rgba(46,23,32,0.62)",
    alignItems: "center",
    justifyContent: "center",
  },
  closedChip: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  body: { paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  meta: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 4 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
});
