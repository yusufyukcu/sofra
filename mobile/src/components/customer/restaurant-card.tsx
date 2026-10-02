import { router } from "expo-router";
import { Bike, Star } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import {
  formatDistance,
  formatPrice,
  type RestaurantListItem,
} from "@sofra/core";
import { FoodArt } from "@/components/ui/food-art";
import { Badge } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

/**
 * Restoran kartı.
 *
 * İki biçim var — web'deki düzenin aynısı: sıralamadaki ilk restoran geniş
 * kartla açılır (`featured`), gerisi kompakt satır olur. Yapı "en iyi eşleşme"
 * bilgisini kodlar; süsleme değil.
 *
 * Kapalı veya teslimat alanı dışındaki restoran soluk gösterilir ama
 * gizlenmez — kullanıcı neden sipariş veremediğini görsün.
 */

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
        ? "Şu an kapalı"
        : null;

  const open = () => router.push(`/restoran/${restaurant.slug}`);

  const meta = (
    <View style={styles.meta}>
      <View style={styles.metaItem}>
        <Star size={13} color={t.colors.saffron} fill={t.colors.saffron} />
        <Text variant="small" weight="semibold" tone="ink" tabular>
          {restaurant.rating.toFixed(1)}
        </Text>
        <Text variant="caption">({restaurant.ratingCount})</Text>
      </View>
      <Text variant="caption">·</Text>
      <Text variant="small" tabular>
        {restaurant.etaText}
      </Text>
      <Text variant="caption">·</Text>
      <Text variant="small" tabular>
        {formatDistance(restaurant.distanceKm)}
      </Text>
    </View>
  );

  const delivery = (
    <View style={styles.meta}>
      <Bike size={13} color={t.colors.muted} />
      <Text variant="caption">
        {restaurant.deliveryFee === 0
          ? "Ücretsiz teslimat"
          : `${formatPrice(restaurant.deliveryFee)} teslimat`}
      </Text>
      <Text variant="caption">·</Text>
      <Text variant="caption">min. {formatPrice(restaurant.minBasket)}</Text>
    </View>
  );

  if (featured) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={open}
        style={({ pressed }) => [
          styles.featured,
          {
            backgroundColor: t.colors.surface,
            borderColor: t.colors.border,
            borderRadius: t.radius.lg,
            opacity: pressed ? 0.94 : unavailable ? 0.62 : 1,
          },
          t.shadow.md,
        ]}
      >
        <FoodArt
          seed={restaurant.coverSeed}
          emoji={restaurant.emoji}
          tone={restaurant.tags[0]}
          radius={0}
          emojiSize={54}
          style={styles.featuredArt}
        />

        <View style={styles.featuredBody}>
          <View style={styles.badges}>
            <Badge label="En iyi eşleşme" tone="brand" />
            {restaurant.badges.slice(0, 1).map((b) => (
              <Badge key={b} label={b} tone="saffron" />
            ))}
            {reason ? <Badge label={reason} tone="danger" /> : null}
          </View>

          <Text variant="title" numberOfLines={1}>
            {restaurant.name}
          </Text>
          <Text variant="small" numberOfLines={2}>
            {restaurant.description}
          </Text>
          {meta}
          {delivery}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={open}
      style={({ pressed }) => [
        styles.compact,
        {
          backgroundColor: t.colors.surface,
          borderColor: t.colors.border,
          borderRadius: t.radius.lg,
          opacity: pressed ? 0.94 : unavailable ? 0.62 : 1,
        },
        t.shadow.sm,
      ]}
    >
      <FoodArt
        seed={restaurant.coverSeed}
        emoji={restaurant.emoji}
        tone={restaurant.tags[0]}
        radius={t.radius.md}
        emojiSize={30}
        style={styles.compactArt}
      />

      <View style={styles.compactBody}>
        <Text variant="bodyLarge" weight="semibold" tone="ink" numberOfLines={1}>
          {restaurant.name}
        </Text>
        {reason ? (
          <Text variant="caption" tone="danger">
            {reason}
          </Text>
        ) : (
          <Text variant="caption" numberOfLines={1}>
            {restaurant.tags.slice(0, 3).join(" · ")}
          </Text>
        )}
        {meta}
        {delivery}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  featured: { overflow: "hidden", borderWidth: StyleSheet.hairlineWidth * 2 },
  featuredArt: { height: 150, width: "100%" },
  featuredBody: { padding: 16, gap: 5 },
  badges: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 2 },
  compact: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  compactArt: { width: 74, height: 74 },
  compactBody: { flex: 1, gap: 3, justifyContent: "center" },
  meta: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
});
