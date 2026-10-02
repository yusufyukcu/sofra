import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import type { ApiClient } from "@sofra/core";

/**
 * Canlı veri kancası.
 *
 * Web uygulaması bu verileri Server-Sent Events ile alıyor. React Native'de
 * `EventSource` yok ve `fetch` gövdesi güvenilir biçimde akış olarak
 * okunamıyor, bu yüzden mobilde aynı uç noktanın GET karşılığı düzenli
 * aralıklarla yoklanıyor. Sunucu sözleşmesi ikisinde de aynı — SSE uçları
 * `/stream` ile bitiyor, GET karşılıkları aynı gövdeyi tek seferde dönüyor.
 *
 * Uygulama arka plana alındığında yoklama durur; öne geldiğinde hemen bir
 * tur atıp devam eder. Böylece telefon boşuna istek atıp pil harcamaz.
 */

export interface LiveOptions {
  /** Yoklama aralığı (ms). Sipariş takibinde 2 sn, kurye panosunda 3 sn. */
  intervalMs?: number;
  /** `false` olduğunda yoklama durur — ör. sipariş teslim edilince. */
  enabled?: boolean;
}

export interface LiveResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** Elle yenileme — aşağı çekerek yenilemede kullanılır. */
  refresh: () => Promise<void>;
}

export function useLive<T>(
  client: ApiClient,
  path: string,
  { intervalMs = 2000, enabled = true }: LiveOptions = {}
): LiveResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Ekran kapanırken uçan isteğin `setState` çağırmasını engeller.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const fetchOnce = useCallback(async () => {
    try {
      const result = await client.get<T>(path);
      if (!alive.current) return;
      setData(result);
      setError(null);
    } catch (err) {
      if (!alive.current) return;
      setError(err instanceof Error ? err.message : "Bağlantı hatası");
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [client, path]);

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      void fetchOnce();
      timer = setInterval(() => void fetchOnce(), intervalMs);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    start();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") start();
      else stop();
    });

    return () => {
      stop();
      sub.remove();
    };
  }, [enabled, fetchOnce, intervalMs]);

  return { data, error, loading, refresh: fetchOnce };
}
