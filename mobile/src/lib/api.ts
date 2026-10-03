import Constants from "expo-constants";
import { Platform } from "react-native";
import { API_PREFIX, createApiClient, type ApiClient } from "@sofra/core";
import { clearToken, readSession, readToken, saveSession, type Role } from "./token-store";

/**
 * Mobil API istemcisi.
 *
 * Sunucu web uygulamasının ta kendisi — mobil için ayrı bir backend yok.
 * Aynı `/api/v1` uç noktaları kullanılır; tek fark kimliğin çerez yerine
 * `Authorization: Bearer <token>` başlığıyla taşınması.
 *
 * Erişim token'ı 1 saat geçerlidir. Bitmesine 2 dakika kala ya da sunucu
 * 401 dönerse yenileme token'ıyla (`POST /auth/refresh`) yenisi alınır ve
 * istek tekrarlanır; yenileme de reddedilirse oturum düşer.
 */

/**
 * Sunucu adresini bulur.
 *
 * Sıra: açık ayar (`EXPO_PUBLIC_SOFRA_API`) → Metro'yu çalıştıran makinenin
 * LAN adresi → localhost. İkinci adım önemli: telefon `localhost`'u kendi
 * cihazı sanacağı için geliştirme sırasında bilgisayarın IP'si gerekir ve
 * Expo bunu zaten `hostUri` içinde biliyor.
 */
export function resolveBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_SOFRA_API;
  if (explicit) return explicit.replace(/\/+$/, "");

  const hostUri = Constants.expoConfig?.hostUri;

  const host = hostUri?.split(":")[0];
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:3000`;
  }

  // Android emülatörü ana makineye 10.0.2.2 üzerinden ulaşır.
  if (Platform.OS === "android") return "http://10.0.2.2:3000";
  return "http://localhost:3000";
}

export const API_BASE_URL = resolveBaseUrl();

/** Oturum düştüğünde tetiklenir; her rolün deposu kendi işleyicisini bağlar. */
const unauthorizedHandlers: Partial<Record<Role, () => void>> = {};

export function onUnauthorized(role: Role, handler: () => void) {
  unauthorizedHandlers[role] = handler;
}

const refreshing: Partial<Record<Role, Promise<boolean>>> = {};

/** Yenileme token'ıyla yeni oturum alır; aynı anda tek istek gider. */
export function refreshSession(role: Role): Promise<boolean> {
  const current = readSession(role);
  if (!current?.refreshToken) return Promise.resolve(false);

  refreshing[role] ??= (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok: true; data: { accessToken: string; refreshToken: string; expiresAt: number | null } }
        | { ok: false }
        | null;
      if (!res.ok || !body || body.ok !== true) {
        // Yenileme token'ı geçersiz: oturum gerçekten bitti
        if (res.status === 400 || res.status === 401) await clearToken(role);
        return false;
      }
      await saveSession(role, {
        accessToken: body.data.accessToken,
        refreshToken: body.data.refreshToken,
        expiresAt: body.data.expiresAt,
      });
      return true;
    } catch {
      return false; // ağ hatası: eldeki oturumla devam
    } finally {
      delete refreshing[role];
    }
  })();
  return refreshing[role]!;
}

async function freshToken(role: Role): Promise<string | null> {
  const session = readSession(role);
  if (!session) return null;
  if (session.expiresAt && session.expiresAt * 1000 - Date.now() < 120_000) {
    await refreshSession(role);
  }
  return readToken(role);
}

function client(role: Role): ApiClient {
  return createApiClient({
    baseUrl: API_BASE_URL,
    getToken: () => freshToken(role),
    refreshOnUnauthorized: () => refreshSession(role),
    onUnauthorized: () => {
      void clearToken(role);
      unauthorizedHandlers[role]?.();
    },
  });
}

/** Müşteri uçları — `/api/v1/...` */
export const api = client("customer");

/** Kurye uçları — `/api/v1/courier/...` */
export const courierApi = client("courier");

export { ApiError, errorMessage, isOffline, isUnauthorized } from "@sofra/core";
