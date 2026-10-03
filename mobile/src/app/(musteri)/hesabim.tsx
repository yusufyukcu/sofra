import { router } from "expo-router";
import {
  Bell,
  Bike,
  ChevronRight,
  CreditCard,
  Headset,
  Heart,
  LogOut,
  MapPin,
  Plus,
  Wallet,
} from "lucide-react-native";
import type { ReactNode } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { formatPhone, formatPrice } from "@sofra/core";
import { CartBar } from "@/components/customer/cart-bar";
import { Button } from "@/components/ui/button";
import { Header, SectionTitle, Screen } from "@/components/ui/screen";
import { Badge, Card, Divider, EmptyState } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { API_BASE_URL } from "@/lib/api";
import { deliveryLabel, useSession } from "@/store/session";
import { useTheme } from "@/theme";

/**
 * Hesabım.
 *
 * Cüzdan, adresler (seçme ve ekleme), kartlar, bildirimler, canlı destek
 * ve kurye moduna geçiş.
 *
 * "Kurye modu" bu uygulamanın ikinci yüzü: aynı binary içinde ayrı oturum,
 * ayrı token ve ayrı uç noktalar. Müşteri oturumu açıkken de kurye olarak
 * giriş yapılabilir, ikisi birbirini düşürmez.
 */

export default function AccountScreen() {
  const t = useTheme();

  const status = useSession((s) => s.status);
  const user = useSession((s) => s.user);
  const addresses = useSession((s) => s.addresses);
  const cards = useSession((s) => s.cards);
  const label = useSession(deliveryLabel);
  const selectedAddressId = useSession((s) => s.selectedAddressId);
  const selectAddress = useSession((s) => s.selectAddress);
  const logout = useSession((s) => s.logout);

  if (status !== "authenticated" || !user) {
    return (
      <Screen>
        <Header title="Hesabım" large />
        <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg }}>
          <EmptyState
            emoji="👋"
            title="Hesabına gir"
            description="Adreslerin, cüzdanın ve sipariş geçmişin bir arada."
            action={<Button label="Giriş yap" onPress={() => router.push("/giris")} />}
          />
          <CourierCard />
          <ServerCard />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Hesabım" large subtitle={label} />

      <ScrollView
        contentContainerStyle={{
          padding: t.spacing.lg,
          gap: t.spacing.xl,
          paddingBottom: 110,
        }}
      >
        {/* Profil + cüzdan */}
        <Card style={{ gap: t.spacing.md }}>
          <View style={styles.profile}>
            <Text style={styles.avatar}>{user.avatarEmoji}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="title">{user.name}</Text>
              <Text variant="caption" tabular>
                {user.phone ? formatPhone(user.phone) : user.email}
              </Text>
            </View>
          </View>

          <Divider />

          <View style={styles.wallet}>
            <View style={styles.walletLeft}>
              <View
                style={[
                  styles.walletIcon,
                  { backgroundColor: t.colors.pistachioSoft },
                ]}
              >
                <Wallet size={18} color={t.colors.pistachio} />
              </View>
              <View style={{ gap: 1 }}>
                <Text variant="caption">Sofra Cüzdan</Text>
                <Text variant="heading" tabular>
                  {formatPrice(user.walletBalance)}
                </Text>
              </View>
            </View>
            <Badge
              label={`${user.favoriteRestaurantIds.length} favori`}
              tone="brand"
              icon={<Heart size={11} color={t.colors.brand} />}
            />
          </View>
        </Card>

        {/* Adresler */}
        <View>
          <SectionTitle title="Adreslerim" />
          <View style={{ gap: t.spacing.sm }}>
            {addresses.map((address) => {
              const selected = address.id === selectedAddressId;
              return (
                <Card
                  key={address.id}
                  onPress={() => selectAddress(address.id)}
                  style={[
                    styles.address,
                    selected && {
                      borderColor: t.colors.brand,
                      borderWidth: 1.4,
                      backgroundColor: t.colors.brandSoft,
                    },
                  ]}
                >
                  <MapPin
                    size={18}
                    color={selected ? t.colors.brand : t.colors.muted}
                  />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text variant="body" weight="semibold" tone="ink">
                      {address.title} · {address.district}
                    </Text>
                    <Text variant="caption" numberOfLines={2}>
                      {address.line1}
                    </Text>
                  </View>
                  {selected ? <Badge label="Seçili" tone="brand" /> : null}
                </Card>
              );
            })}

            {addresses.length === 0 ? (
              <Card>
                <Text variant="small">Kayıtlı adresin yok.</Text>
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

        {/* Kısayollar */}
        <Card style={{ gap: t.spacing.sm }}>
          <LinkRow icon={<Bell size={18} color={t.colors.muted} />} label="Bildirimler" onPress={() => router.push("/bildirimler")} />
          <Divider />
          <LinkRow icon={<CreditCard size={18} color={t.colors.muted} />} label="Kartlarım" onPress={() => router.push("/kartlar")} />
          <Divider />
          <LinkRow icon={<Headset size={18} color={t.colors.muted} />} label="Canlı destek" onPress={() => router.push("/destek")} />
        </Card>

        {/* Kartlar */}
        {cards.length ? (
          <View>
            <SectionTitle title="Kayıtlı kartlar" />
            <Card style={{ gap: t.spacing.sm }}>
              {cards.map((card, index) => (
                <View key={card.id}>
                  {index > 0 ? <Divider style={{ marginBottom: 8 }} /> : null}
                  <View style={styles.card}>
                    <CreditCard size={18} color={t.colors.muted} />
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text variant="body" weight="semibold" tone="ink" tabular>
                        {card.brand.toUpperCase()} •••• {card.last4}
                      </Text>
                      <Text variant="caption">
                        {card.nickname} · {card.expiry}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        <CourierCard />
        <ServerCard />

        <Button
          label="Çıkış yap"
          variant="danger"
          icon={<LogOut size={17} color={t.colors.danger} />}
          onPress={() =>
            Alert.alert("Çıkış yap", "Oturumunu kapatmak istiyor musun?", [
              { text: "Vazgeç", style: "cancel" },
              {
                text: "Çıkış yap",
                style: "destructive",
                onPress: () => void logout(),
              },
            ])
          }
          fullWidth
        />
      </ScrollView>

      <CartBar />
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function LinkRow({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, { opacity: pressed ? 0.6 : 1 }]}
    >
      {icon}
      <Text variant="body" weight="semibold" tone="ink" style={{ flex: 1 }}>
        {label}
      </Text>
      <ChevronRight size={18} color={t.colors.muted} />
    </Pressable>
  );
}

/** Kurye moduna geçiş — aynı uygulamanın ikinci yüzü. */
function CourierCard() {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push("/kurye")}
      style={({ pressed }) => [
        styles.courier,
        {
          backgroundColor: t.colors.deep,
          borderRadius: t.radius.lg,
          opacity: pressed ? 0.92 : 1,
        },
        t.shadow.md,
      ]}
    >
      <View
        style={[styles.courierIcon, { backgroundColor: t.colors.deep3 }]}
      >
        <Bike size={20} color={t.colors.onDeep} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" weight="semibold" style={{ color: t.colors.onDeep }}>
          Kurye modu
        </Text>
        <Text variant="caption" style={{ color: t.colors.onDeepMuted }}>
          Mesai aç, teklif al, teslimatı yönet
        </Text>
      </View>
      <ChevronRight size={20} color={t.colors.onDeepMuted} />
    </Pressable>
  );
}

/** Hangi sunucuya bağlı olduğumuz — geliştirirken en çok sorulan soru. */
function ServerCard() {
  const t = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text variant="label">Bağlı sunucu</Text>
      <Text variant="caption" tabular>
        {API_BASE_URL}
      </Text>
      <Text variant="caption">
        Farklı bir adrese bağlanmak için `EXPO_PUBLIC_SOFRA_API` ayarla.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  linkRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  profile: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { fontSize: 38, lineHeight: 46 },
  wallet: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  walletLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  walletIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  address: { flexDirection: "row", alignItems: "center", gap: 12 },
  card: { flexDirection: "row", alignItems: "center", gap: 12 },
  courier: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  courierIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
});
