import { router, useFocusEffect } from "expo-router";
import { RotateCcw, Star } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, View } from "react-native";
import {
  ORDER_STATUS_META,
  formatDateTime,
  formatPrice,
  type CartLine,
  type CartRestaurantMeta,
  type Order,
} from "@sofra/core";
import { CartBar } from "@/components/customer/cart-bar";
import { Button } from "@/components/ui/button";
import { Header, Screen } from "@/components/ui/screen";
import { Badge, Card, EmptyState, Skeleton } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { api, errorMessage } from "@/lib/api";
import { useCart } from "@/store/cart";
import { useSession } from "@/store/session";
import { useTheme } from "@/theme";

/**
 * Siparişlerim.
 *
 * Aktif siparişler üstte ve vurgulu; geçmiş altında. Ekran her açıldığında
 * yenilenir (`useFocusEffect`) çünkü kullanıcı sipariş takibinden geri
 * döndüğünde listenin güncel olmasını bekler.
 */

export default function OrdersScreen() {
  const t = useTheme();
  const authed = useSession((s) => s.status === "authenticated");
  const setLines = useCart((s) => s.setLines);

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!authed) {
      setOrders([]);
      return;
    }
    try {
      const data = await api.get<{ orders: Order[] }>("/orders");
      setOrders(data.orders);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
      setOrders([]);
    }
  }, [authed]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function reorder(order: Order) {
    try {
      const data = await api.post<{
        restaurant: CartRestaurantMeta;
        lines: CartLine[];
        removed: string[];
      }>(`/orders/${order.id}/reorder`, {});

      setLines(data.restaurant, data.lines);

      // Menüden kalkan ürün varsa sessizce yutma — kullanıcı neyin
      // eksildiğini bilsin.
      if (data.removed.length) {
        Alert.alert(
          "Bazı ürünler eklenemedi",
          `Şu an satışta olmayanlar: ${data.removed.join(", ")}`
        );
      }
      router.push("/sepet");
    } catch (err) {
      Alert.alert("Tekrarlanamadı", errorMessage(err));
    }
  }

  if (!authed) {
    return (
      <Screen>
        <Header title="Siparişlerim" large />
        <EmptyState
          emoji="🧾"
          title="Siparişlerini görmek için giriş yap"
          description="Geçmiş siparişlerin, tekrar sipariş ve değerlendirme burada."
          action={<Button label="Giriş yap" onPress={() => router.push("/giris")} />}
        />
      </Screen>
    );
  }

  const active =
    orders?.filter(
      (o) => o.status !== "delivered" && o.status !== "cancelled"
    ) ?? [];
  const past =
    orders?.filter(
      (o) => o.status === "delivered" || o.status === "cancelled"
    ) ?? [];

  return (
    <Screen>
      <Header
        title="Siparişlerim"
        large
        subtitle={
          active.length ? `${active.length} sipariş devam ediyor` : undefined
        }
      />

      <FlatList
        data={[...active, ...past]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: t.spacing.lg,
          gap: t.spacing.md,
          paddingBottom: 110,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={t.colors.brand}
          />
        }
        renderItem={({ item, index }) => (
          <>
            {index === active.length && active.length > 0 ? (
              <Text variant="label" style={{ marginTop: t.spacing.sm }}>
                Geçmiş siparişler
              </Text>
            ) : null}
            <OrderCard
              order={item}
              live={index < active.length}
              onReorder={() => reorder(item)}
            />
          </>
        )}
        ListEmptyComponent={
          orders === null ? (
            <View style={{ gap: t.spacing.md }}>
              <Skeleton height={120} radius={t.radius.lg} />
              <Skeleton height={120} radius={t.radius.lg} />
            </View>
          ) : error ? (
            <EmptyState emoji="📡" title="Liste yüklenemedi" description={error} />
          ) : (
            <EmptyState
              emoji="🍽️"
              title="Henüz siparişin yok"
              description="İlk siparişini verdiğinde burada takip edebilirsin."
              action={
                <Button label="Restoranlara göz at" onPress={() => router.push("/")} />
              }
            />
          )
        }
      />

      <CartBar />
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function OrderCard({
  order,
  live,
  onReorder,
}: {
  order: Order;
  live: boolean;
  onReorder: () => void;
}) {
  const t = useTheme();
  const meta = ORDER_STATUS_META[order.status];

  const tone =
    order.status === "cancelled"
      ? "danger"
      : order.status === "delivered"
        ? "pistachio"
        : "brand";

  return (
    <Card
      onPress={() => router.push(`/siparis/${order.id}`)}
      elevation={live ? "md" : "sm"}
      style={[
        { gap: t.spacing.sm },
        live && { borderColor: t.colors.brand, borderWidth: 1.4 },
      ]}
    >
      <View style={styles.head}>
        <Text style={styles.emoji}>{order.restaurantEmoji}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="body" weight="semibold" tone="ink" numberOfLines={1}>
            {order.restaurantName}
          </Text>
          <Text variant="caption" tabular>
            {formatDateTime(order.createdAt)} · {order.code}
          </Text>
        </View>
        <Badge label={`${meta.emoji} ${meta.label}`} tone={tone} />
      </View>

      <Text variant="caption" numberOfLines={2}>
        {order.lines
          .map((l) => `${l.quantity}× ${l.name}`)
          .join(", ")}
      </Text>

      <View style={styles.foot}>
        <Text variant="bodyLarge" weight="semibold" tone="ink" tabular>
          {formatPrice(order.totals.grandTotal)}
        </Text>

        <View style={styles.actions}>
          {order.status === "delivered" && !order.rating ? (
            <Button
              label="Değerlendir"
              size="sm"
              variant="secondary"
              icon={<Star size={14} color={t.colors.ink} />}
              onPress={() => router.push(`/siparis/${order.id}/degerlendir`)}
            />
          ) : null}
          {order.status === "delivered" || order.status === "cancelled" ? (
            <Button
              label="Tekrarla"
              size="sm"
              variant="secondary"
              icon={<RotateCcw size={14} color={t.colors.ink} />}
              onPress={onReorder}
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  emoji: { fontSize: 28, lineHeight: 34 },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  actions: { flexDirection: "row", gap: 6 },
});
