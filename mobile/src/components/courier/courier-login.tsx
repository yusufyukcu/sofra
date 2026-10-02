import { router } from "expo-router";
import { ArrowLeft, Bike } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import type { CourierSummary } from "@sofra/core";
import { Button } from "@/components/ui/button";
import { Field, Option } from "@/components/ui/input";
import { Header, Screen } from "@/components/ui/screen";
import { Card, Skeleton } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { courierApi, errorMessage } from "@/lib/api";
import { useCourier } from "@/store/courier";
import { useTheme } from "@/theme";

/**
 * Kurye girişi.
 *
 * Prototipte kurye listeden seçilir ve ortak PIN ile girilir; gerçek
 * sistemde telefon + OTP ve kimlik doğrulaması olur. Onaylanmamış kurye
 * giriş yapabilir ama mesai açamaz — sunucu `courier_not_active` döner.
 */

export function CourierLogin() {
  const t = useTheme();
  const login = useCourier((s) => s.login);

  const [couriers, setCouriers] = useState<CourierSummary[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    courierApi
      .get<{ couriers: CourierSummary[] }>("/courier/auth/login")
      .then((data) => {
        setCouriers(data.couriers);
        setSelected(data.couriers[0]?.id ?? null);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function submit() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await login(selected, pin);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges="both">
      <Header
        title="Kurye girişi"
        subtitle="Mesaiye başlamak için hesabını seç"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Müşteri uygulamasına dön"
            onPress={() => router.replace("/")}
            hitSlop={10}
            style={({ pressed }) => [
              styles.exit,
              { backgroundColor: t.colors.deep2, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <ArrowLeft size={18} color={t.colors.onDeep} />
          </Pressable>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.hero,
              { backgroundColor: t.colors.brandSoft, borderRadius: t.radius.lg },
            ]}
          >
            <Bike size={24} color={t.colors.brand} />
            <Text variant="small" style={{ flex: 1 }}>
              Mesai açtığında sana en yakın restoranın siparişi 45 saniyelik
              teklif olarak düşer.
            </Text>
          </View>

          {couriers === null ? (
            <View style={{ gap: t.spacing.sm }}>
              <Skeleton height={62} radius={t.radius.md} />
              <Skeleton height={62} radius={t.radius.md} />
              <Skeleton height={62} radius={t.radius.md} />
            </View>
          ) : (
            <View style={{ gap: t.spacing.sm }}>
              {couriers.map((courier) => (
                <Option
                  key={courier.id}
                  title={`${courier.emoji}  ${courier.name}`}
                  subtitle={`${courier.vehicle} · ${courier.rating.toFixed(1)} puan`}
                  selected={selected === courier.id}
                  onPress={() => setSelected(courier.id)}
                />
              ))}
            </View>
          )}

          <Field
            label="PIN"
            value={pin}
            onChangeText={(v) => setPin(v.replace(/\D/g, "").slice(0, 6))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            placeholder="4 haneli PIN"
            error={error}
          />

          <Card
            elevation="none"
            style={{
              backgroundColor: t.colors.saffronSoft,
              borderColor: t.colors.saffronSoft,
            }}
          >
            <Text variant="caption" style={{ color: t.colors.saffron }}>
              Prototip: tüm kuryelerin PIN'i 1234. Gerçek sistemde telefon +
              OTP ve kimlik doğrulaması olur.
            </Text>
          </Card>

          <Button
            label="Mesaiye gir"
            onPress={submit}
            loading={busy}
            disabled={!selected || pin.length < 4}
            size="lg"
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  exit: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
});
