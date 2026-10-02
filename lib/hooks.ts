"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * İstemci tarafında bağlanmanın (hydration) tamamlandığını bildirir.
 * localStorage'dan beslenen durumları (sepet, tema) sunucu çıktısıyla
 * uyuşmazlık yaratmadan göstermek için kullanılır.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/** Değeri belirtilen gecikmeyle geciktirir. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Yatay kaydırılan bir rayın iki yönde de devamı olup olmadığını izler.
 * Masaüstü oklarını yalnızca gidilecek yer varken göstermek için kullanılır.
 * Raya öğe eklenip çıkarıldığında (filtre sayaçları değişince) da yenilenir.
 */
export function useScrollEdges(ref: RefObject<HTMLElement | null>) {
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const start = el.scrollLeft > 4;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
      setEdges((prev) =>
        prev.start === start && prev.end === end ? prev : { start, end }
      );
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(el);
    const mutation = new MutationObserver(update);
    mutation.observe(el, { childList: true });
    return () => {
      el.removeEventListener("scroll", update);
      resize.disconnect();
      mutation.disconnect();
    };
  }, [ref]);

  return edges;
}

/** Ekran genişliği eşiğini izler. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}
