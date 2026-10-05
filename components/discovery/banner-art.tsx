import Image from "next/image";
import type { Banner } from "@/lib/types";

/**
 * Afişin sağındaki yemek fotoğrafı. Fotoğraf soldan saydamlaşarak afişin
 * degradesine karışır; yazı her zaman düz renk üstünde okunur kalır.
 * Fotoğrafsız eski afişlerde sağ üstte iç içe yarım halkalar çizilir —
 * degradeyi boş bırakmayan sakin bir süs.
 */
export function BannerArt({
  banner,
  sizes,
}: {
  banner: Pick<Banner, "image">;
  /** Fotoğrafın ekranda kapladığı genişlik */
  sizes: string;
}) {
  if (!banner.image) {
    return (
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56">
        <span className="absolute inset-0 rounded-full border-[18px] border-white/10" />
        <span className="absolute inset-10 rounded-full border-[14px] border-white/10" />
        <span className="absolute inset-[4.75rem] rounded-full bg-white/10" />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className="absolute inset-y-0 right-0 w-[50%] [mask-image:linear-gradient(to_right,transparent,#000_50%)]"
    >
      <Image
        src={banner.image}
        alt=""
        fill
        sizes={sizes}
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
      />
    </span>
  );
}
