import { router } from "expo-router";
import { Tag, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  formatPrice,
  lineTotal,
  type Coupon,
  type OrderTotals,
} from "@sofra/core";
import { Button } from "@/components/ui/button";
import { Field, Stepper } from "@/components/ui/input";
import { Header, Screen } from "@/components/ui/screen";
import {
  Badge,
  Card,
  Divider,
  EmptyState,
  Row,
  Skeleton,
} from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { api, errorMessage } from "@/lib/api";
import { cartTotal, useCart } from "@/store/cart";
import { useSession } from "@/store/session";
import { useTheme } from "@/theme";

/**
 * Sepet.
 *
 * Tutarlar istemcide hesaplanmaz: `/coupons/validate` uç noktası sepeti
 * menüye karşı doğrulayıp toplamları döndürür. Web'deki ödeme ekranı da tam
 * olarak bunu yapıyor — "ne kadar ödeyeceğim" sorusunun tek cevabı sunucudur.
 * Böylece kupon kuralı, teslimat eşiği veya hizmet bedeli değişse iki
 * istemci birden doğru sonucu gösterir.
 *
 * Giriş yapılmamışsa toplamlar istenmez (uç nokta oturum ister); ara toplam
 * gösterilir ve kullanıcı girişe yönlendirilir.
 */

interface TotalsResponse {
  totals: OrderTotals;
  coupon: Coupon | null;
  meetsMinBasket: boolean;
  minBasket: number;
}

export default function CartScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const restaurant = useCart((s) => s.restaurant);
  const lines = useCart((s) => s.lines);
  const subtotal = useCart(cartTotal);
  const updateQuantity = useCart((s) => s.updateQuantity);
  const removeLine = useCart((s) => s.removeLine);
  const clear = useCart((s) => s.clear);

  const authed = useSession((s) => s.status === "authenticated");

  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<string | null>(null);
  const [quote, setQuote] = useState<TotalsResponse | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const restaurantId = restaurant?.id;

  /** Sunucudan güncel toplamları ister. `withCode` verilmezse kuponsuz sorar. */
  const quoteTotals = useCallback(
    async (withCode: string | null) => {
      if (!authed || !restaurantId || lines.length === 0) return;
      setLoading(true);
      setCouponError(null);
      try {
        const data = await api.post<TotalsResponse>("/coupons/validate", {
          restaurantId,
          lines,
          code: withCode ?? undefined,
          paymentMethod: "online_card",
        });
        setQuote(data);
        setApplied(data.coupon?.code ?? null);
      } catch (err) {
        if (withCode) {
          // Kupon reddedildi — sepet toplamları kuponsuz haliyle kalsın.
          setCouponError(errorMessage(err));
          void quoteTotals(null);
        } else {
          setQuote(null);
        }
      } finally {
        setLoading(false);
      }
    },
    [authed, restaurantId, lines]
  );

  // Sepet her değiştiğinde toplamlar yeniden sorulur.
  useEffect(() => {
    void quoteTotals(applied);
    // `applied` kasıtlı olarak bağımlılıkta değil: kupon değişimi kendi
    // çağrısını zaten yapıyor, burada yalnızca sepet değişimini izliyoruz.
  }, [quoteTotals]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!restaurant || lines.length === 0) {
    return (
      <Screen edges="both">
        <Header title="Sepetim" back />
        <EmptyState
          emoji="🛒"
          title="Sepetin boş"
          description="Beğendiğin bir restorandan ürün ekleyince burada görünür."
          action={
            <Button label="Restoranlara göz at" onPress={() => router.replace("/")} />
          }
        />
      </Screen>
    );
  }

  const totals = quote?.totals ?? null;
  const belowMinimum = subtotal < restaurant.minBasket;
  const missing = restaurant.minBasket - subtotal;

  return (
    <Screen edges="none">
      <Header
        title="Sepetim"
        subtitle={restaurant.name}
        back
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sepeti boşalt"
            onPress={clear}
            hitSlop={10}
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: t.colors.deep2, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Trash2 size={17} color={t.colors.onDeepMuted} />
          </Pressable>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            padding: t.spacing.lg,
            gap: t.spacing.md,
            paddingBottom: t.spacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Card style={{ gap: t.spacing.md }}>
            {lines.map((line, index) => (
              <View key={line.lineId} style={{ gap: t.spacing.sm }}>
                {index > 0 ? <Divider /> : null}
                <View style={styles.line}>
                  <Text style={styles.lineEmoji}>{line.emoji}</Text>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="body" weight="semibold" tone="ink">
                      {line.name}
                    </Text>
                    {line.selections.map((s) => (
                      <Text key={s.groupId} variant="caption">
                        {s.groupName}: {s.optionNames.join(", ")}
                        {s.priceDelta !== 0
                          ? `  (${s.priceDelta > 0 ? "+" : ""}${formatPrice(s.priceDelta)})`
                          : ""}
                      </Text>
                    ))}
                    {line.note ? (
                      <Text variant="caption" tone="saffron">
                        Not: {line.note}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <Text variant="body" weight="semibold" tone="ink" tabular>
                      {formatPrice(lineTotal(line))}
                    </Text>
                    <Stepper
                      value={line.quantity}
                      min={0}
                      compact
                      onChange={(next) =>
                        next === 0
                          ? removeLine(line.lineId)
                          : updateQuantity(line.lineId, next)
                      }
                    />
                  </View>
                </View>
              </View>
            ))}
          </Card>

          {/* Kampanya kodu */}
          {authed ? (
            <Card style={{ gap: t.spacing.sm }}>
              <View style={styles.couponHead}>
                <Tag size={16} color={t.colors.brand} />
                <Text variant="body" weight="semibold" tone="ink">
                  Kampanya kodu
                </Text>
              </View>

              {applied && quote?.coupon ? (
                <View style={styles.couponApplied}>
                  <Badge label={quote.coupon.code} tone="pistachio" />
                  <Text variant="small" style={{ flex: 1 }}>
                    {quote.coupon.description}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setCode("");
                      setApplied(null);
                      void quoteTotals(null);
                    }}
                    hitSlop={8}
                  >
                    <Text variant="small" weight="semibold" tone="danger">
                      Kaldır
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.couponRow}>
                  <Field
                    value={code}
                    onChangeText={(v) => setCode(v.toUpperCase())}
                    placeholder="Kodu gir"
                    autoCapitalize="characters"
                    containerStyle={{ flex: 1 }}
                    error={couponError}
                  />
                  <Button
                    label="Uygula"
                    variant="secondary"
                    onPress={() => quoteTotals(code.trim())}
                    loading={loading}
                    disabled={!code.trim()}
                  />
                </View>
              )}
            </Card>
          ) : null}

          {/* Tutarlar — sunucudan */}
          <Card style={{ gap: 2 }}>
            {totals ? (
              <>
                <Row label="Ara toplam" value={formatPrice(totals.subtotal)} />
                <Row
                  label="Teslimat"
                  value={
                    totals.deliveryFee === 0
                      ? "Ücretsiz"
                      : formatPrice(totals.deliveryFee)
                  }
                  tone={totals.deliveryFee === 0 ? "pistachio" : undefined}
                  note={
                    restaurant.freeDeliveryOver && totals.deliveryFee > 0
                      ? `${formatPrice(restaurant.freeDeliveryOver)} üzeri ücretsiz`
                      : undefined
                  }
                />
                <Row label="Hizmet bedeli" value={formatPrice(totals.serviceFee)} />
                {totals.discount > 0 ? (
                  <Row
                    label="İndirim"
                    value={`−${formatPrice(totals.discount)}`}
                    tone="pistachio"
                  />
                ) : null}
                <Divider style={{ marginVertical: 6 }} />
                <Row label="Toplam" value={formatPrice(totals.grandTotal)} strong />
              </>
            ) : authed && loading ? (
              <View style={{ gap: 10 }}>
                <Skeleton height={14} width="60%" />
                <Skeleton height={14} width="45%" />
                <Skeleton height={20} width="70%" />
              </View>
            ) : (
              <>
                <Row label="Ara toplam" value={formatPrice(subtotal)} />
                <Text variant="caption" style={{ marginTop: 6 }}>
                  Teslimat ve hizmet bedeli giriş yaptıktan sonra hesaplanır.
                </Text>
              </>
            )}
          </Card>

          {belowMinimum ? (
            <Card
              elevation="none"
              style={{
                backgroundColor: t.colors.saffronSoft,
                borderColor: t.colors.saffronSoft,
              }}
            >
              <Text
                variant="small"
                weight="semibold"
                style={{ color: t.colors.saffron }}
              >
                Minimum sepet tutarına {formatPrice(missing)} kaldı
              </Text>
              <Text variant="caption" style={{ marginTop: 2 }}>
                Bu restoranın alt limiti {formatPrice(restaurant.minBasket)}.
              </Text>
            </Card>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              backgroundColor: t.colors.surface,
              borderTopColor: t.colors.border,
              paddingBottom: Math.max(insets.bottom, t.spacing.md),
            },
          ]}
        >
          <Button
            label={
              belowMinimum
                ? `Minimum ${formatPrice(restaurant.minBasket)}`
                : authed
                  ? "Ödemeye geç"
                  : "Giriş yap ve devam et"
            }
            trailing={
              belowMinimum || !totals ? undefined : formatPrice(totals.grandTotal)
            }
            disabled={belowMinimum}
            size="lg"
            fullWidth
            onPress={() =>
              authed
                ? router.push({
                    pathname: "/odeme",
                    params: applied ? { kupon: applied } : {},
                  })
                : router.push("/giris")
            }
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  line: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  lineEmoji: { fontSize: 26, lineHeight: 32 },
  couponHead: { flexDirection: "row", alignItems: "center", gap: 7 },
  couponRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  couponApplied: { flexDirection: "row", alignItems: "center", gap: 8 },
  footer: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
