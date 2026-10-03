import { create } from "zustand";
import type { Courier } from "@sofra/core";
import { courierApi, onUnauthorized } from "@/lib/api";
import { clearToken, saveAuthPayload } from "@/lib/token-store";

/**
 * Kurye oturumu.
 *
 * Müşteri oturumundan tamamen ayrı: farklı token, farklı anahtar, farklı
 * uç noktalar. İkisi aynı anda açık kalabilir — kurye olarak mesaideyken
 * müşteri olarak sipariş vermeni engelleyen bir şey yok, tıpkı webde iki
 * ayrı çerezin birlikte durması gibi.
 *
 * Giriş telefon + SMS koduyla yapılır (test modunda kod ekranda görünür).
 * Kalıcı depoya yazılmaz; token çifti zaten güvenli alanda duruyor ve
 * açılışta `restore()` ile doğrulanıyor.
 */

export interface CourierOtpChallenge {
  challengeId: string;
  maskedTarget: string;
  expiresInSeconds: number;
  /** Yalnızca test modunda (SMS sağlayıcısı bağlı değilken) */
  devCode?: string;
}

interface CourierState {
  status: "loading" | "authenticated" | "guest";
  courier: Courier | null;

  restore: () => Promise<void>;
  /** 1. adım: telefona doğrulama kodu */
  startLogin: (phone: string) => Promise<CourierOtpChallenge>;
  /** 2. adım: kodu doğrula, oturumu aç */
  verifyLogin: (challengeId: string, code: string) => Promise<void>;
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

  startLogin: (phone) =>
    courierApi.post<CourierOtpChallenge>("/courier/auth/otp/start", { phone }),

  verifyLogin: async (challengeId, code) => {
    const data = await courierApi.post<{
      courier: Courier;
      accessToken: string;
      refreshToken: string;
      expiresAt: number | null;
    }>("/courier/auth/otp/verify", { challengeId, code });
    await saveAuthPayload("courier", data);
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

/** Kurye oturumu düşerse yalnızca kurye ekranı girişe döner (müşteri oturumu etkilenmez). */
onUnauthorized("courier", () => {
  if (useCourier.getState().status === "authenticated") {
    useCourier.setState({ status: "guest", courier: null });
  }
});
