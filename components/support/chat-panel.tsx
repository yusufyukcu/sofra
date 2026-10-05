"use client";

import { Headset, LockKeyhole, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { useRealtime } from "@/lib/realtime";
import { useSession } from "@/lib/store/session";
import type { SupportMessage, SupportSession } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";
import { Button, EmptyState } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

/**
 * Canlı destek / chatbot paneli.
 * Hem sağ alttaki açılır pencerede hem de /destek sayfasında kullanılır.
 *
 * Konuşmanın Realtime kanalı (`support:<id>`) dinlenir: temsilcinin
 * yazdıkları müşteri bir şey göndermeden anında görünür. Temsilci
 * kuyruğundayken bağlantı koparsa yoklama yedeği devreye girer.
 */
export function ChatPanel({
  orderId,
  className,
}: {
  orderId?: string;
  className?: string;
}) {
  const toast = useToast();
  const status = useSession((s) => s.status);
  const refreshActiveOrders = useSession((s) => s.refreshActiveOrders);

  const [session, setSession] = useState<SupportSession | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (orderId) params.set("orderId", orderId);
        const data = await api.get<{ session: SupportSession }>(
          `/support/chat${params.size ? `?${params}` : ""}`
        );
        if (!cancelled) setSession(data.session);
      } catch (err) {
        if (!cancelled) toast.error(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, orderId, toast]);

  const sessionId = session?.id;
  const escalated = Boolean(session?.escalated);

  const reload = useCallback(async () => {
    if (!sessionId) return;
    try {
      const data = await api.get<{ session: SupportSession }>(
        `/support/chat?sessionId=${sessionId}`
      );
      setSession(data.session);
    } catch {
      /* geçici hata — sıradaki olayda ya da yoklamada düzelir */
    }
  }, [sessionId]);

  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtime = useRealtime(
    "customer",
    sessionId ? [`support:${sessionId}`] : [],
    () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => void reload(), 300);
    },
    status === "authenticated" && Boolean(sessionId)
  );

  useEffect(() => {
    if (!escalated) return;
    const timer = setInterval(() => void reload(), realtime === "live" ? 20_000 : 5_000);
    return () => clearInterval(timer);
  }, [escalated, realtime, reload]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [session?.messages.length]);

  async function send(payload: { text?: string; quickReplyId?: string }) {
    if (busy || !session) return;
    setBusy(true);
    try {
      const data = await api.post<{ session: SupportSession }>("/support/chat", {
        sessionId: session.id,
        orderId,
        ...payload,
      });
      setSession(data.session);
      // İptal gibi aksiyonlar sipariş durumunu değiştirebilir
      void refreshActiveOrders();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
      setText("");
    }
  }

  if (status === "guest") {
    return (
      <div className={className}>
        <EmptyState
          icon={LockKeyhole}
          title="Destek için giriş yap"
          description="Siparişlerini görebilmemiz ve sana özel yardım edebilmemiz için hesabına giriş yapmalısın."
          action={
            <Link href="/giris">
              <Button>Giriş yap</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const lastBotMessage = [...(session?.messages ?? [])]
    .reverse()
    .find((m) => m.role !== "user");

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {session?.status === "waiting_agent" && (
        <p className="mb-2 flex items-center gap-2 rounded-xl bg-saffron-soft px-3 py-2 text-xs font-semibold text-saffron">
          <Headset className="size-4 shrink-0" />
          Bir müşteri temsilcisine aktarıldın; yanıt burada görünecek.
        </p>
      )}
      {session?.status === "with_agent" && (
        <p className="mb-2 flex items-center gap-2 rounded-xl bg-info-soft px-3 py-2 text-xs font-semibold text-info">
          <Headset className="size-4 shrink-0" />
          Bir müşteri temsilcisiyle görüşüyorsun.
        </p>
      )}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-2"
      >
        {!session && (
          <div className="space-y-3">
            <div className="skeleton h-16 w-3/4 rounded-2xl" />
            <div className="skeleton ml-auto h-10 w-1/2 rounded-2xl" />
          </div>
        )}
        {session?.messages.map((message) => (
          <Bubble key={message.id} message={message} />
        ))}
        {busy && (
          <div className="flex items-center gap-2 px-2 text-xs text-muted">
            <span className="flex gap-1">
              <Dot delay="0ms" />
              <Dot delay="150ms" />
              <Dot delay="300ms" />
            </span>
            yazıyor…
          </div>
        )}
      </div>

      {lastBotMessage?.quickReplies?.length ? (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-1 pb-2 pt-1">
          {lastBotMessage.quickReplies.map((reply) => (
            <button
              key={reply.id}
              type="button"
              disabled={busy}
              onClick={() => send({ quickReplyId: reply.id })}
              className="shrink-0 rounded-full border border-brand/40 bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand hover:text-brand-contrast disabled:opacity-50"
            >
              {reply.label}
            </button>
          ))}
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) void send({ text: text.trim() });
        }}
        className="flex items-center gap-2 border-t border-border pt-3"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Sorunu yaz…"
          disabled={busy || !session}
          className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-3.5 text-[15px] text-text placeholder:text-muted focus:border-brand focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          aria-label="Gönder"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-contrast transition-colors hover:bg-brand-hover disabled:opacity-50"
        >
          <Send className="size-[18px]" />
        </button>
      </form>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="inline-block size-1.5 animate-bounce rounded-full bg-muted"
      style={{ animationDelay: delay }}
    />
  );
}

function Bubble({ message }: { message: SupportMessage }) {
  const isUser = message.role === "user";
  const isAgent = message.role === "agent";

  return (
    <div className={cn("flex gap-2", isUser && "flex-row-reverse")}>
      {!isUser && (
        <span
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
            isAgent ? "bg-info-soft text-info" : "bg-brand-soft text-brand"
          )}
        >
          {isAgent ? (
            <Headset className="size-4" />
          ) : (
            <Sparkles className="size-4" />
          )}
        </span>
      )}
      <div className={cn("max-w-[82%]", isUser && "text-right")}>
        <div
          className={cn(
            "inline-block whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-left text-sm leading-relaxed",
            isUser
              ? "rounded-br-md bg-brand text-brand-contrast"
              : isAgent
                ? "rounded-bl-md border border-info/30 bg-info-soft text-text"
                : "rounded-bl-md bg-surface-2 text-text"
          )}
        >
          <RichText text={message.text} />
        </div>
        <span className="mt-1 block px-1 text-[10px] text-muted">
          {isAgent ? `Müşteri temsilcisi${message.authorName ? ` ${message.authorName}` : ""} · ` : ""}
          {formatTime(message.at)}
        </span>
      </div>
    </div>
  );
}

/** `**kalın**` işaretlemesini destekleyen minimal metin görüntüleyici. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-bold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
