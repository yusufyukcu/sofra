import Image from "next/image";
import type { Banner } from "@/lib/types";

/**
 * Afişin sağındaki yemek fotoğrafı. Fotoğraf soldan saydamlaşarak afişin
 * degradesine karışır; yazı her zaman düz renk üstünde okunur kalır.
 * Yöneticinin panelden eklediği fotoğrafsız afişlerde emoji süsü çizilir.
 */
export function BannerArt({
  banner,
  sizes,
  emojiClassName,
}: {
  banner: Banner;
  /** Fotoğrafın ekranda kapladığı genişlik */
  sizes: string;
  /** Fotoğraf yoksa emojinin konumu ve boyutu */
  emojiClassName: string;
}) {
  if (!banner.image) {
    return (
      <span aria-hidden className={emojiClassName}>
        {banner.emoji}
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className="absolute inset-y-0 right-0 w-[48%] [mask-image:linear-gradient(to_right,transparent,#000_55%)]"
    >
      <Image
        src={banner.image}
        alt=""
        fill
        sizes={sizes}
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />
    </span>
  );
}
