import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { relativeTime, type AppNotification } from "@sofra/core";
import { Header, Screen } from "@/components/ui/screen";
import { Card, EmptyState, Skeleton } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { api, errorMessage } from "@/lib/api";
import { useTheme } from "@/theme";

/**
 * Bildirim kutusu: sipariş durumları ve kampanyalar. Açılınca okundu
 * sayılır; sipariş bildirimine dokununca takip ekranı açılır.
 */
export default function NotificationsScreen() {
  const t = useTheme();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ notifications: AppNotification[]; unread: number }>("/notifications");
      setItems(data.notifications);
      setError(null);
      if (data.unread > 0) await api.post("/notifications", { action: "read" });
    } catch (err) {
      setError(errorMessage(err));
      setItems((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function open(item: AppNotification) {
    const match = item.href?.match(/^\/siparis\/([^/?#]+)/);
    if (match) router.push({ pathname: "/siparis/[id]", params: { id: match[1] } });
  }

  return (
    <Screen edges="none">
      <Header title="Bildirimler" back />
      <ScrollView
        contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.sm, paddingBottom: t.spacing.xxxl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        {items === null ? (
          <>
            <Skeleton height={70} radius={t.radius.lg} />
            <Skeleton height={70} radius={t.radius.lg} />
          </>
        ) : items.length === 0 ? (
          <EmptyState
            emoji="🔔"
            title="Henüz bildirim yok"
            description={error ?? "Sipariş verdiğinde durum değişiklikleri burada görünür."}
          />
        ) : (
          items.map((item) => (
            <Pressable key={item.id} onPress={() => open(item)} disabled={!item.href}>
              {({ pressed }) => (
                <Card style={[styles.item, { opacity: pressed ? 0.75 : 1 }]}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: item.readAt ? "transparent" : t.colors.brand },
                    ]}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="body" weight="semibold" tone="ink">
                      {item.title}
                    </Text>
                    <Text variant="small">{item.body}</Text>
                    <Text variant="caption">{relativeTime(item.createdAt)}</Text>
                  </View>
                </Card>
              )}
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
});
