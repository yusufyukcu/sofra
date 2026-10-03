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
import { Button } from "@/components/ui/button";
import { Field, Option } from "@/components/ui/input";
import { Header, Screen } from "@/components/ui/screen";
import { Card, Skeleton } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { courierApi, errorMessage } from "@/lib/api";
import { useCourier, type CourierOtpChallenge } from "@/store/courier";
import { useTheme } from "@/theme";

/**
 * Kurye girişi: telefon + SMS doğrulama kodu.
 *
 * SMS sağlayıcısı bağlı değilken (test modu) kod ekranda gösterilir.
 * Demo modunda kurye listesine dokununca numara alanı dolar. Onaylanmamış
 * kurye giriş yapabilir ama mesai açamaz — sunucu bunu ayrıca denetler.
 */

interface PickerItem {
  id: string;
  name: string;
  emoji: string;
  vehicle: "moto" | "bisiklet" | "araba";
  rating: number;
  status: "pending" | "active" | "suspended";
  /** Yalnızca demo modunda gelir */
  phone?: string;
}

const VEHICLE_LABEL = { moto: "Motosiklet", bisiklet: "Bisiklet", araba: "Araç" } as const;

export function CourierLogin() {
  const t = useTheme();
  const startLogin = useCourier((s) => s.startLogin);
  const verifyLogin = useCourier((s) => s.verifyLogin);

  const [demo, setDemo] = useState<PickerItem[] | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<CourierOtpChallenge | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    courierApi
      .get<{ couriers: PickerItem[]; demo: boolean }>("/courier/auth/login")
      .then((data) => setDemo(data.demo ? data.couriers.filter((c) => c.phone) : []))
      .catch(() => setDemo([]));
  }, []);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const data = await startLogin(phone);
      setChallenge(data);
      setSeconds(60);
      // Test modunda kod ekranda; elle yazmaya gerek yok
      setCode(data.devCode ?? "");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!challenge) return;
    setBusy(true);
    setError(null);
    try {
      await verifyLogin(challenge.challengeId, code);
    } catch (err) {
      setError(errorMessage(err));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges="both">
      <Header
        title="Kurye girişi"
        subtitle={challenge ? `${challenge.maskedTarget} numarasına kod gönderildi` : "Telefon numaranla giriş yap"}
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

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.hero, { backgroundColor: t.colors.brandSoft, borderRadius: t.radius.lg }]}>
            <Bike size={24} color={t.colors.brand} />
            <Text variant="small" style={{ flex: 1 }}>
              Mesai açtığında sana en yakın restoranın siparişi 45 saniyelik teklif olarak düşer.
            </Text>
          </View>

          {!challenge ? (
            <>
              <Field
                label="Telefon numarası"
                prefix="+90"
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/\D/g, "").slice(0, 10))}
                keyboardType="phone-pad"
                placeholder="5XX XXX XX XX"
                maxLength={10}
                error={error}
              />
              <Button
                label="Doğrulama kodu gönder"
                onPress={sendCode}
                loading={busy}
                disabled={phone.length !== 10}
                size="lg"
                fullWidth
              />

              {demo === null ? (
                <View style={{ gap: t.spacing.sm }}>
                  <Skeleton height={62} radius={t.radius.md} />
                  <Skeleton height={62} radius={t.radius.md} />
                </View>
              ) : demo.length > 0 ? (
                <View style={{ gap: t.spacing.sm }}>
                  <Text variant="caption" weight="semibold">
                    Demo kuryeler — dokununca numara dolar
                  </Text>
                  {demo.map((courier) => (
                    <Option
                      key={courier.id}
                      title={`${courier.emoji}  ${courier.name}`}
                      subtitle={`${VEHICLE_LABEL[courier.vehicle]} · ${courier.rating.toFixed(1)} puan${courier.status !== "active" ? " · onay bekliyor" : ""}`}
                      selected={phone === courier.phone}
                      onPress={() => setPhone(courier.phone ?? "")}
                    />
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Field
                label="Doğrulama kodu"
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="6 haneli kod"
                error={error}
                autoFocus
              />
              {challenge.devCode ? (
                <Card elevation="none" style={{ backgroundColor: t.colors.saffronSoft, borderColor: t.colors.saffronSoft }}>
                  <Text variant="caption" style={{ color: t.colors.saffron }}>
                    Test modu: SMS gönderilmedi, kod {challenge.devCode}. SMS sağlayıcısı bağlanınca kod telefona gider.
                  </Text>
                </Card>
              ) : null}
              <Button
                label="Mesaiye gir"
                onPress={verify}
                loading={busy}
                disabled={code.length !== 6}
                size="lg"
                fullWidth
              />
              <Button
                label={seconds > 0 ? `Yeni kod (${seconds} sn)` : "Yeni kod gönder"}
                variant="ghost"
                onPress={sendCode}
                disabled={seconds > 0 || busy}
                fullWidth
              />
              <Button
                label="Numarayı değiştir"
                variant="ghost"
                onPress={() => {
                  setChallenge(null);
                  setCode("");
                  setError(null);
                }}
                fullWidth
              />
            </>
          )}
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
