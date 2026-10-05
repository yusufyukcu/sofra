import Image from "next/image";
import { cuisineIcon } from "@sofra/core";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * Sepet, ödeme ve sipariş ekranlarındaki küçük restoran görseli.
 * Fotoğraf yoksa (fotoğraflardan önce verilmiş siparişler, panelden yeni
 * katılan restoranlar) mutfağın ikonu gösterilir.
 */
export function RestaurantThumb({
  image,
  tone,
  className,
  iconClassName = "size-5",
}: {
  image?: string;
  /** Mutfak etiketi — fotoğraf yoksa ikon buna göre seçilir */
  tone?: string;
  /** Boyut ve köşe yuvarlaklığı, ör. `size-11 rounded-xl` */
  className: string;
  iconClassName?: string;
}) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden bg-brand-soft text-brand",
        className
      )}
    >
      {image ? (
        <Image src={image} alt="" fill sizes="64px" className="object-cover" />
      ) : (
        <Icon name={cuisineIcon(tone)} className={iconClassName} strokeWidth={1.9} />
      )}
    </span>
  );
}
