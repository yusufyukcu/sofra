import { BRAND_COLORS, LOGO_MARK, LOGO_VIEWBOX } from "@sofra/core";
import { cn } from "@/lib/utils";

/**
 * Buharlı kâse işareti — buhar Sofra'nın "S"sini çizer.
 * Rengi `currentColor`'dan alır; geometri `@sofra/core`'daki `LOGO_MARK`'ta.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  const { bowl, steam } = LOGO_MARK;
  return (
    <svg
      viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`}
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path d={bowl} fill="currentColor" />
      <path
        d={steam.d}
        fill="none"
        stroke="currentColor"
        strokeWidth={steam.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Kırmızı kare içinde krem işaret — uygulama simgesinin kendisi. Panel
 * kabuklarında ve giriş ekranlarında logo yerine kullanılır.
 */
export function LogoTile({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl bg-brand shadow-brand",
        className ?? "size-10"
      )}
      style={{ color: BRAND_COLORS.cream }}
    >
      <LogoMark className={markClassName ?? "size-[72%]"} />
    </span>
  );
}

/**
 * Logo: işaret + "sofra" yazısı. Yazı her zaman küçük harf — marka adı
 * cümle içinde "Sofra" diye geçer, logoda bir resim gibi durur.
 *
 * `tone="brand"`: açık zeminde kırmızı işaret, koyu yazı.
 * `tone="light"`: koyu zeminde krem.
 */
export function Logo({
  tone = "brand",
  size = "md",
  showWordmark = true,
  className,
  wordmarkClassName,
}: {
  tone?: "brand" | "light";
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
  /** Ör. dar ekranda yazıyı gizlemek için `hidden sm:inline` */
  wordmarkClassName?: string;
}) {
  const mark = { sm: "size-7", md: "size-9", lg: "size-12" }[size];
  const text = { sm: "text-[1.4rem]", md: "text-[1.75rem]", lg: "text-[2.4rem]" }[size];
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <LogoMark className={cn(mark, "shrink-0", tone === "brand" ? "text-brand" : "text-on-deep")} />
      {showWordmark && (
        <span
          className={cn(
            "font-display font-extrabold leading-none tracking-[-0.045em]",
            text,
            tone === "brand" ? "text-ink" : "text-on-deep",
            wordmarkClassName
          )}
        >
          sofra
        </span>
      )}
    </span>
  );
}
