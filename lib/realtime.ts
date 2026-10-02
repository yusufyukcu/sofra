"use client";

import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";

/**
 * Supabase Realtime — tarayıcı tarafı.
 *
 * Veritabanı tetikleyicileri değişiklikleri özel kanallara yayınlar
 * (`order:<id>`, `restaurant:<id>`, `courier:<id>`, `admin:ops` …). Kim
 * hangi kanalı dinleyebilir, veritabanındaki politika belirler. Yayın
 * yükü küçüktür; ekran olayı alınca güncel veriyi API'den çeker.
 *
 * Rol başına tek WebSocket bağlantısı açılır; aynı kanalı dinleyen
 * ekranlar tek aboneliği paylaşır. Erişim token'ını istemcinin
 * `accessToken` geri çağrısı sunucudan alır (oturum çerezleri httpOnly
 * olduğundan JavaScript yenileme token'ını hiç görmez). Realtime bu geri
 * çağrıyı bağlanırken ve her nabızda yeniden sorar; token süresi dolmadan
 * yenilenir. (`setAuth(token)` ile elle verilen token, supabase-js'in kendi
 * geri çağrısı tarafından ilk abonelikten sonra anonim anahtarla
 * değiştiriliyordu — bu yüzden geri çağrı kullanılır.)
 */

export type RealtimeRole = "customer" | "vendor" | "courier" | "admin";
export type RealtimeStatus = "connecting" | "live" | "offline";

export interface RealtimeMessage {
  topic: string;
  event: string;
  payload: Record<string, unknown>;
}

interface Topic {
  channel: RealtimeChannel | null;
  state: RealtimeStatus;
  attempt: number;
  retry: ReturnType<typeof setTimeout> | null;
  release: ReturnType<typeof setTimeout> | null;
  listeners: Set<(message: RealtimeMessage) => void>;
  watchers: Set<() => void>;
}

interface Connection {
  role: RealtimeRole;
  client: SupabaseClient;
  token: string | null;
  expiresAt: number;
  pending: Promise<string> | null;
  topics: Map<string, Topic>;
  /** Kapanmakta olan kanallar — aynı konuya yeniden katılmadan önce beklenir */
  leaving: Map<string, Promise<unknown>>;
  closed: boolean;
}

const connections = new Map<RealtimeRole, Connection>();

/** Son dinleyici ayrıldıktan sonra kanal bu kadar açık kalır (sayfa geçişinde yeniden katılmasın). */
const RELEASE_DELAY_MS = 1_500;

async function fetchToken(role: RealtimeRole): Promise<{ accessToken: string; expiresAt: number | null }> {
  const res = await fetch(`/api/v1/realtime/token?rol=${role}`, {
    credentials: "include",
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) throw new Error(body?.error?.message ?? "Realtime token alınamadı");
  return body.data;
}

/**
 * Geçerli token; bitmesine 5 dakikadan az kaldıysa sunucudan yenisi alınır
 * (sunucu da aynı eşikte oturumu yeniler).
 */
function tokenFor(conn: Connection): Promise<string> {
  if (conn.token && conn.expiresAt - Date.now() > 300_000) return Promise.resolve(conn.token);
  conn.pending ??= fetchToken(conn.role)
    .then(({ accessToken, expiresAt }) => {
      conn.token = accessToken;
      conn.expiresAt = (expiresAt ?? Math.floor(Date.now() / 1000) + 3600) * 1000;
      return accessToken;
    })
    .catch((err) => {
      // Geçici hata: elde süresi dolmamış token varsa onunla devam et
      if (conn.token && conn.expiresAt > Date.now()) return conn.token;
      throw err;
    })
    .finally(() => {
      conn.pending = null;
    });
  return conn.pending;
}

function connectionFor(role: RealtimeRole): Connection {
  const existing = connections.get(role);
  if (existing) return existing;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase ortam değişkenleri tanımlı değil");

  const conn = {
    role,
    token: null,
    expiresAt: 0,
    pending: null,
    topics: new Map(),
    leaving: new Map(),
    closed: false,
  } as Omit<Connection, "client"> as Connection;
  conn.client = createClient(url, key, { accessToken: () => tokenFor(conn) });
  connections.set(role, conn);
  return conn;
}

function setState(topic: Topic, state: RealtimeStatus) {
  if (topic.state === state) return;
  topic.state = state;
  topic.watchers.forEach((watcher) => watcher());
}

/** Kanalı bırak; kapanış bitene kadar aynı konuya yeni kanal açılmaz. */
function detach(conn: Connection, name: string, topic: Topic) {
  const channel = topic.channel;
  if (!channel) return;
  topic.channel = null;
  const leaving: Promise<unknown> = conn.client
    .removeChannel(channel)
    .catch(() => undefined)
    .finally(() => {
      if (conn.leaving.get(name) === leaving) conn.leaving.delete(name);
    });
  conn.leaving.set(name, leaving);
}

async function join(conn: Connection, name: string, topic: Topic): Promise<void> {
  const leaving = conn.leaving.get(name);
  if (leaving) await leaving;
  // Katılma isteği token'ı o anki değerle taşır: token gelmeden katılan
  // kanal anonim sayılıp reddedilir. Önbellekteyse ek istek yapılmaz.
  await conn.client.realtime.setAuth().catch(() => undefined);
  if (conn.closed || conn.topics.get(name) !== topic || topic.channel) return;

  const channel = conn.client.channel(name, { config: { private: true } });
  topic.channel = channel;
  channel.on("broadcast", { event: "*" }, (message) => {
    const event: RealtimeMessage = {
      topic: name,
      event: String(message.event),
      payload: (message.payload ?? {}) as Record<string, unknown>,
    };
    topic.listeners.forEach((listener) => listener(event));
  });
  channel.subscribe((status, err) => {
    if (topic.channel !== channel) return;
    if (status === "SUBSCRIBED") {
      topic.attempt = 0;
      setState(topic, "live");
      return;
    }
    if (status !== "CHANNEL_ERROR" && status !== "TIMED_OUT" && status !== "CLOSED") return;

    setState(topic, "offline");
    detach(conn, name, topic);
    // Günün bölümü henüz açılmamış, bağlantı kopmuş ya da token süresi dolmuş
    // olabilir: artan aralıkla yeniden dene; yetki hatasında önce token'ı yenile.
    const unauthorized = /unauthorized|permission|jwt/i.test(err?.message ?? "");
    const delay = Math.min(60_000, 2_000 * 2 ** Math.min(topic.attempt++, 5));
    topic.retry = setTimeout(async () => {
      topic.retry = null;
      if (conn.closed || conn.topics.get(name) !== topic) return;
      if (unauthorized) {
        conn.expiresAt = 0;
        await conn.client.realtime.setAuth().catch(() => undefined);
      }
      await join(conn, name, topic);
    }, delay);
  });
}

function watch(
  conn: Connection,
  name: string,
  listener: (message: RealtimeMessage) => void,
  watcher: () => void
): () => void {
  let topic = conn.topics.get(name);
  if (!topic) {
    topic = {
      channel: null,
      state: "connecting",
      attempt: 0,
      retry: null,
      release: null,
      listeners: new Set(),
      watchers: new Set(),
    };
    conn.topics.set(name, topic);
    void join(conn, name, topic);
  }
  if (topic.release) {
    clearTimeout(topic.release);
    topic.release = null;
  }
  topic.listeners.add(listener);
  topic.watchers.add(watcher);

  const entry = topic;
  return () => {
    entry.listeners.delete(listener);
    entry.watchers.delete(watcher);
    if (entry.listeners.size > 0 || entry.release) return;
    entry.release = setTimeout(() => {
      entry.release = null;
      if (entry.listeners.size > 0) return;
      if (entry.retry) clearTimeout(entry.retry);
      entry.retry = null;
      if (conn.topics.get(name) === entry) conn.topics.delete(name);
      detach(conn, name, entry);
    }, RELEASE_DELAY_MS);
  };
}

/** Çıkışta rolün bağlantısını kapat (başka bir kullanıcının token'ı kalmasın). */
export function closeRealtime(role: RealtimeRole): void {
  const conn = connections.get(role);
  if (!conn) return;
  connections.delete(role);
  conn.closed = true;
  conn.topics.forEach((topic) => {
    if (topic.retry) clearTimeout(topic.retry);
    if (topic.release) clearTimeout(topic.release);
    topic.channel = null;
    setState(topic, "offline");
  });
  conn.topics.clear();
  void conn.client.removeAllChannels();
}

/**
 * Kanalları React dışında dinler (mağazalar, testler). Dönen fonksiyon
 * aboneliği bırakır. `onStatus` tüm kanallar bağlıyken `live`, herhangi
 * biri koptuğunda `offline` alır.
 */
export function subscribeRealtime(
  role: RealtimeRole,
  topics: string[],
  onMessage: (message: RealtimeMessage) => void,
  onStatus: (status: RealtimeStatus) => void = () => undefined
): () => void {
  const names = [...new Set(topics.filter(Boolean))];
  let conn: Connection;
  try {
    if (names.length === 0) throw new Error("kanal yok");
    conn = connectionFor(role);
  } catch {
    onStatus("offline");
    return () => undefined;
  }

  const update = () => {
    const states = names.map((name) => conn.topics.get(name)?.state ?? "offline");
    onStatus(
      states.includes("offline")
        ? "offline"
        : states.every((state) => state === "live")
          ? "live"
          : "connecting"
    );
  };
  const stops = names.map((name) => watch(conn, name, onMessage, update));
  update();
  return () => stops.forEach((stop) => stop());
}

/**
 * Kanalları dinler. `onMessage` her yayında çağrılır; durum `live` değilse
 * ekran yedek yoklamayla çalışmaya devam etmelidir.
 */
export function useRealtime(
  role: RealtimeRole,
  topics: string[],
  onMessage: (message: RealtimeMessage) => void,
  enabled = true
): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const handler = useRef(onMessage);
  handler.current = onMessage;

  const key = [...new Set(topics.filter(Boolean))].sort().join("|");

  useEffect(() => {
    if (!enabled || !key) {
      setStatus("offline");
      return;
    }
    return subscribeRealtime(role, key.split("|"), (message) => handler.current(message), setStatus);
  }, [role, key, enabled]);

  return status;
}
