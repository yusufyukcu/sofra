"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { api } from "../api-client";
import type { Restaurant } from "../types";
import type { VendorSummary } from "../services/vendor";

/**
 * Restoran paneli oturumu.
 * Müşteri oturumundan bağımsızdır; aynı tarayıcıda ikisi birlikte açık
 * kalabilir (restoran sahibi kendi uygulamasından sipariş verebilsin diye).
 */

interface VendorProfile {
  id: string;
  name: string;
  email: string;
}

interface VendorState {
  status: "loading" | "authenticated" | "guest";
  vendor: VendorProfile | null;
  restaurant: Restaurant | null;
  summary: VendorSummary | null;
  /** Mutfak tabletinde zil açık mı (kullanıcı hareketiyle açılır) */
  soundEnabled: boolean;

  bootstrap: () => Promise<void>;
  applyAuth: (payload: {
    vendor: VendorProfile;
    restaurant: Restaurant;
  }) => void;
  logout: () => Promise<void>;
  setRestaurant: (restaurant: Restaurant) => void;
  setSummary: (summary: VendorSummary) => void;
  setSoundEnabled: (enabled: boolean) => void;
}

interface MeResponse {
  vendor: VendorProfile;
  restaurant: Restaurant;
  summary: VendorSummary;
}

export const useVendor = create<VendorState>()(
  persist(
    (set) => ({
      status: "loading",
      vendor: null,
      restaurant: null,
      summary: null,
      soundEnabled: false,

      bootstrap: async () => {
        try {
          const data = await api.get<MeResponse>("/vendor/auth/me");
          set({
            status: "authenticated",
            vendor: data.vendor,
            restaurant: data.restaurant,
            summary: data.summary,
          });
        } catch {
          set({
            status: "guest",
            vendor: null,
            restaurant: null,
            summary: null,
          });
        }
      },

      applyAuth: ({ vendor, restaurant }) =>
        set({ status: "authenticated", vendor, restaurant }),

      logout: async () => {
        try {
          await api.post("/vendor/auth/logout");
        } finally {
          set({
            status: "guest",
            vendor: null,
            restaurant: null,
            summary: null,
          });
        }
      },

      setRestaurant: (restaurant) => set({ restaurant }),
      setSummary: (summary) => set({ summary }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
    }),
    {
      name: "sofra:vendor",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ soundEnabled: state.soundEnabled }),
    }
  )
);
