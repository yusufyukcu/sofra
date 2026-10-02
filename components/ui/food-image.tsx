import Image from "next/image";
import { foodArtwork } from "@sofra/core";
import { cn } from "@/lib/utils";

/**
 * Yemek görseli.
 *
 * `src` varsa gerçek fotoğraf gösterilir; `next/image` kullanılan alanın
 * genişliğine (`sizes`) göre küçültülmüş WebP üretir, kart başına koca
 * dosya inmez. Fotoğraf yüklenene kadar — ya da hiç yoksa — mutfağa göre
 * renklenen katmanlı degrade görünür: kebapçı sıcak kırmızı, sağlıklı
 * mutfak yeşil, balıkçı mavi. Böylece satıcının sonradan eklediği,
 * fotoğrafı olmayan ürünler de listede kırık görsel bırakmaz.
 *
 * Renkler ve geometri `@sofra/core`'daki `foodArtwork` ile üretilir; mobil
 * uygulama aynı fonksiyonu SVG ile çizdiği için yer tutucu iki istemcide
 * birebir aynıdır.
 */
export function FoodImage({
  seed,
  emoji,
  tone,
  src,
  alt,
  className,
  rounded = "rounded-xl",
  emojiClassName,
  sizes = "100vw",
  eager = false,
}: {
  seed: string;
  emoji: string;
  /** Mutfak etiketi; verilmezse tohumdan deterministik olarak seçilir */
  tone?: string;
  src?: string;
  alt?: string;
  className?: string;
  rounded?: string;
  emojiClassName?: string;
  /** Görselin ekranda kapladığı genişlik — `next/image` buna göre boyut seçer */
  sizes?: string;
  /** Sayfanın ilk ekranındaki ana görsel (LCP) için hemen yükle */
  eager?: boolean;
}) {
  const { blobs, base, centers, angle, rotate } = foodArtwork(seed, tone);
  const [b1, b2, b3] = blobs;
  const [base1, base2] = base;

  return (
    <div
      role={src ? undefined : "img"}
      aria-label={src ? undefined : (alt ?? "")}
      className={cn(
        "relative flex items-center justify-center overflow-hidden isolate",
        // Film greni yalnızca çizimde; fotoğrafın üstüne binmesin
        !src && "grain",
        rounded,
        className
      )}
      style={{
        backgroundColor: base2,
        backgroundImage: [
          `radial-gradient(58% 68% at ${centers[0][0]}% ${centers[0][1]}%, ${b1} 0%, transparent 68%)`,
          `radial-gradient(52% 62% at ${centers[1][0]}% ${centers[1][1]}%, ${b2} 0%, transparent 66%)`,
          `radial-gradient(74% 82% at ${centers[2][0]}% ${centers[2][1]}%, ${b3} 0%, transparent 72%)`,
          `linear-gradient(${angle}deg, ${base1} 0%, ${base2} 100%)`,
        ].join(","),
      }}
    >
      {src ? (
        <Image
          src={src}
          alt={alt ?? ""}
          fill
          sizes={sizes}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          className="object-cover"
        />
      ) : (
        <>
          {/* Üstten gelen yumuşak ışık — üzerine yazılan metin okunur kalsın */}
          <span
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              backgroundImage:
                "linear-gradient(to bottom, rgba(255,255,255,.16) 0%, transparent 42%, rgba(0,0,0,.28) 100%)",
            }}
          />

          <span
            aria-hidden
            className={cn(
              "relative select-none leading-none",
              emojiClassName ?? "text-[2.75rem]"
            )}
            style={{
              transform: `rotate(${rotate}deg)`,
              filter: "drop-shadow(0 6px 14px rgba(0,0,0,.38))",
            }}
          >
            {emoji}
          </span>
        </>
      )}
    </div>
  );
}
