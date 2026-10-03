import { FlaskConical } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  TEST_PAYMENT_CARDS,
  cardBrandOf,
  formatCardNumber,
  luhnValid,
  type SavedCard,
} from "@sofra/core";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Card } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/store/session";
import { useTheme } from "@/theme";

const BRAND_LABEL = { visa: "Visa", mastercard: "Mastercard", troy: "Troy" } as const;

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

/**
 * Kart ekleme formu (ödeme simülasyonu).
 *
 * Gerçek ödeme kuruluşu bağlanana kadar yalnızca test kartları kabul edilir;
 * kart numarası ve güvenlik kodu sunucuda saklanmaz, yalnızca son 4 hane
 * görünür. Test kartı çiplerinden biri seçilince form dolar.
 */
export function AddCardForm({ onAdded }: { onAdded?: (added: SavedCard | undefined) => void }) {
  const t = useTheme();
  const user = useSession((s) => s.user);
  const cards = useSession((s) => s.cards);
  const setCards = useSession((s) => s.setCards);

  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [holder, setHolder] = useState(user?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = number.replace(/\D/g, "");
  const brand = cardBrandOf(digits);
  const ready =
    luhnValid(digits) && !!brand && /^\d{2}\/\d{2}$/.test(expiry) && /^\d{3,4}$/.test(cvc) && holder.trim().length >= 3;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const before = new Set(cards.map((c) => c.id));
      const data = await api.post<{ cards: SavedCard[] }>("/cards", { number: digits, expiry, cvc, holder });
      setCards(data.cards);
      setNumber("");
      setCvc("");
      onAdded?.(data.cards.find((c) => !before.has(c.id)));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: t.spacing.md }}>
      <Card elevation="none" style={{ backgroundColor: t.colors.saffronSoft, borderColor: t.colors.saffronSoft, gap: 8 }}>
        <View style={styles.row}>
          <FlaskConical size={14} color={t.colors.saffron} />
          <Text variant="caption" weight="bold" tone="saffron">
            Ödeme simülasyonu — gerçek kart bilgisi girme
          </Text>
        </View>
        <View style={styles.chips}>
          {TEST_PAYMENT_CARDS.map((card) => (
            <Pressable
              key={card.number}
              accessibilityRole="button"
              onPress={() => {
                setNumber(formatCardNumber(card.number));
                setExpiry("12/30");
                setCvc("123");
                if (!holder.trim()) setHolder(user?.name ?? "Test Kullanıcı");
              }}
              style={({ pressed }) => [
                styles.chip,
                {
                  borderColor: card.outcome === "decline" ? t.colors.danger : t.colors.border,
                  backgroundColor: t.colors.surface,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text variant="caption" weight="semibold" tone={card.outcome === "decline" ? "danger" : "ink"}>
                {card.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Field
        label="Kart numarası"
        value={number}
        onChangeText={(v) => setNumber(formatCardNumber(v))}
        keyboardType="number-pad"
        placeholder="4242 4242 4242 4242"
        right={brand ? <Text variant="caption" weight="bold">{BRAND_LABEL[brand]}</Text> : undefined}
        error={digits.length >= 13 && !luhnValid(digits) ? "Kart numarası hatalı görünüyor." : null}
      />
      <View style={styles.row}>
        <Field
          label="Son kullanma"
          value={expiry}
          onChangeText={(v) => setExpiry(formatExpiry(v))}
          keyboardType="number-pad"
          placeholder="AA/YY"
          containerStyle={{ flex: 1 }}
        />
        <Field
          label="Güvenlik kodu"
          value={cvc}
          onChangeText={(v) => setCvc(v.replace(/\D/g, "").slice(0, 4))}
          keyboardType="number-pad"
          placeholder="123"
          secureTextEntry
          containerStyle={{ flex: 1 }}
        />
      </View>
      <Field label="Kart üzerindeki ad" value={holder} onChangeText={setHolder} maxLength={60} error={error} />
      <Button label="Kartı kaydet" onPress={submit} loading={busy} disabled={!ready} size="lg" fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
});
