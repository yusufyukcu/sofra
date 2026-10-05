import { avatarFor } from "@sofra/core/brand";
import { cn } from "@/lib/utils";

/**
 * Baş harfli avatar — emoji yerine. Renk isimden türer, aynı kişi her
 * ekranda aynı rengi alır. Boyut ve yazı büyüklüğü `className` ile verilir.
 */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const { initials, color } = avatarFor(name);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold tracking-tight text-white",
        className ?? "size-9 text-sm"
      )}
      style={{ backgroundColor: color }}
    >
      {initials}
    </span>
  );
}
