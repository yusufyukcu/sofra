"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { api } from "../api-client";
import { closeRealtime } from "../realtime";
import type { Courier, DeliveryOffer, LatLng, Order } from "../types";
import type { CourierSummaryStats } from "../services/courier";

/**
 * Kurye uygulaması oturumu ve pano durumu.
 * Müşteri ve işletme oturumlarından bağımsızdır.
 */

export type PublicCourier = Omit<Courier, "pin">;

export type ActiveOffer = DeliveryOffer & {
  order: Order;
  secondsLeft: number;
  /**
   * Teklifin bu cihazın saatine göre bittiği an (ms). Sunucunun verdiği kalan
   * süreden hesaplanır; böylece cihaz saati kaysa da geri sayım doğru kalır.
   */
  deadline?: number;
};

interface CourierState {
  status: "loading" | "authenticated" | "guest";
  courier: PublicCourier | null;
  stats: CourierSummaryStats | null;
  offer: ActiveOffer | null;
  activeOrder: Order | null;
  /**
   * Konum kaynağı. `simulated` cihaz GPS'inin yerine geçer: kurye rota
   * üzerinde ilerletilir. `device` tarayıcının konum servisini kullanır.
   */
  locationSource: "simulated" | "device";

  bootstrap: () => Promise<void>;
  applyAuth: (courier: PublicCourier) => void;
  logout: () => Promise<void>;
  applyBoard: (payload: {
    courier: PublicCourier;
    stats: CourierSummaryStats;
    offer: ActiveOffer | null;
    activeOrder: Order | null;
  }) => void;
  setCourier: (courier: PublicCourier) => void;
  setLocationSource: (source: "simulated" | "device") => void;
  /** Geri sayımı tarayıcı saatinden günceller (saniyede bir çağrılır). */
  tickOffer: () => void;
  /** Kendi konum bildirimimizi panoya hemen yansıtır. */
  setActivePoint: (point: LatLng) => void;
}

export const useCourier = create<CourierState>()(
  persist(
    (set) => ({
      status: "loading",
      courier: null,
      stats: null,
      offer: null,
      activeOrder: null,
      locationSource: "simulated",

      bootstrap: async () => {
        try {
          const data = await api.get<{
            courier: PublicCourier;
            stats: CourierSummaryStats;
          }>("/courier/auth/me");
          set({
            status: "authenticated",
            courier: data.courier,
            stats: data.stats,
          });
        } catch {
          set({ status: "guest", courier: null, stats: null });
        }
      },

      applyAuth: (courier) => set({ status: "authenticated", courier }),

      logout: async () => {
        try {
          await api.post("/courier/auth/logout");
        } finally {
          closeRealtime("courier");
          set({
            status: "guest",
            courier: null,
            stats: null,
            offer: null,
            activeOrder: null,
          });
        }
      },

      applyBoard: ({ courier, stats, offer, activeOrder }) =>
        set({
          courier,
          stats,
          activeOrder,
          offer: offer ? { ...offer, deadline: Date.now() + offer.secondsLeft * 1000 } : null,
        }),

      setCourier: (courier) => set({ courier }),
      setLocationSource: (locationSource) => set({ locationSource }),

      tickOffer: () =>
        set((state) => {
          const offer = state.offer;
          if (!offer?.deadline) return {};
          const secondsLeft = Math.max(0, Math.round((offer.deadline - Date.now()) / 1000));
          return secondsLeft === offer.secondsLeft ? {} : { offer: { ...offer, secondsLeft } };
        }),

      setActivePoint: (point) =>
        set((state) => ({
          courier: state.courier ? { ...state.courier, point } : state.courier,
          activeOrder: state.activeOrder
            ? { ...state.activeOrder, courierPoint: point }
            : state.activeOrder,
        })),
    }),
    {
      name: "sofra:courier",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ locationSource: state.locationSource }),
    }
  )
);
