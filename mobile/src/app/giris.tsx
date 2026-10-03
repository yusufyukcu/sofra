import { router } from "expo-router";
import { Apple, Globe, Sparkles } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import type { Address, User } from "@sofra/core";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Header, Screen } from "@/components/ui/screen";
import { Divider, Card } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/store/session";
import { useTheme } from "@/theme";

/**
 * Giriş.
 *
 * Üç yol var, üçü de web ile aynı uç noktaları kullanır: telefon + OTP,
 * sosyal giriş ve demo hesabı. Girişte sunucu erişim + yenileme token'ı
 * döndürür; mobil ikisini cihazın güvenli alanına yazar (web çerezde taşır).
 *
 * Prototipte doğrulama kodu cevapta `devCode` ile geliyor ve ekranda
 * gösteriliyor — gerçek sistemde SMS ile gider ve bu alan kaldırılır.
 */

interface AuthPayload {
  user: User;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number | null;
  addresses?: Address[];
  isNewUser?: boolean;
}

interface OtpChallenge {
  challengeId: string;
  maskedTarget: string;
  expiresInSeconds: number;
  devCode?: string;
}

export default function LoginScreen() {
  const t = useTheme();
  const applyAuth = useSession((s) => s.applyAuth);

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Demo hesabı yalnızca demo (sunum) modunda gösterilir
  const [demoEnabled, setDemoEnabled] = useState(false);

  useEffect(() => {
    api
      .get<{ demoMode: boolean }>("/config")
      .then((config) => setDemoEnabled(config.demoMode))
      .catch(() => setDemoEnabled(false));
  }, []);

  const codeRef = useRef<string>("");
  codeRef.current = code;

  // Kod geçerlilik süresi — sayaç sıfırlanınca yeniden gönder açılır.
  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  async function finish(payload: AuthPayload) {
    await applyAuth(payload);
    // Giriş ekranı derin bağlantıyla doğrudan açılmış olabilir; o durumda
    // geri gidilecek bir ekran yok.
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  async function startOtp() {
    setBusy("otp");
    setError(null);
    try {
      const data = await api.post<OtpChallenge>("/auth/otp/start", {
        channel: "phone",
        target: phone,
      });
      setChallenge(data);
      setRemaining(data.expiresInSeconds);
      // Prototipte kod ekranda gösteriliyor; kullanıcı elle yazmasın.
      if (data.devCode) setCode(data.devCode);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function verifyOtp() {
    if (!challenge) return;
    setBusy("verify");
    setError(null);
    try {
      const data = await api.post<AuthPayload>("/auth/otp/verify", {
        challengeId: challenge.challengeId,
        code: codeRef.current,
      });
      await finish(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function social(provider: "google" | "apple") {
    setBusy(provider);
    setError(null);
    try {
      await finish(await api.post<AuthPayload>("/auth/social", { provider }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function demo() {
    setBusy("demo");
    setError(null);
    try {
      await finish(await api.post<AuthPayload>("/auth/demo", {}));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen edges="both">
      <Header
        title={challenge ? "Kodu gir" : "Giriş yap"}
        subtitle={
          challenge
            ? challenge.maskedTarget
            : "Sipariş vermek için hesabına gir"
        }
        back
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          {challenge ? (
            <View style={{ gap: t.spacing.md }}>
              <Field
                label="Doğrulama kodu"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                placeholder="6 haneli kod"
                error={error}
              />

              {challenge.devCode ? (
                <Card
                  style={{ backgroundColor: t.colors.saffronSoft, borderColor: t.colors.saffronSoft }}
                  elevation="none"
                >
                  <Text variant="small" style={{ color: t.colors.saffron }}>
                    Prototip: kod SMS yerine cevapta dönüyor ve sizin için
                    dolduruldu ({challenge.devCode}). Gerçek sistemde bu alan
                    kaldırılır.
                  </Text>
                </Card>
              ) : null}

              <Button
                label="Doğrula ve gir"
                onPress={verifyOtp}
                loading={busy === "verify"}
                disabled={code.length < 4}
                fullWidth
                size="lg"
              />

              <Pressable
                onPress={remaining > 0 ? undefined : startOtp}
                style={{ alignSelf: "center", padding: 8 }}
              >
                <Text
                  variant="small"
                  weight="semibold"
                  tone={remaining > 0 ? "muted" : "brand"}
                  tabular
                >
                  {remaining > 0
                    ? `Yeniden gönder (${remaining} sn)`
                    : "Kodu yeniden gönder"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setChallenge(null);
                  setCode("");
                  setError(null);
                }}
                style={{ alignSelf: "center", padding: 4 }}
              >
                <Text variant="small" tone="muted">
                  Numarayı değiştir
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: t.spacing.md }}>
              <Field
                label="Cep telefonu"
                prefix="+90"
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/\D/g, "").slice(0, 10))}
                keyboardType="phone-pad"
                placeholder="5XX XXX XX XX"
                maxLength={10}
                error={error}
                hint="Doğrulama kodu gönderilecek"
              />

              <Button
                label="Kod gönder"
                onPress={startOtp}
                loading={busy === "otp"}
                disabled={phone.length < 10}
                fullWidth
                size="lg"
              />

              <View style={styles.or}>
                <Divider style={{ flex: 1 }} />
                <Text variant="caption">veya</Text>
                <Divider style={{ flex: 1 }} />
              </View>

              <Button
                label="Google ile devam et"
                variant="secondary"
                onPress={() => social("google")}
                loading={busy === "google"}
                icon={<Globe size={17} color={t.colors.ink} />}
                fullWidth
              />
              <Button
                label="Apple ile devam et"
                variant="secondary"
                onPress={() => social("apple")}
                loading={busy === "apple"}
                icon={<Apple size={17} color={t.colors.ink} />}
                fullWidth
              />

              {demoEnabled ? (
              <Card
                style={{
                  backgroundColor: t.colors.brandSoft,
                  borderColor: t.colors.brandSoft,
                  gap: t.spacing.sm,
                }}
                elevation="none"
              >
                <Text variant="small" weight="semibold" tone="brand">
                  Hızlıca denemek ister misin?
                </Text>
                <Text variant="caption">
                  Demo hesabı hazır adresler, kayıtlı kart ve 450 ₺ bakiyeyle
                  açılır.
                </Text>
                <Button
                  label="Demo hesabıyla gir"
                  onPress={demo}
                  loading={busy === "demo"}
                  icon={<Sparkles size={16} color={t.colors.brandContrast} />}
                  fullWidth
                />
              </Card>
              ) : null}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  or: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 2 },
});
