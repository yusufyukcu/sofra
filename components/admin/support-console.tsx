"use client";

import { Headset, Radio, Send, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { ORDER_STATUS_META } from "@/lib/constants";
import { useRealtime } from "@/lib/realtime";
import type { AgentSessionView, SupportQueueFilter, SupportQueueItem } from "@/lib/services/support";
import { useAdmin } from "@/lib/store/admin";
import type { SupportMessage } from "@/lib/types";
import { cn, formatPrice, formatTime, relativeTime } from "@/lib/utils";
import { Button, EmptyState, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

const FILTERS: { id: SupportQueueFilter; label: string }[] = [
  { id: "open", label: "Açık" },
  { id: "closed", label: "Kapanan" },
  { id: "all", label: "Tümü" },
];

const STATUS = {
  bot: { label: "Asistanla", className: "bg-surface-2 text-muted" },
  waiting_agent: { label: "Temsilci bekliyor", className: "bg-saffron-soft text-saffron" },
  with_agent: { label: "Görüşmede", className: "bg-info-soft text-info" },
  closed: { label: "Kapandı", className: "bg-surface-2 text-muted" },
} as const;

const TOPICS: Record<string, string> = {
  missing_item: "Eksik / yanlış ürün",
  invoice: "Fatura",
  agent: "Temsilci talebi",
  payment_issue: "Ödeme & iade",
};

/**
 * Canlı destek temsilci konsolu.
 *
 * Asistanın çözemeyip aktardığı konuşmalar kuyrukta bekler (en eskisi
 * önce değil, temsilci bekleyenler en üstte). Temsilci konuşmayı üstlenir,
 * yazar, gerekirse kuyruğa geri bırakır ya da kapatır. Müşteri her mesajı
 * Realtime ile anında görür; konsol da `admin:support` kanalını dinler.
 */
export function SupportConsole() {
  const toast = useToast();
  const admin = useAdmin((s) => s.admin);
  const [filter, setFilter] = useState<SupportQueueFilter>("open");
  const [queue, setQueue] = useState<{
    sessions: SupportQueueItem[];
    counts: { waiting: number; withAgent: number };
  } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<AgentSessionView | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadQueue = useCallback(async () => {
    try {
      setQueue(await api.get(`/admin/support?durum=${filter}`));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }, [filter, toast]);

  const loadView = useCallback(async () => {
    if (!selected) return;
    try {
      setView(await api.get<AgentSessionView>(`/admin/support/${selected}`));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }, [selected, toast]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    setView(null);
    void loadView();
  }, [loadView]);

  /* Realtime: kuyruk ve açık konuşma her olayda tazelenir */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef({ queue: false, view: false });
  const status = useRealtime("admin", ["admin:support"], (message) => {
    const sessionId = String(message.payload.sessionId ?? message.payload.id ?? "");
    pending.current.queue = true;
    if (sessionId && sessionId === selected) pending.current.view = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const { queue: q, view: v } = pending.current;
      pending.current = { queue: false, view: false };
      if (q) void loadQueue();
      if (v) void loadView();
    }, 300);
  });
  const live = status === "live";

  useEffect(() => {
    const interval = setInterval(() => {
      void loadQueue();
      void loadView();
    }, live ? 30_000 : 5_000);
    return () => clearInterval(interval);
  }, [live, loadQueue, loadView]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [view?.session.messages.length]);

  async function act(action: "claim" | "message" | "release" | "close") {
    if (!selected || busy) return;
    if (action === "message" && !text.trim()) return;
    setBusy(true);
    try {
      const next = await api.post<AgentSessionView>(`/admin/support/${selected}`, {
        action,
        text: action === "message" ? text.trim() : undefined,
      });
      setView(next);
      if (action === "message") setText("");
      if (action === "close") toast.success("Görüşme kapatıldı.");
      void loadQueue();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const info = view?.info;
  const mine = info?.assignedAdmin?.id === admin?.id;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">Canlı destek</h1>
          <p className="mt-0.5 flex items-center gap-2 text-sm text-muted">
            <Radio className={cn("size-3.5", live && "animate-pulse text-pistachio")} />
            {queue
              ? `${queue.counts.waiting} temsilci bekleyen · ${queue.counts.withAgent} görüşmede`
              : "Yükleniyor…"}
          </p>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        {/* Kuyruk */}
        <section className="card flex min-h-0 flex-col overflow-hidden lg:h-[calc(100dvh-12rem)]">
          <div className="flex gap-1 border-b border-border p-2">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={cn(
                  "flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                  filter === item.id ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {!queue ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : queue.sessions.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">
              {filter === "open" ? "Bekleyen konuşma yok." : "Konuşma bulunamadı."}
            </p>
          ) : (
            <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
              {queue.sessions.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(item.id)}
                    className={cn(
                      "w-full px-4 py-3 text-left transition-colors hover:bg-surface-2/60",
                      selected === item.id && "bg-brand-soft/60"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
                        {item.customer.name}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold",
                          STATUS[item.status].className
                        )}
                      >
                        {STATUS[item.status].label}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {item.lastMessage
                        ? `${item.lastMessage.role === "user" ? "" : "↪ "}${item.lastMessage.text}`
                        : "Mesaj yok"}
                    </span>
                    <span className="tabular mt-1 flex gap-2 text-[11px] text-muted">
                      {item.topic && <span>{TOPICS[item.topic] ?? item.topic}</span>}
                      {item.orderCode && <span>· {item.orderCode}</span>}
                      <span className="ml-auto">{relativeTime(item.updatedAt)}</span>
                    </span>
                    {item.assignedAdmin && (
                      <span className="mt-0.5 block text-[11px] font-semibold text-info">
                        {item.assignedAdmin.id === admin?.id ? "Sende" : item.assignedAdmin.name}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Konuşma */}
        {!selected ? (
          <EmptyState
            icon={Headset}
            title="Bir konuşma seç"
            description="Soldaki kuyruktan bir konuşma seçtiğinde mesajlar ve müşterinin son siparişleri burada görünür."
          />
        ) : !view || !info ? (
          <Skeleton className="h-[28rem] w-full" />
        ) : (
          <div className="grid min-w-0 gap-5 xl:grid-cols-[1fr_280px]">
            <section className="card flex min-h-0 flex-col overflow-hidden lg:h-[calc(100dvh-12rem)]">
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-ink">{info.customer.name}</p>
                  <p className="tabular truncate text-xs text-muted">
                    {info.customer.phone ? `+90 ${info.customer.phone}` : "Telefon yok"}
                    {info.topic ? ` · ${TOPICS[info.topic] ?? info.topic}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-bold",
                    STATUS[info.status].className
                  )}
                >
                  {STATUS[info.status].label}
                  {info.assignedAdmin && info.status === "with_agent"
                    ? ` · ${mine ? "sende" : info.assignedAdmin.name}`
                    : ""}
                </span>
                {info.status !== "closed" && !mine && (
                  <Button size="sm" loading={busy} onClick={() => act("claim")}>
                    Üstlen
                  </Button>
                )}
                {info.status === "with_agent" && mine && (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => act("release")}>
                    Kuyruğa bırak
                  </Button>
                )}
                {info.status !== "closed" && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => act("close")}>
                    Kapat
                  </Button>
                )}
              </div>

              <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {view.session.messages.map((message) => (
                  <AgentBubble key={message.id} message={message} />
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void act("message");
                }}
                className="flex items-end gap-2 border-t border-border p-3"
              >
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void act("message");
                    }
                  }}
                  rows={2}
                  maxLength={1000}
                  placeholder={
                    info.status === "closed"
                      ? "Yazarsan görüşme yeniden açılır ve sende olur…"
                      : "Yanıtını yaz (Enter gönderir, Shift+Enter yeni satır)…"
                  }
                  className="min-h-11 flex-1 resize-none rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-text placeholder:text-muted focus:border-brand focus:outline-none"
                />
                <Button type="submit" loading={busy} disabled={!text.trim()} aria-label="Gönder">
                  <Send className="size-4" />
                </Button>
              </form>
            </section>

            {/* Müşteri bağlamı */}
            <aside className="space-y-3">
              <section className="card p-4">
                <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-ink">
                  <UserRound className="size-4 text-muted" />
                  Son siparişler
                </h2>
                {view.recentOrders.length === 0 ? (
                  <p className="text-xs text-muted">Siparişi yok.</p>
                ) : (
                  <ul className="space-y-2">
                    {view.recentOrders.map((order) => (
                      <li key={order.id} className="rounded-xl bg-surface-2 px-3 py-2">
                        <p className="flex items-center gap-2 text-xs">
                          <span className="font-display tabular font-extrabold text-ink">{order.code}</span>
                          <span className="truncate text-muted">{order.restaurantName}</span>
                        </p>
                        <p className="tabular mt-0.5 text-[11px] text-muted">
                          {ORDER_STATUS_META[order.status].label} · {formatPrice(order.totals.grandTotal)}
                          {(order.refundedTotal ?? 0) > 0 && ` · ${formatPrice(order.refundedTotal ?? 0)} iade`}
                        </p>
                        <Link
                          href={`/yonetim/siparisler?q=${encodeURIComponent(order.code)}`}
                          className="mt-1 inline-block text-[11px] font-semibold text-brand hover:underline"
                        >
                          İade / iptal →
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-[11px] leading-relaxed text-muted">
                Müşteri yazdıklarını anında görür. Kapatılan konuşmaya müşteri
                yazarsa asistan yeniden devreye girer.
              </p>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentBubble({ message }: { message: SupportMessage }) {
  const fromCustomer = message.role === "user";
  const fromAgent = message.role === "agent";

  return (
    <div className={cn("flex gap-2", !fromCustomer && "flex-row-reverse")}>
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
          fromCustomer ? "bg-surface-2 text-muted" : fromAgent ? "bg-info-soft text-info" : "bg-brand-soft text-brand"
        )}
      >
        {fromCustomer ? <UserRound className="size-4" /> : fromAgent ? <Headset className="size-4" /> : <Sparkles className="size-4" />}
      </span>
      <div className={cn("max-w-[78%]", !fromCustomer && "text-right")}>
        <div
          className={cn(
            "inline-block whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-left text-sm leading-relaxed",
            fromCustomer
              ? "rounded-bl-md bg-surface-2 text-text"
              : fromAgent
                ? "rounded-br-md border border-info/30 bg-info-soft text-text"
                : "rounded-br-md bg-brand-soft text-text"
          )}
        >
          {message.text.replace(/\*\*/g, "")}
        </div>
        <span className="mt-1 block px-1 text-[10px] text-muted">
          {fromCustomer ? "Müşteri" : fromAgent ? `Temsilci${message.authorName ? ` ${message.authorName}` : ""}` : "Asistan"}
          {" · "}
          {formatTime(message.at)}
        </span>
      </div>
    </div>
  );
}
