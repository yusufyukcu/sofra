import { createApiClient } from "@sofra/core";

/**
 * Web istemcisi.
 *
 * Gerçek uygulama `packages/core/src/api-client.ts` içinde — mobil de aynı
 * fabrikayı kullanır. Web'de kimlik `httpOnly` çerezle taşındığı için
 * `credentials: "include"` yeterli; mobilde aynı fabrikaya token sağlayıcı
 * verilir ve kimlik `Authorization: Bearer` başlığına yazılır.
 */

export { ApiError, errorMessage, isOffline, isUnauthorized } from "@sofra/core";

/** Aynı origin — göreli yol yeterli. */
export const API_BASE = "/api/v1";

export const api = createApiClient({ credentials: "include" });

export const apiFetch = api.request;
