import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Sepet, ödeme ve sipariş ekranlarındaki küçük restoran görseli.
 * Fotoğraf yoksa (fotoğraflardan önce verilmiş siparişler, panelden yeni
 * katılan restoranlar) eskisi gibi emoji gösterilir.
 */
export function RestaurantThumb({
  image,
  emoji,
  className,
  emojiClassName = "text-xl",
}: {
  image?: string;
  emoji: string;
  /** Boyut ve köşe yuvarlaklığı, ör. `size-11 rounded-xl` */
  className: string;
  emojiClassName?: string;
}) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden bg-surface-2",
        emojiClassName,
        className
      )}
    >
      {image ? (
        <Image src={image} alt="" fill sizes="56px" className="object-cover" />
      ) : (
        <span aria-hidden>{emoji}</span>
      )}
    </span>
  );
}
