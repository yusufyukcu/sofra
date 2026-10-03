import { Phone, PhoneOff, ShieldCheck } from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import { Alert, Linking, Modal, Pressable, StyleSheet, View } from "react-native";
import type { ApiClient } from "@sofra/core";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { errorMessage } from "@/lib/api";
import { useTheme } from "@/theme";

/**
 * Maskeli arama (mobil).
 *
 * Sunucudan geçici bir platform hattı oturumu alınır (sanal numara +
 * dahili kod); gerçek numaralar hiçbir zaman cihaza gelmez. Sesli arama
 * sağlayıcısı bağlıyken telefon uygulaması hattı arar ve dahili kodu
 * otomatik tuşlar (`tel:+90850…,1234`). Test modunda görüşme ekranda
 * simüle edilir ve süresi kaydedilir.
 */

interface CallSession {
  id: string;
  proxyNumber: string;
  extension: string;
  dial: string;
  calleeLabel: string;
  testMode: boolean;
}

function clock(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/** `start` arama oturumunu açar; `sheet` ekrana yerleştirilecek arama penceresidir. */
export function useMaskedCall(client: ApiClient, path: string): {
  start: () => void;
  busy: boolean;
  sheet: ReactNode;
} {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [call, setCall] = useState<CallSession | null>(null);
  const [connected, setConnected] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!call?.testMode) return;
    if (!connected) {
      const timer = setTimeout(() => setConnected(true), 2500);
      return () => clearTimeout(timer);
    }
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, [call, connected]);

  async function start() {
    setBusy(true);
    try {
      const data = await client.post<{ call: CallSession }>(path, { action: "start" });
      setSeconds(0);
      setConnected(false);
      setCall(data.call);
    } catch (err) {
      Alert.alert("Arama başlatılamadı", errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (call?.testMode) {
      void client
        .post(path, { action: "end", sessionId: call.id, durationSeconds: connected ? seconds : 0 })
        .catch(() => undefined);
    }
    setCall(null);
  }

  const sheet = (
    <Modal visible={call !== null} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Kapat" />
      {call ? (
        <View
          style={[
            styles.sheet,
            { backgroundColor: t.colors.surface, padding: t.spacing.xl, gap: t.spacing.md },
          ]}
        >
          <Text variant="label" tone="brand" center>
            {call.testMode ? "Arama simülasyonu" : "Maskeli hat"}
          </Text>
          <Text variant="title" center>
            {call.calleeLabel}
          </Text>
          <View
            style={[
              styles.badge,
              { backgroundColor: connected ? t.colors.pistachioSoft : t.colors.surface2 },
            ]}
          >
            <Text style={{ fontSize: 34 }}>📞</Text>
          </View>
          <Text variant="heading" center tabular>
            {call.testMode ? (connected ? clock(seconds) : "Çalıyor…") : call.proxyNumber}
          </Text>
          <View style={[styles.info, { backgroundColor: t.colors.surface2, borderRadius: t.radius.md }]}>
            <Text variant="small" tabular>
              Platform hattı <Text variant="small" weight="bold" tone="ink">{call.proxyNumber}</Text>
            </Text>
            <Text variant="small" tabular>
              Dahili kod <Text variant="small" weight="bold" tone="ink">{call.extension}</Text>
              {call.testMode ? "" : " (otomatik tuşlanır)"}
            </Text>
          </View>
          <View style={styles.note}>
            <ShieldCheck size={16} color={t.colors.pistachio} />
            <Text variant="caption" style={{ flex: 1 }}>
              {call.testMode
                ? "Test modu: gerçek arama yapılmaz. Sesli arama sağlayıcısı bağlandığında bu düğme platform hattını arar; iki taraf da birbirinin numarasını görmez."
                : "İki taraf da yalnızca platform hattını görür. Hat, sipariş kapanınca kullanılamaz."}
            </Text>
          </View>
          {call.testMode ? (
            <Button
              label="Görüşmeyi bitir"
              variant="danger"
              size="lg"
              fullWidth
              icon={<PhoneOff size={18} color="#fff" />}
              onPress={close}
            />
          ) : (
            <>
              <Button
                label="Platform hattını ara"
                size="lg"
                fullWidth
                icon={<Phone size={18} color={t.colors.brandContrast} />}
                onPress={() =>
                  Linking.openURL(call.dial).catch(() =>
                    Alert.alert("Arama yapılamadı", "Bu cihaz telefon araması yapamıyor.")
                  )
                }
              />
              <Button label="Kapat" variant="ghost" fullWidth onPress={close} />
            </>
          )}
        </View>
      ) : null}
    </Modal>
  );

  return { start: () => void start(), busy, sheet };
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  badge: {
    alignSelf: "center",
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { padding: 12, gap: 2 },
  note: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
});
