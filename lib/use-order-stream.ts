"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api-client";
import { progressOf, remainingMinutes, type ProgressContext } from "./orders/progress";
import { useRealtime } from "./realtime";
import type { LatLng, Order } from "./types";

/**
 * Canlı sipariş takibi (Supabase Realtime).
 *
 * İlk durum `/orders/:id` ile çekilir. Ardından `order:<id>` kanalı dinlenir:
 * kurye konumu yayını haritayı doğrudan kaydırır, durum değişikliği güncel
 * siparişi yeniden çeker. İlerleme çubuğu ve kalan süre tarayıcıda her
 * 2 saniyede bir yeniden hesaplanır. Realtime bağlantısı kurulamazsa
 * yoklama (polling) yedeği devrede kalır.
 */

interface OrderPayload {
  order: Order;
  progress: number;
  remainingMinutes: number;
  timing?: ProgressContext;
}

export interface OrderStreamState {
  order: Order | null;
  progress: number;
  remainingMinutes: number;
  live: boolean;
  loading: boolean;
  error: string | null;
  setOrder: (order: Order) => void;
}

const finished = (order: Order | null) =>
  order?.status === "delivered" || order?.status === "cancelled";

export function useOrderStream(orderId: string): OrderStreamState {
  const [order, setOrderState] = useState<Order | null>(null);
  const [timing, setTiming] = useState<ProgressContext>({ simSpeed: 1, demoMode: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, tick] = useState(0);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<OrderPayload>(`/orders/${orderId}`);
      setOrderState(data.order);
      if (data.timing) setTiming(data.timing);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sipariş yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  /* İlk durum */
  useEffect(() => {
    void load();
  }, [load]);

  /* Realtime */
  const status = useRealtime(
    "customer",
    [`order:${orderId}`],
    (message) => {
      if (message.event === "courier_moved") {
        const point = message.payload.courierPoint as LatLng | null | undefined;
        if (point) setOrderState((current) => (current ? { ...current, courierPoint: point } : current));
        return;
      }
      // Art arda gelen olaylar tek istekte birleşsin
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => void load(), 250);
    },
    !finished(order)
  );

  /* Yedek yoklama: canlı bağlantıda seyrek, bağlantı yoksa sık */
  useEffect(() => {
    if (finished(order)) return;
    const timer = setInterval(() => void load(), status === "live" ? 20_000 : 4_000);
    return () => clearInterval(timer);
  }, [status, order, load]);

  /* İlerleme çubuğu ve kalan süre */
  useEffect(() => {
    if (finished(order)) return;
    const timer = setInterval(() => tick((n) => n + 1), 2_000);
    return () => clearInterval(timer);
  }, [order]);

  useEffect(
    () => () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
    },
    []
  );

  return {
    order,
    progress: order ? progressOf(order, timing) : 0,
    remainingMinutes: order ? remainingMinutes(order) : 0,
    live: status === "live" && !finished(order),
    loading,
    error,
    setOrder: setOrderState,
  };
}
