import { create } from "zustand";
import type { Courier } from "@sofra/core";
import { courierApi } from "@/lib/api";
import { clearToken, saveToken } from "@/lib/token-store";

/**
 * Kurye oturumu.
 *
 * Müşteri oturumundan tamamen ayrı: farklı token, farklı anahtar, farklı
 * uç noktalar. İkisi aynı anda açık kalabilir — kurye olarak mesaideyken
 * müşteri olarak sipariş vermeni engelleyen bir şey yok, tıpkı webde iki
 * ayrı çerezin birlikte durması gibi.
 *
 * Kalıcı depoya yazılmaz; token zaten güvenli alanda duruyor ve açılışta
 * `restore()` ile doğrulanıyor.
 */

interface CourierState {
  status: "loading" | "authenticated" | "guest";
  courier: Courier | null;

  restore: () => Promise<void>;
  login: (courierId: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  setCourier: (courier: Courier) => void;
}

export const useCourier = create<CourierState>()((set) => ({
  status: "loading",
  courier: null,

  restore: async () => {
    try {
      const data = await courierApi.get<{ courier: Courier }>("/courier/auth/me");
      set({ status: "authenticated", courier: data.courier });
    } catch {
      set({ status: "guest", courier: null });
    }
  },

  login: async (courierId, pin) => {
    const data = await courierApi.post<{
      courier: Courier;
      accessToken: string;
    }>("/courier/auth/login", { courierId, pin });
    await saveToken("courier", data.accessToken);
    set({ status: "authenticated", courier: data.courier });
  },

  logout: async () => {
    try {
      await courierApi.post("/courier/auth/logout");
    } catch {
      /* çevrimdışıyken de yerel oturum kapanmalı */
    } finally {
      await clearToken("courier");
      set({ status: "guest", courier: null });
    }
  },

  setCourier: (courier) => set({ courier }),
}));
