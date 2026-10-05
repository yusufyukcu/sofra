import { router, useLocalSearchParams } from "expo-router";
import { MapPin, Plus } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MEAL_CARD_BRANDS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_ICONS,
  PAYMENT_ORDER,
  formatPrice,
  type DeliveryPreferences,
  type MealCardBrand,
  type Order,
  type OrderTotals,
  type PaymentMethodId,
} from "@sofra/core";
import { Button } from "@/components/ui/button";
import { Field, Option } from "@/components/ui/input";
import { Header, SectionTitle, Screen } from "@/components/ui/screen";
import { Card, Divider, Row, Skeleton } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { api, errorMessage } from "@/lib/api";
import { useCart } from "@/store/cart";
import { useSession } from "@/store/session";
import { useTheme } from "@/theme";

/**
 * Ödeme.
 *
 * Adres → ödeme yöntemi → teslimat tercihleri → sipariş. Tutar her adımda
 * sunucudan yeniden istenir; ödeme yöntemi değişince cüzdan kullanımı da
 * değiştiği için tutarın istemcide hesaplanması doğru olmazdı.
 *
 * Sipariş oluşturulurken sunucu menüyü, fiyatları, minimum sepeti, teslimat
 * bölgesini, kuponu ve ödeme yöntemini yeniden doğrular.
 */

interface TotalsResponse {
  totals: OrderTotals;
  meetsMinBasket: boolean;
  minBasket: number;
}

const DEFAULT_PREFS: DeliveryPreferences = {
  contactless: false,
  ringDoorbell: true,
  cutlery: true,
};

export default function CheckoutScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { kupon } = useLocalSearchParams<{ kupon?: string }>();

  const restaurant = useCart((s) => s.restaurant);
  const lines = useCart((s) => s.lines);
  const clearCart = useCart((s) => s.clear);

  const user = useSession((s) => s.user);
  const addresses = useSession((s) => s.addresses);
  const cards = useSession((s) => s.cards);
  const selectedAddressId = useSession((s) => s.selectedAddressId);
  const selectAddress = useSession((s) => s.selectAddress);
  const refresh = useSession((s) => s.refresh);

  const [payment, setPayment] = useState<PaymentMethodId>("online_card");
  const [mealCard, setMealCard] = useState<MealCardBrand>("multinet");
  const [cardId, setCardId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<DeliveryPreferences>(DEFAULT_PREFS);
  const [note, setNote] = useState("");

  const [quote, setQuote] = useState<TotalsResponse | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addressId = selectedAddressId ?? addresses[0]?.id ?? null;
  const restaurantId = restaurant?.id;

  useEffect(() => {
    if (!cardId && cards.length) setCardId(cards[0].id);
  }, [cards, cardId]);

  // Ödeme yöntemi değişince toplam da değişir (cüzdan kullanımı).
  const quoteTotals = useCallback(async () => {
    if (!restaurantId || lines.length === 0) return;
    try {
      setQuote(
        await api.post<TotalsResponse>("/coupons/validate", {
          restaurantId,
          lines,
          code: kupon,
          paymentMethod: payment,
        })
      );
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [restaurantId, lines, kupon, payment]);

  useEffect(() => {
    void quoteTotals();
  }, [quoteTotals]);

  // Sepet boşsa ödeme ekranının anlamı yok. Yönlendirme render sırasında
  // değil efektte yapılır; aksi halde React "başka bir bileşen render
  // edilirken durum güncellendi" uyarısı verir.
  const cartEmpty = !restaurant || lines.length === 0;
  useEffect(() => {
    if (cartEmpty) router.replace("/sepet");
  }, [cartEmpty]);

  if (cartEmpty) {
    return (
      <Screen>
        <View />
      </Screen>
    );
  }

  const totals = quote?.totals ?? null;
  const method = PAYMENT_METHODS[payment];
  const walletShort =
    payment === "wallet" &&
    totals !== null &&
    (user?.walletBalance ?? 0) < totals.grandTotal;

  async function placeOrder() {
    if (!addressId) {
      setError("Önce bir teslimat adresi seç.");
      return;
    }
    setPlacing(true);
    setError(null);
    try {
      const data = await api.post<{ order: Order }>("/orders", {
        restaurantId: restaurant!.id,
        addressId,
        lines,
        couponCode: kupon,
        paymentMethod: payment,
        mealCardBrand: payment === "meal_card" ? mealCard : undefined,
        cardId: payment === "online_card" ? (cardId ?? undefined) : undefined,
        preferences: { ...prefs, note: note.trim() || undefined },
      });
      clearCart();
      await refresh();
      router.replace(`/siparis/${data.order.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPlacing(false);
    }
  }

  return (
    <Screen edges="none">
      <Header title="Ödeme" subtitle={restaurant.name} back />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            padding: t.spacing.lg,
            gap: t.spacing.xl,
            paddingBottom: t.spacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Adres */}
          <View>
            <SectionTitle title="Teslimat adresi" />
            <View style={{ gap: t.spacing.sm }}>
              {addresses.map((address) => (
                <Option
                  key={address.id}
                  title={`${address.title} · ${address.district}`}
                  subtitle={address.line1}
                  selected={addressId === address.id}
                  onPress={() => selectAddress(address.id)}
                  left={<MapPin size={17} color={t.colors.muted} />}
                />
              ))}
              {addresses.length === 0 ? (
                <Card
                  elevation="none"
                  style={{
                    backgroundColor: t.colors.dangerSoft,
                    borderColor: t.colors.dangerSoft,
                  }}
                >
                  <Text variant="small" tone="danger" weight="semibold">
                    Kayıtlı adresin yok
                  </Text>
                  <Text variant="caption" style={{ marginTop: 2 }}>
                    Teslimat için bir adres ekle.
                  </Text>
                </Card>
              ) : null}
              <Button
                label="Yeni adres ekle"
                variant="secondary"
                icon={<Plus size={16} color={t.colors.ink} />}
                onPress={() => router.push("/adres-ekle")}
                fullWidth
              />
            </View>
          </View>

          {/* Ödeme yöntemi */}
          <View>
            <SectionTitle title="Ödeme yöntemi" />
            <View style={{ gap: t.spacing.sm }}>
              {PAYMENT_ORDER.map((id) => {
                const m = PAYMENT_METHODS[id];
                return (
                  <Option
                    key={id}
                    title={m.name}
                    icon={PAYMENT_METHOD_ICONS[id]}
                    subtitle={
                      id === "wallet"
                        ? `Bakiye ${formatPrice(user?.walletBalance ?? 0)}`
                        : m.description
                    }
                    selected={payment === id}
                    onPress={() => setPayment(id)}
                  />
                );
              })}
            </View>

            {payment === "meal_card" ? (
              <View style={{ gap: t.spacing.sm, marginTop: t.spacing.sm }}>
                {MEAL_CARD_BRANDS.map((brand) => (
                  <Option
                    key={brand.id}
                    title={brand.name}
                    selected={mealCard === brand.id}
                    onPress={() => setMealCard(brand.id)}
                  />
                ))}
              </View>
            ) : null}

            {payment === "online_card" && cards.length === 0 ? (
              <Card
                elevation="none"
                style={{ marginTop: t.spacing.sm, gap: t.spacing.sm, backgroundColor: t.colors.surface2, borderColor: t.colors.border }}
              >
                <Text variant="small">Online ödeme için kayıtlı kartın yok.</Text>
                <Button
                  label="Kart ekle"
                  size="sm"
                  icon={<Plus size={15} color={t.colors.brandContrast} />}
                  onPress={() => router.push({ pathname: "/kartlar", params: { donus: "odeme" } })}
                />
              </Card>
            ) : null}

            {payment === "online_card" && cards.length ? (
              <View style={{ gap: t.spacing.sm, marginTop: t.spacing.sm }}>
                {cards.map((card) => (
                  <Option
                    key={card.id}
                    title={`${card.brand.toUpperCase()} •••• ${card.last4}`}
                    subtitle={card.nickname}
                    selected={cardId === card.id}
                    onPress={() => setCardId(card.id)}
                  />
                ))}
              </View>
            ) : null}

            {walletShort ? (
              <Card
                elevation="none"
                style={{
                  marginTop: t.spacing.sm,
                  backgroundColor: t.colors.dangerSoft,
                  borderColor: t.colors.dangerSoft,
                }}
              >
                <Text variant="small" tone="danger" weight="semibold">
                  Cüzdan bakiyen yetmiyor
                </Text>
                <Text variant="caption" style={{ marginTop: 2 }}>
                  Kalan tutar için başka bir yöntem seç.
                </Text>
              </Card>
            ) : null}
          </View>

          {/* Teslimat tercihleri */}
          <View>
            <SectionTitle title="Teslimat tercihleri" />
            <Card style={{ gap: t.spacing.sm }}>
              <Toggle
                label="Temassız teslimat"
                hint="Kurye kapıya bırakır"
                value={prefs.contactless}
                onChange={(v) => setPrefs({ ...prefs, contactless: v })}
              />
              <Divider />
              <Toggle
                label="Zili çal"
                value={prefs.ringDoorbell}
                onChange={(v) => setPrefs({ ...prefs, ringDoorbell: v })}
              />
              <Divider />
              <Toggle
                label="Çatal bıçak gelsin"
                value={prefs.cutlery}
                onChange={(v) => setPrefs({ ...prefs, cutlery: v })}
              />
            </Card>

            <Field
              containerStyle={{ marginTop: t.spacing.sm }}
              label="Kurye notu"
              placeholder="Ör. apartman kapısı şifreli, 1234"
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={200}
            />
          </View>

          {/* Özet */}
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
                />
                <Row label="Hizmet bedeli" value={formatPrice(totals.serviceFee)} />
                {totals.discount > 0 ? (
                  <Row
                    label="İndirim"
                    value={`−${formatPrice(totals.discount)}`}
                    tone="pistachio"
                  />
                ) : null}
                {totals.walletUsed > 0 ? (
                  <Row
                    label="Cüzdandan"
                    value={`−${formatPrice(totals.walletUsed)}`}
                    tone="pistachio"
                  />
                ) : null}
                <Divider style={{ marginVertical: 6 }} />
                <Row
                  label={method.onDelivery ? "Kapıda ödenecek" : "Toplam"}
                  value={formatPrice(totals.grandTotal)}
                  strong
                />
              </>
            ) : (
              <View style={{ gap: 10 }}>
                <Skeleton height={14} width="55%" />
                <Skeleton height={14} width="40%" />
                <Skeleton height={20} width="65%" />
              </View>
            )}
          </Card>

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
            label="Siparişi ver"
            trailing={totals ? formatPrice(totals.grandTotal) : undefined}
            onPress={placeOrder}
            loading={placing}
            disabled={!addressId || !totals || walletShort || (payment === "online_card" && cards.length === 0)}
            size="lg"
            fullWidth
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="body" tone="ink">
          {label}
        </Text>
        {hint ? <Text variant="caption">{hint}</Text> : null}
      </View>
      <Button
        label={value ? "Açık" : "Kapalı"}
        size="sm"
        variant={value ? "primary" : "secondary"}
        onPress={() => onChange(!value)}
        noHaptics
        style={{ minWidth: 76 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  footer: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
