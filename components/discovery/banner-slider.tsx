"use client";

import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useScrollEdges } from "@/lib/hooks";
import type { Banner } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ScrollArrow } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { BannerArt } from "./banner-art";

/**
 * Kampanya afişleri (slider).
 * Dokunmatik kaydırma için `scroll-snap`, masaüstü için ok düğmeleri
 * ve 6 saniyede bir otomatik ilerleme. Masaüstünde üç, tablette iki afiş
 * tam görünür; mobilde sıradakinin ucu ekranın kenarından görünür ki
 * kaydırılabildiği anlaşılsın.
 */
export function BannerSlider({ banners }: { banners: Banner[] }) {
  const router = useRouter();
  const toast = useToast();
  const trackRef = useRef<HTMLDivElement>(null);
  const edges = useScrollEdges(trackRef);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  /** Afişi rayın başına hizalar — ilk afişin durduğu yere. */
  const scrollTo = useCallback((i: number) => {
    const track = trackRef.current;
    const first = track?.children[0] as HTMLElement | undefined;
    const target = track?.children[i] as HTMLElement | undefined;
    if (track && first && target) {
      track.scrollTo({ left: target.offsetLeft - first.offsetLeft, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    if (paused || banners.length < 2) return;
    const timer = setTimeout(() => {
      const track = trackRef.current;
      if (!track) return;
      // Masaüstünde son afişler birlikte görünür; sona gelince başa dön
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      scrollTo(atEnd ? 0 : index + 1);
    }, 6000);
    return () => clearTimeout(timer);
  }, [paused, banners.length, index, scrollTo]);

  function onScroll() {
    const track = trackRef.current;
    if (!track) return;
    const children = Array.from(track.children) as HTMLElement[];
    const origin = children[0]?.offsetLeft ?? 0;
    const closest = children.reduce(
      (best, child, i) => {
        const distance = Math.abs(child.offsetLeft - origin - track.scrollLeft);
        return distance < best.distance ? { i, distance } : best;
      },
      { i: 0, distance: Infinity }
    );
    setIndex(closest.i);
  }

  return (
    <section
      aria-label="Kampanyalar"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <div className="relative">
        {/* Alttaki boşluk gölge kırpılmasın diye; eksi pay düzeni korur */}
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="no-scrollbar -mx-4 -mb-3 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-3 lg:mx-0 lg:scroll-px-0 lg:px-0"
        >
          {banners.map((banner) => (
            <button
              key={banner.id}
              type="button"
              onClick={() => {
                if (banner.code) {
                  navigator.clipboard?.writeText(banner.code).then(
                    () => toast.success(`"${banner.code}" kodu kopyalandı.`),
                    () => undefined
                  );
                }
                router.push(banner.href);
              }}
              className="group relative flex w-[85%] shrink-0 snap-start items-center gap-4 overflow-hidden rounded-3xl p-5 text-left text-white shadow-soft transition-transform active:scale-[0.99] sm:w-[calc((100%-1rem)/2)] sm:p-6 lg:w-[calc((100%-2rem)/3)]"
              style={{
                backgroundImage: `linear-gradient(120deg, ${banner.gradient[0]}, ${banner.gradient[1]})`,
              }}
            >
              <BannerArt
                banner={banner}
                sizes="(min-width: 1024px) 220px, (min-width: 640px) 26vw, 45vw"
              />
              <span className={cn("relative min-w-0 flex-1", banner.image && "pr-[34%]")}>
                <span className="font-display block text-xl font-extrabold leading-tight sm:text-2xl lg:text-xl xl:text-[1.375rem]">
                  {banner.title}
                </span>
                <span className="mt-1.5 block text-sm text-white/85">
                  {banner.subtitle}
                </span>
                {banner.code && (
                  <span className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-bold backdrop-blur">
                    <Copy className="size-3.5" />
                    {banner.code}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        <ScrollArrow
          direction="prev"
          visible={edges.start}
          onClick={() => scrollTo(Math.max(0, index - 1))}
          label="Önceki kampanya"
        />
        <ScrollArrow
          direction="next"
          visible={edges.end}
          onClick={() => scrollTo(Math.min(banners.length - 1, index + 1))}
          label="Sonraki kampanya"
        />
      </div>

      {/* Noktalar yalnızca tek afişin göründüğü mobilde konumu anlatır */}
      <div className="mt-4 flex justify-center gap-1.5 sm:hidden">
        {banners.map((banner, i) => (
          <button
            key={banner.id}
            type="button"
            aria-label={`${i + 1}. kampanya`}
            onClick={() => scrollTo(i)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === index ? "w-6 bg-brand" : "w-1.5 bg-border-strong"
            )}
          />
        ))}
      </div>
    </section>
  );
}
