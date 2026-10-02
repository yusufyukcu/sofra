import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { Star } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { formatPrice, type Order } from "@sofra/core";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Header, Screen } from "@/components/ui/screen";
import { Card, Divider } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/store/session";
import { useTheme } from "@/theme";

/**
 * Değerlendirme.
 *
 * Restoran ve kurye ayrı puanlanır; bahşiş cüzdandan ödenir ve doğrudan
 * kuryenin kazancına yazılır. Bahşiş seçenekleri web'deki ile aynı:
 * 0 / 20 / 30 / 50 / 75 ₺.
 */

const TIPS = [0, 20, 30, 50, 75];

export default function RateScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const refresh = useSession((s) => s.refresh);
  const balance = useSession((s) => s.user?.walletBalance ?? 0);

  const [order, setOrder] = useState<Order | null>(null);
  const [restaurantScore, setRestaurantScore] = useState(5);
  const [restaurantComment, setRestaurantComment] = useState("");
  const [courierScore, setCourierScore] = useState(5);
  const [tip, setTip] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ order: Order }>(`/orders/${id}`)
      .then((d) => setOrder(d.order))
      .catch((err) => setError(errorMessage(err)));
  }, [id]);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await api.post(`/orders/${id}/rating`, {
        restaurantScore,
        restaurantComment: restaurantComment.trim() || undefined,
        courierScore: order?.courier ? courierScore : undefined,
        courierTip: order?.courier && tip > 0 ? tip : undefined,
      });
      await refresh();
      router.back();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const tipTooHigh = tip > balance;

  return (
    <Screen edges="both">
      <Header
        title="Değerlendir"
        subtitle={order?.restaurantName}
        back
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          <Card style={{ gap: t.spacing.md }}>
            <Text variant="title">Restoran nasıldı?</Text>
            <Stars value={restaurantScore} onChange={setRestaurantScore} />
            <Field
              placeholder="Yorumun restoran sayfasında yayınlanır (isteğe bağlı)"
              value={restaurantComment}
              onChangeText={setRestaurantComment}
              multiline
              maxLength={400}
            />
          </Card>

          {order?.courier ? (
            <Card style={{ gap: t.spacing.md }}>
              <View style={styles.courierHead}>
                <Text style={styles.avatar}>{order.courier.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text variant="title">Kurye nasıldı?</Text>
                  <Text variant="caption">{order.courier.name}</Text>
                </View>
              </View>
              <Stars value={courierScore} onChange={setCourierScore} />

              <Divider />

              <View style={{ gap: t.spacing.sm }}>
                <View style={styles.tipHead}>
                  <Text variant="body" weight="semibold" tone="ink">
                    Bahşiş bırak
                  </Text>
                  <Text variant="caption" tabular>
                    Cüzdan {formatPrice(balance)}
                  </Text>
                </View>

                <View style={styles.tips}>
                  {TIPS.map((amount) => {
                    const active = tip === amount;
                    return (
                      <Pressable
                        key={amount}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => setTip(amount)}
                        style={({ pressed }) => [
                          styles.tip,
                          {
                            backgroundColor: active
                              ? t.colors.brand
                              : t.colors.surface,
                            borderColor: active
                              ? t.colors.brand
                              : t.colors.border,
                            borderRadius: t.radius.md,
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}
                      >
                        <Text
                          variant="small"
                          weight="semibold"
                          tabular
                          style={{
                            color: active
                              ? t.colors.brandContrast
                              : t.colors.text,
                          }}
                        >
                          {amount === 0 ? "Yok" : `${amount} ₺`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {tipTooHigh ? (
                  <Text variant="caption" tone="danger">
                    Cüzdan bakiyen bu bahşiş için yetmiyor.
                  </Text>
                ) : tip > 0 ? (
                  <Text variant="caption">
                    {formatPrice(tip)} cüzdanından düşülüp doğrudan kuryenin
                    kazancına eklenir.
                  </Text>
                ) : null}
              </View>
            </Card>
          ) : null}

          {error ? (
            <Card
              elevation="none"
              style={{
                backgroundColor: t.colors.dangerSoft,
                borderColor: t.colors.dangerSoft,
              }}
            >
              <Text variant="small" tone="danger">
                {error}
              </Text>
            </Card>
          ) : null}

          <Button
            label="Değerlendirmeyi gönder"
            onPress={submit}
            loading={saving}
            disabled={tipTooHigh}
            size="lg"
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function Stars({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((score) => (
        <Pressable
          key={score}
          accessibilityRole="button"
          accessibilityLabel={`${score} yıldız`}
          hitSlop={6}
          onPress={() => {
            if (Platform.OS !== "web") {
              void Haptics.selectionAsync();
            }
            onChange(score);
          }}
        >
          <Star
            size={36}
            color={score <= value ? t.colors.saffron : t.colors.borderStrong}
            fill={score <= value ? t.colors.saffron : "transparent"}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stars: { flexDirection: "row", gap: 8, alignSelf: "center" },
  courierHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { fontSize: 30, lineHeight: 36 },
  tipHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  tips: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  tip: {
    flex: 1,
    minWidth: 58,
    alignItems: "center",
    paddingVertical: 11,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
