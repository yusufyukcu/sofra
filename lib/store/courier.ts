"use client";

import { create } from "zustand";
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
  /** Geri sayımı tarayıcı saatinden günceller (saniyede bir çağrılır). */
  tickOffer: () => void;
  /** Cihazdan gelen konumu panoya hemen yansıtır. */
  setActivePoint: (point: LatLng) => void;
}

export const useCourier = create<CourierState>()((set) => ({
  status: "loading",
  courier: null,
  stats: null,
  offer: null,
  activeOrder: null,

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
}));
