"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "./api-client";
import type { Order } from "./types";

/**
 * Canlı sipariş takibi.
 *
 * Önce `/orders/:id` ile ilk durum çekilir (SSE açılana kadar ekran boş
 * kalmasın), ardından `/orders/:id/stream` üzerinden Server-Sent Events ile
 * saniyelik güncellemeler dinlenir. Bağlantı koparsa tarayıcı otomatik
 * yeniden bağlanır; ayrıca 5 saniyelik yoklama (polling) yedeği devreye girer.
 */

interface StreamPayload {
  order: Order;
  progress: number;
  remainingMinutes: number;
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

export function useOrderStream(orderId: string): OrderStreamState {
  const [state, setState] = useState<Omit<OrderStreamState, "setOrder">>({
    order: null,
    progress: 0,
    remainingMinutes: 0,
    live: false,
    loading: true,
    error: null,
  });
  const finished = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    function apply(payload: StreamPayload, live: boolean) {
      if (cancelled) return;
      finished.current =
        payload.order.status === "delivered" ||
        payload.order.status === "cancelled";
      setState({
        order: payload.order,
        progress: payload.progress,
        remainingMinutes: payload.remainingMinutes,
        live,
        loading: false,
        error: null,
      });
    }

    /* 1) İlk durum */
    api
      .get<StreamPayload>(`/orders/${orderId}`)
      .then((data) => apply(data, false))
      .catch((err: Error) => {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false, error: err.message }));
        }
      });

    /* 2) Canlı akış */
    try {
      source = new EventSource(`/api/v1/orders/${orderId}/stream`, {
        withCredentials: true,
      });

      source.addEventListener("update", (event) => {
        try {
          apply(JSON.parse((event as MessageEvent).data) as StreamPayload, true);
        } catch {
          /* bozuk paket — yoksay */
        }
      });

      source.addEventListener("done", () => {
        source?.close();
        setState((s) => ({ ...s, live: false }));
      });

      source.onerror = () => {
        setState((s) => ({ ...s, live: false }));
      };
    } catch {
      /* EventSource desteklenmiyorsa yoklamaya düşeriz */
    }

    /* 3) Yedek yoklama */
    poll = setInterval(() => {
      if (finished.current) return;
      api
        .get<StreamPayload>(`/orders/${orderId}`)
        .then((data) => {
          setState((s) => (s.live ? s : { ...s, ...data, loading: false }));
        })
        .catch(() => undefined);
    }, 5000);

    return () => {
      cancelled = true;
      source?.close();
      if (poll) clearInterval(poll);
    };
  }, [orderId]);

  return {
    ...state,
    setOrder: (order: Order) => setState((s) => ({ ...s, order })),
  };
}
