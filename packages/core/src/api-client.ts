import type { ApiResponse } from "./types";

/**
 * Paylaşılan API istemcisi.
 *
 * Tüm uç noktalar `{ ok, data } | { ok, error }` zarfını döndürdüğü için
 * zarfı tek noktadan açıp hataları `ApiError` olarak fırlatıyoruz.
 *
 * İki istemci de aynı fonksiyonu kullanır, yalnızca yapılandırması farklıdır:
 *
 * - **Web**: `baseUrl` boş (aynı origin), kimlik `httpOnly` çerezle taşınır.
 * - **Mobil**: `baseUrl` sunucunun tam adresi, kimlik `getToken()` ile
 *   `Authorization: Bearer <token>` başlığına yazılır.
 */

export const API_PREFIX = "/api/v1";

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

/** Ağa hiç çıkamadık: sunucu kapalı, telefon çevrimdışı, DNS yok. */
export function isOffline(err: unknown): boolean {
  return err instanceof ApiError && err.code === "network_error";
}

/** Oturum düşmüş — istemci giriş ekranına dönmeli. */
export function isUnauthorized(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    (err.status === 401 ||
      err.code === "unauthorized" ||
      err.code === "courier_unauthorized" ||
      err.code === "vendor_unauthorized" ||
      err.code === "admin_unauthorized")
  );
}

export interface ApiClientConfig {
  /** Sunucu kökü. Web'de boş bırakılır, mobilde `http://192.168.1.5:3000`. */
  baseUrl?: string;
  /** Mobilde token sağlayıcı. Döndürdüğü değer Bearer başlığına yazılır. */
  getToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /** Web'de `"include"` — çerezin gönderilmesi için gerekir. */
  credentials?: RequestCredentials;
  /** Oturum düştüğünde çağrılır (mobilde giriş ekranına dönmek için). */
  onUnauthorized?: () => void;
  /** Saniye cinsinden istek zaman aşımı. Mobil ağlarda gerekli. */
  timeoutSeconds?: number;
}

export interface ApiClient {
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  patch: <T>(path: string, body?: unknown) => Promise<T>;
  delete: <T>(path: string) => Promise<T>;
  /** Dosya yükleme — `multipart/form-data` sınırını tarayıcı belirler. */
  upload: <T>(path: string, form: FormData) => Promise<T>;
  /** SSE veya harici kullanım için tam URL üretir. */
  url: (path: string) => string;
}

export function createApiClient(config: ApiClientConfig = {}): ApiClient {
  const {
    baseUrl = "",
    getToken,
    credentials,
    onUnauthorized,
    timeoutSeconds = 20,
  } = config;

  const url = (path: string) => `${baseUrl}${API_PREFIX}${path}`;

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    // FormData'da içerik türünü (ve sınırını) istemci kendisi yazar
    const isForm =
      typeof FormData !== "undefined" && init.body instanceof FormData;
    const hasBody = init.body !== undefined && !isForm;
    const token = getToken ? await getToken() : null;

    // Ağ tamamen yanıt vermezse istek sonsuza kadar askıda kalmasın.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutSeconds * 1000);

    let response: Response;
    try {
      response = await fetch(url(path), {
        ...init,
        signal: init.signal ?? controller.signal,
        ...(credentials ? { credentials } : {}),
        headers: {
          ...(hasBody ? { "content-type": "application/json" } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...init.headers,
        },
      });
    } catch {
      throw new ApiError(
        "network_error",
        "Sunucuya ulaşılamadı. Bağlantını kontrol et.",
        0
      );
    } finally {
      clearTimeout(timer);
    }

    let payload: ApiResponse<T> | null = null;
    try {
      payload = (await response.json()) as ApiResponse<T>;
    } catch {
      throw new ApiError(
        "network_error",
        "Sunucuya ulaşılamadı. Bağlantını kontrol et.",
        response.status
      );
    }

    if (!payload || payload.ok !== true) {
      const error = payload && payload.ok === false ? payload.error : null;
      const apiError = new ApiError(
        error?.code ?? "unknown_error",
        error?.message ?? "Beklenmeyen bir hata oluştu.",
        response.status
      );
      if (onUnauthorized && isUnauthorized(apiError)) onUnauthorized();
      throw apiError;
    }

    return payload.data;
  }

  return {
    request,
    url,
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body?: unknown) =>
      request<T>(path, {
        method: "POST",
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    patch: <T>(path: string, body?: unknown) =>
      request<T>(path, {
        method: "PATCH",
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
    upload: <T>(path: string, form: FormData) =>
      request<T>(path, { method: "POST", body: form }),
  };
}

/** Hata nesnesinden kullanıcıya gösterilecek mesajı çıkarır. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Beklenmeyen bir hata oluştu.";
}
