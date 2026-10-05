import { LinearGradient } from "expo-linear-gradient";
import { SearchX, Search, WifiOff, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import {
  CATEGORIES,
  FILTER_PARAM_KEYS,
  type RestaurantListItem,
} from "@sofra/core";
import { CartBar } from "@/components/customer/cart-bar";
import { RestaurantCard } from "@/components/customer/restaurant-card";
import { FoodPhoto } from "@/components/ui/food-photo";
import { Field } from "@/components/ui/input";
import { Header, Screen } from "@/components/ui/screen";
import { EmptyState, Skeleton } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { api, errorMessage } from "@/lib/api";
import { deliveryPoint, useSession } from "@/store/session";
import { useTheme } from "@/theme";

/**
 * Arama.
 *
 * Restoran adı, mutfak etiketi ve ürün adı üzerinden arar — eşleştirme
 * sunucudaki `@sofra/core/discovery` ile yapılır. Yazarken 300 ms
 * beklenir, böylece her harfte istek atılmaz.
 *
 * Arama boşken popüler mutfaklar önerilir; boş bir ekran yerine yol
 * gösterir.
 */

export default function SearchScreen() {
  const t = useTheme();
  const point = useSession(deliveryPoint);

  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<RestaurantListItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Yazma bitene kadar bekle.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    if (debounced.length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({
      lat: String(point.lat),
      lng: String(point.lng),
      [FILTER_PARAM_KEYS.query]: debounced,
    });

    api
      .get<{ restaurants: RestaurantListItem[] }>(`/restaurants?${params}`)
      .then((data) => {
        if (cancelled) return;
        setResults(data.restaurants);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(errorMessage(err));
        setResults([]);
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [debounced, point.lat, point.lng]);

  // "Tümü" ve "Puanı Yüksekler" birer mutfak değil, filtre kısayolu —
  // öneri olarak gösterilmezler.
  const suggestions = useMemo(
    () =>
      CATEGORIES.filter((c) => c.id !== "all" && c.id !== "top-rated").slice(
        0,
        8
      ),
    []
  );

  return (
    <Screen>
      <Header title="Ara" large>
        <Field
          value={term}
          onChangeText={setTerm}
          placeholder="Restoran, mutfak veya ürün"
          autoCorrect={false}
          returnKeyType="search"
          prefix=""
          right={
            term.length ? (
              <Pressable onPress={() => setTerm("")} hitSlop={10}>
                <X size={17} color={t.colors.muted} />
              </Pressable>
            ) : (
              <Search size={17} color={t.colors.muted} />
            )
          }
        />
      </Header>

      <FlatList
        data={results ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: t.spacing.lg,
          gap: t.spacing.md,
          paddingBottom: 110,
        }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <RestaurantCard restaurant={item} />}
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: t.spacing.md }}>
              <Skeleton height={98} radius={t.radius.lg} />
              <Skeleton height={98} radius={t.radius.lg} />
            </View>
          ) : error ? (
            <EmptyState icon={WifiOff} title="Arama yapılamadı" description={error} />
          ) : debounced.length >= 2 ? (
            <EmptyState
              icon={SearchX}
              title={`"${debounced}" bulunamadı`}
              description="Farklı bir kelime dene ya da aşağıdaki mutfaklara göz at."
            />
          ) : (
            <View style={{ gap: t.spacing.md }}>
              <Text variant="label">Popüler mutfaklar</Text>
              <View style={styles.suggestions}>
                {suggestions.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setTerm(c.name)}
                    accessibilityRole="button"
                    accessibilityLabel={`${c.name} ara`}
                    style={({ pressed }) => [
                      styles.suggestion,
                      {
                        borderRadius: t.radius.lg,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      },
                    ]}
                  >
                    <FoodPhoto
                      src={c.image}
                      seed={c.id}
                      tone={c.id}
                      radius={0}
                      iconSize={26}
                      style={StyleSheet.absoluteFill}
                    />
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.62)"]}
                      style={StyleSheet.absoluteFill}
                    />
                    <Text variant="body" weight="bold" style={styles.suggestionName}>
                      {c.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )
        }
      />

      <CartBar />
    </Screen>
  );
}

const styles = StyleSheet.create({
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  suggestion: {
    width: "48%",
    flexGrow: 1,
    height: 96,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: 12,
  },
  suggestionName: { color: "#ffffff" },
});
