"use client";

import { ChevronRight } from "lucide-react";
import { ORDER_STATUS_ICONS } from "@sofra/core";
import { Icon } from "@/components/ui/icon";
import Link from "next/link";
import { useEffect } from "react";
import { ORDER_STATUS_META } from "@/lib/constants";
import { useSession } from "@/lib/store/session";
import { formatTime } from "@/lib/utils";

/**
 * Anasayfadaki "devam eden siparişin var" şeridi.
 * Aktif sipariş varken 15 saniyede bir tazelenir; detaylı canlı takip
 * sipariş sayfasındaki SSE akışıyla yapılır.
 */
export function ActiveOrdersStrip() {
  const activeOrders = useSession((s) => s.activeOrders);
  const refresh = useSession((s) => s.refreshActiveOrders);
  const status = useSession((s) => s.status);

  useEffect(() => {
    if (status !== "authenticated") return;
    const timer = setInterval(() => void refresh(), 15000);
    return () => clearInterval(timer);
  }, [status, refresh]);

  if (!activeOrders.length) return null;

  return (
    <div className="space-y-2">
      {activeOrders.map((order) => {
        const meta = ORDER_STATUS_META[order.status];
        return (
          <Link
            key={order.id}
            href={`/siparis/${order.id}`}
            className="flex items-center gap-3 rounded-2xl border border-brand/25 bg-surface p-3.5 shadow-soft transition-colors hover:border-brand/50"
          >
            <span className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Icon name={ORDER_STATUS_ICONS[order.status]} className="size-5" />
              <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-surface bg-brand">
                <span className="animate-pulse-ring absolute inset-0 rounded-full bg-brand" />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">
                {order.restaurantName} · {meta.label}
              </p>
              <p className="truncate text-xs text-muted">
                {order.code} · Tahmini teslim {formatTime(order.etaAt)}
              </p>
            </div>
            <span className="hidden text-sm font-semibold text-brand sm:block">
              Takip et
            </span>
            <ChevronRight className="size-5 shrink-0 text-brand" />
          </Link>
        );
      })}
    </div>
  );
}
