import Constants from "expo-constants";
import { Platform } from "react-native";
import { createApiClient, type ApiClient } from "@sofra/core";
import { readToken, clearToken } from "./token-store";

/**
 * Mobil API istemcisi.
 *
 * Sunucu web uygulamasının ta kendisi — mobil için ayrı bir backend yok.
 * Aynı `/api/v1` uç noktaları kullanılır; tek fark kimliğin çerez yerine
 * `Authorization: Bearer <token>` başlığıyla taşınması. Sunucu her iki
 * kaynağı da kabul ettiği için bu tamamen istemci tarafı bir ayrımdır.
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

  // Web'de uygulama zaten aynı origin'den servis edilmiyor; sunucu 3000'de.
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

/** Oturum düştüğünde tetiklenir; `session` deposu buraya abone olur. */
let unauthorizedHandler: (() => void) | null = null;

export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler;
}

function client(role: "customer" | "courier"): ApiClient {
  return createApiClient({
    baseUrl: API_BASE_URL,
    getToken: () => readToken(role),
    onUnauthorized: () => {
      void clearToken(role);
      unauthorizedHandler?.();
    },
  });
}

/** Müşteri uçları — `/api/v1/...` */
export const api = client("customer");

/** Kurye uçları — `/api/v1/courier/...` */
export const courierApi = client("courier");

export { ApiError, errorMessage, isOffline, isUnauthorized } from "@sofra/core";
