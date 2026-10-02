"use client";

import { Bike, ChefHat, Inbox, Radio, ScrollText } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { useRealtime } from "@/lib/realtime";
import { useVendor } from "@/lib/store/vendor";
import type { Order } from "@/lib/types";
import type { VendorOrderBoard, VendorSummary } from "@/lib/services/vendor";
import { cn, formatPrice } from "@/lib/utils";
import { playChime, startAlarm, stopAlarm } from "@/lib/vendor/chime";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { OrderTicket } from "./order-ticket";

interface BoardPayload {
  board: VendorOrderBoard;
  summary: VendorSummary;
}

/**
 * Canlı sipariş panosu.
 *
 * Restoranın Realtime kanalını dinler; yeni bir "onay bekliyor" siparişi düştüğünde
 * zil çalar ve bekleyen sipariş kalmayana kadar 5 saniyede bir tekrarlar.
 * Zil yalnızca panelden açıldığında çalar (tarayıcılar sesi kullanıcı
 * hareketi olmadan başlatmaz).
 */
export function OrderBoard() {
  const soundEnabled = useVendor((s) => s.soundEnabled);
  const setSummary = useVendor((s) => s.setSummary);

  const [data, setData] = useState<BoardPayload | null>(null);
  const seenPending = useRef<Set<string>>(new Set());
  const initialised = useRef(false);

  const apply = useCallback(
    (payload: BoardPayload) => {
      setData(payload);
      setSummary(payload.summary);

      const ids = payload.board.incoming.map((o) => o.id);
      const fresh = ids.filter((id) => !seenPending.current.has(id));
      seenPending.current = new Set(ids);

      // İlk yüklemede geçmiş siparişler için zil çalmasın
      if (!initialised.current) {
        initialised.current = true;
        return;
      }
      if (fresh.length > 0) playChime();
    },
    [setSummary]
  );

  const refresh = useCallback(async () => {
    const payload = await api.get<BoardPayload>("/vendor/orders");
    apply(payload);
  }, [apply]);

  /* Realtime: restoranın kanalındaki her sipariş olayında pano tazelenir */
  const restaurantId = useVendor((s) => s.restaurant?.id);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const status = useRealtime(
    "vendor",
    restaurantId ? [`restaurant:${restaurantId}`] : [],
    (message) => {
      if (message.event !== "order_changed" && message.event !== "restaurant_changed") return;
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => void refresh().catch(() => undefined), 300);
    },
    Boolean(restaurantId)
  );
  const live = status === "live";

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  /* Yedek yoklama: canlı bağlantıda seyrek, bağlantı yoksa sık */
  useEffect(() => {
    const timer = setInterval(() => void refresh().catch(() => undefined), live ? 30_000 : 5_000);
    return () => clearInterval(timer);
  }, [live, refresh]);

  /* Bekleyen sipariş varken zil çalmaya devam eder */
  const pendingCount = data?.board.incoming.length ?? 0;
  useEffect(() => {
    if (soundEnabled && pendingCount > 0) startAlarm();
    else stopAlarm();
    return () => stopAlarm();
  }, [soundEnabled, pendingCount]);

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const { board, summary } = data;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">
            Siparişler
          </h1>
          <p className="mt-0.5 flex items-center gap-2 text-sm text-muted">
            {live ? (
              <>
                <Radio className="size-3.5 animate-pulse text-pistachio" />
                Canlı bağlantı açık
              </>
            ) : (
              "Bağlantı yeniden kuruluyor…"
            )}
          </p>
        </div>
      </header>

      {/* Günlük özet */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Bugünkü sipariş" value={String(summary.todayOrders)} />
        <Stat label="Bugünkü ciro" value={formatPrice(summary.todayGross)} />
        <Stat
          label="Onay bekleyen"
          value={String(summary.pendingCount)}
          tone={summary.pendingCount > 0 ? "brand" : undefined}
        />
        <Stat label="Mutfakta / yolda" value={String(summary.activeCount)} />
      </div>

      {/* Pano */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Column
          title="Onay bekliyor"
          icon={<Inbox className="size-4" />}
          orders={board.incoming}
          onChanged={refresh}
          tone="brand"
          empty="Şu an onay bekleyen sipariş yok."
        />
        <Column
          title="Hazırlanıyor"
          icon={<ChefHat className="size-4" />}
          orders={board.preparing}
          onChanged={refresh}
          tone="saffron"
          empty="Mutfakta bekleyen sipariş yok."
        />
        <Column
          title="Yolda"
          icon={<Bike className="size-4" />}
          orders={board.onTheWay}
          onChanged={refresh}
          tone="info"
          empty="Yolda sipariş yok."
        />
      </div>

      {/* Bugün kapananlar */}
      <section>
        <h2 className="font-display mb-3 flex items-center gap-2 text-lg font-extrabold text-ink">
          <ScrollText className="size-4 text-muted" />
          Son 24 saatte kapananlar
          <span className="tabular rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-bold text-muted">
            {board.closed.length}
          </span>
        </h2>

        {board.closed.length === 0 ? (
          <EmptyState
            emoji="🧾"
            title="Henüz kapanan sipariş yok"
            description="Teslim edilen ve iptal olan siparişler burada listelenir."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {board.closed.map((order) => (
              <OrderTicket key={order.id} order={order} onChanged={refresh} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Column({
  title,
  icon,
  orders,
  onChanged,
  tone,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  orders: Order[];
  onChanged: () => void;
  tone: "brand" | "saffron" | "info";
  empty: string;
}) {
  const toneClass = {
    brand: "text-brand",
    saffron: "text-saffron",
    info: "text-info",
  }[tone];

  return (
    <section className="min-w-0">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
        <span className={toneClass}>{icon}</span>
        {title}
        <span className="tabular rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-extrabold text-ink">
          {orders.length}
        </span>
      </h2>

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          {empty}
        </p>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <OrderTicket key={order.id} order={order} onChanged={onChanged} />
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "brand";
}) {
  return (
    <div
      className={cn(
        "card p-4",
        tone === "brand" && "border-brand/40 bg-brand-soft"
      )}
    >
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p
        className={cn(
          "font-display tabular mt-1 text-2xl font-extrabold",
          tone === "brand" ? "text-brand" : "text-ink"
        )}
      >
        {value}
      </p>
    </div>
  );
}
