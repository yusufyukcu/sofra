import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Anasayfa vitrininin sağındaki fotoğraf kolajı: dört tabak, hafif açılarla
 * üst üste. Koyu bandın üstünde yemeklerin renkleri öne çıkar. Yalnızca
 * geniş ekranda görünür; ilk ekrandaki en büyük görsel olduğu için ortadaki
 * fotoğraf hemen yüklenir.
 */
const PLATES = [
  {
    src: "/images/food/pizza-margherita.webp",
    className: "left-[3%] top-[9%] w-[60%] rotate-[-4deg] z-20",
    sizes: "260px",
    eager: true,
  },
  {
    src: "/images/food/burger-classic.webp",
    className: "right-0 top-0 w-[44%] rotate-[5deg] z-30",
    sizes: "190px",
  },
  {
    src: "/images/food/baklava.webp",
    className: "bottom-[1%] left-[14%] w-[38%] rotate-[-6deg] z-30",
    sizes: "160px",
  },
  {
    src: "/images/food/adana-kebap.webp",
    className: "bottom-[6%] right-[3%] w-[44%] rotate-[3deg] z-20",
    sizes: "190px",
  },
] as const;

export function HeroArt({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative aspect-[5/4]", className)}>
      {PLATES.map((plate) => (
        <div
          key={plate.src}
          className={cn(
            "absolute aspect-[4/3] overflow-hidden rounded-[1.4rem] shadow-[0_24px_48px_-16px_rgba(0,0,0,.6)] ring-4 ring-deep",
            plate.className
          )}
        >
          <Image
            src={plate.src}
            alt=""
            fill
            sizes={plate.sizes}
            loading={"eager" in plate ? "eager" : "lazy"}
            fetchPriority={"eager" in plate ? "high" : undefined}
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}
