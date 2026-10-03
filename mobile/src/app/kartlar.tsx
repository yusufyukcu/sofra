import { router, useLocalSearchParams } from "expo-router";
import { CreditCard, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { SavedCard } from "@sofra/core";
import { AddCardForm } from "@/components/customer/add-card-form";
import { Header, SectionTitle, Screen } from "@/components/ui/screen";
import { Card, Divider } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/store/session";
import { useTheme } from "@/theme";

/**
 * Kayıtlı kartlar: listele, sil, ekle. Ödeme ekranından "kart ekle" ile
 * açıldıysa (`?donus=odeme`) kart eklenince ödemeye geri döner.
 */
export default function CardsScreen() {
  const t = useTheme();
  const { donus } = useLocalSearchParams<{ donus?: string }>();
  const cards = useSession((s) => s.cards);
  const setCards = useSession((s) => s.setCards);
  const [removing, setRemoving] = useState<string | null>(null);

  function confirmRemove(card: SavedCard) {
    Alert.alert("Kartı sil", `${card.brand.toUpperCase()} •••• ${card.last4} silinsin mi?`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          setRemoving(card.id);
          try {
            const data = await api.delete<{ cards: SavedCard[] }>(`/cards/${card.id}`);
            setCards(data.cards);
          } catch (err) {
            Alert.alert("Silinemedi", errorMessage(err));
          } finally {
            setRemoving(null);
          }
        },
      },
    ]);
  }

  return (
    <Screen edges="none">
      <Header title="Kartlarım" back />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.xl, paddingBottom: t.spacing.xxxl }}
          keyboardShouldPersistTaps="handled"
        >
          {cards.length > 0 ? (
            <View>
              <SectionTitle title="Kayıtlı kartlar" />
              <Card style={{ gap: t.spacing.sm }}>
                {cards.map((card, index) => (
                  <View key={card.id}>
                    {index > 0 ? <Divider style={{ marginBottom: 8 }} /> : null}
                    <View style={styles.row}>
                      <CreditCard size={18} color={t.colors.muted} />
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text variant="body" weight="semibold" tone="ink" tabular>
                          {card.brand.toUpperCase()} •••• {card.last4}
                        </Text>
                        <Text variant="caption">
                          {[card.nickname, card.holder, card.expiry].filter(Boolean).join(" · ")}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${card.brand} ${card.last4} kartını sil`}
                        disabled={removing === card.id}
                        onPress={() => confirmRemove(card)}
                        hitSlop={8}
                        style={({ pressed }) => ({ opacity: pressed || removing === card.id ? 0.5 : 1 })}
                      >
                        <Trash2 size={18} color={t.colors.danger} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </Card>
            </View>
          ) : null}

          <View>
            <SectionTitle title="Yeni kart" />
            <AddCardForm
              onAdded={() => {
                if (donus === "odeme" && router.canGoBack()) router.back();
                else Alert.alert("Kart kaydedildi", "Online ödeme ve bakiye yüklemede kullanabilirsin.");
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
});
