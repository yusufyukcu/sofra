import { router, useLocalSearchParams } from "expo-router";
import { Headset, LockKeyhole, Send, Sparkles } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { formatTime, type SupportMessage, type SupportSession } from "@sofra/core";
import { Button } from "@/components/ui/button";
import { Header, Screen } from "@/components/ui/screen";
import { EmptyState, Skeleton } from "@/components/ui/surfaces";
import { Text } from "@/components/ui/text";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/store/session";
import { useTheme } from "@/theme";

/**
 * Canlı destek (mobil).
 *
 * Webdeki sohbetle aynı uçlar: kural tabanlı asistan sık soruları gerçek
 * veriyle yanıtlar, çözemediğini temsilci kuyruğuna aktarır. Temsilci
 * kuyruğundayken yanıtlar 4 saniyede bir yoklanır (uygulama öndeyken).
 */
export default function SupportScreen() {
  const t = useTheme();
  const { siparis } = useLocalSearchParams<{ siparis?: string }>();
  const status = useSession((s) => s.status);

  const [session, setSession] = useState<SupportSession | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(
    async (sessionId?: string) => {
      try {
        const params = new URLSearchParams();
        if (sessionId) params.set("sessionId", sessionId);
        else if (siparis) params.set("orderId", siparis);
        const query = params.toString();
        const data = await api.get<{ session: SupportSession }>(`/support/chat${query ? `?${query}` : ""}`);
        setSession(data.session);
        setError(null);
      } catch (err) {
        setError(errorMessage(err));
      }
    },
    [siparis]
  );

  useEffect(() => {
    if (status === "authenticated") void load();
  }, [status, load]);

  // Temsilci kuyruğundayken yanıtları yokla
  const escalated = Boolean(session?.escalated);
  const sessionId = session?.id;
  useEffect(() => {
    if (!escalated || !sessionId) return;
    let timer: ReturnType<typeof setInterval> | null = setInterval(() => void load(sessionId), 4000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && !timer) timer = setInterval(() => void load(sessionId), 4000);
      if (state !== "active" && timer) {
        clearInterval(timer);
        timer = null;
      }
    });
    return () => {
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, [escalated, sessionId, load]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, [session?.messages.length]);

  async function send(payload: { text?: string; quickReplyId?: string }) {
    if (!session || busy) return;
    setBusy(true);
    try {
      const data = await api.post<{ session: SupportSession }>("/support/chat", {
        sessionId: session.id,
        orderId: siparis,
        ...payload,
      });
      setSession(data.session);
      setText("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (status !== "authenticated") {
    return (
      <Screen>
        <Header title="Canlı destek" back />
        <View style={{ padding: t.spacing.lg }}>
          <EmptyState
            icon={LockKeyhole}
            title="Destek için giriş yap"
            description="Siparişlerini görebilmemiz için hesabına giriş yapmalısın."
            action={<Button label="Giriş yap" onPress={() => router.push("/giris")} />}
          />
        </View>
      </Screen>
    );
  }

  const lastBot = [...(session?.messages ?? [])].reverse().find((m) => m.role !== "user");

  return (
    <Screen edges="none">
      <Header
        title="Canlı destek"
        subtitle={
          session?.status === "waiting_agent"
            ? "Temsilciye aktarıldın"
            : session?.status === "with_agent"
              ? "Temsilciyle görüşüyorsun"
              : "Sofra Asistanı"
        }
        back
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md }}>
          {!session ? (
            <View style={{ gap: t.spacing.md }}>
              <Skeleton height={60} radius={t.radius.lg} />
              <Skeleton height={44} radius={t.radius.lg} />
            </View>
          ) : (
            session.messages.map((message) => <Bubble key={message.id} message={message} />)
          )}
          {error ? (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          ) : null}
        </ScrollView>

        {lastBot?.quickReplies?.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: t.spacing.lg, gap: 8, paddingBottom: 8 }}
            style={{ flexGrow: 0 }}
          >
            {lastBot.quickReplies.map((reply) => (
              <Pressable
                key={reply.id}
                disabled={busy}
                onPress={() => void send({ quickReplyId: reply.id })}
                style={({ pressed }) => [
                  styles.quick,
                  { borderColor: t.colors.brand, backgroundColor: t.colors.brandSoft, opacity: pressed || busy ? 0.6 : 1 },
                ]}
              >
                <Text variant="caption" weight="semibold" tone="brand">
                  {reply.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={[styles.composer, { borderTopColor: t.colors.border, backgroundColor: t.colors.surface }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Sorunu yaz…"
            placeholderTextColor={t.colors.muted}
            editable={!busy && !!session}
            onSubmitEditing={() => text.trim() && void send({ text: text.trim() })}
            returnKeyType="send"
            style={[
              styles.input,
              { color: t.colors.text, backgroundColor: t.colors.surface2, borderRadius: t.radius.md, fontFamily: t.fontFamily.regular },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Gönder"
            disabled={busy || !text.trim()}
            onPress={() => void send({ text: text.trim() })}
            style={({ pressed }) => [
              styles.send,
              { backgroundColor: t.colors.brand, opacity: pressed || busy || !text.trim() ? 0.5 : 1 },
            ]}
          >
            <Send size={18} color={t.colors.brandContrast} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Bubble({ message }: { message: SupportMessage }) {
  const t = useTheme();
  const mine = message.role === "user";
  const agent = message.role === "agent";
  return (
    <View style={[styles.bubbleRow, mine && { flexDirection: "row-reverse" }]}>
      {!mine ? (
        <View style={[styles.avatar, { backgroundColor: agent ? t.colors.infoSoft : t.colors.brandSoft }]}>
          {agent ? <Headset size={15} color={t.colors.info} /> : <Sparkles size={15} color={t.colors.brand} />}
        </View>
      ) : null}
      <View style={{ maxWidth: "82%", gap: 3, alignItems: mine ? "flex-end" : "flex-start" }}>
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: mine ? t.colors.brand : agent ? t.colors.infoSoft : t.colors.surface2,
              borderRadius: t.radius.lg,
            },
          ]}
        >
          <Text variant="small" style={{ color: mine ? t.colors.brandContrast : t.colors.text }}>
            {message.text.replace(/\*\*/g, "")}
          </Text>
        </View>
        <Text variant="caption">
          {agent ? `Temsilci${message.authorName ? ` ${message.authorName}` : ""} · ` : ""}
          {formatTime(message.at)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  quick: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  composer: { flexDirection: "row", gap: 8, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 44, paddingHorizontal: 14, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  bubbleRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  bubble: { paddingHorizontal: 13, paddingVertical: 9 },
});
