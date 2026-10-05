import Image from "next/image";
import { cuisineIcon, foodArtwork } from "@sofra/core";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * Yemek görseli.
 *
 * `src` varsa gerçek fotoğraf gösterilir; `next/image` kullanılan alanın
 * genişliğine (`sizes`) göre küçültülmüş WebP üretir, kart başına koca
 * dosya inmez. Fotoğraf yüklenene kadar — ya da hiç yoksa — mutfağa göre
 * renklenen katmanlı degrade ve ortasında mutfağın ikonu görünür: kebapçı
 * sıcak kırmızı, sağlıklı mutfak yeşil, balıkçı mavi. Böylece satıcının
 * sonradan eklediği, fotoğrafı olmayan ürünler de listede kırık görsel
 * bırakmaz.
 *
 * Renkler ve geometri `@sofra/core`'daki `foodArtwork` ile üretilir; mobil
 * uygulama aynı fonksiyonu SVG ile çizdiği için yer tutucu iki istemcide
 * birebir aynıdır.
 *
 * `zoom`: kart üzerine gelince fotoğraf hafifçe yaklaşır — kartın kendisi
 * `group` sınıfını taşımalı.
 */
export function FoodImage({
  seed,
  tone,
  src,
  alt,
  className,
  rounded = "rounded-xl",
  iconClassName,
  sizes = "100vw",
  eager = false,
  zoom = false,
}: {
  seed: string;
  /** Mutfak etiketi; renk ve ikon buna göre seçilir */
  tone?: string;
  src?: string;
  alt?: string;
  className?: string;
  rounded?: string;
  /** Yer tutucu ikonunun boyutu, ör. `size-8` */
  iconClassName?: string;
  /** Görselin ekranda kapladığı genişlik — `next/image` buna göre boyut seçer */
  sizes?: string;
  /** Sayfanın ilk ekranındaki ana görsel (LCP) için hemen yükle */
  eager?: boolean;
  zoom?: boolean;
}) {
  const { blobs, base, centers, angle } = foodArtwork(seed, tone);
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
          className={cn(
            "object-cover",
            zoom && "transition-transform duration-500 ease-out group-hover:scale-[1.045]"
          )}
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
            className="relative flex items-center justify-center rounded-full bg-white/15 p-[0.7rem] ring-1 ring-white/25"
          >
            <Icon
              name={cuisineIcon(tone)}
              className={cn("text-white drop-shadow-[0_3px_8px_rgba(0,0,0,.35)]", iconClassName ?? "size-9")}
              strokeWidth={1.7}
            />
          </span>
        </>
      )}
    </div>
  );
}
