"use client";

import { Bike, Clock, Heart, MapPin, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/lib/api-client";
import { CATEGORIES } from "@/lib/constants";
import { restaurantPhoto } from "@/lib/photos";
import { useSession } from "@/lib/store/session";
import type { RestaurantListItem } from "@/lib/types";
import { cn, formatDistance, formatPrice } from "@/lib/utils";
import { FoodImage } from "@/components/ui/food-image";
import { useToast } from "@/components/ui/toast";

/**
 * Restoran kartı iki biçimde çıkar:
 *   featured → sıralamanın ilk sırası; geniş ve yatay, iki sütun kaplar
 *   compact  → kalan sonuçlar
 * Bu ayrım dekoratif değil: yapı, "senin için en iyi eşleşme" bilgisini taşır.
 */
export function RestaurantCard({
  item,
  featured = false,
}: {
  item: RestaurantListItem;
  featured?: boolean;
}) {
  const unavailable = !item.open || !item.deliverable;
  const cuisines = item.tags
    .map((t) => CATEGORIES.find((c) => c.id === t)?.name ?? t)
    .join(", ");

  return (
    <article
      className={cn(
        "group card relative overflow-hidden transition-shadow hover:shadow-soft",
        featured && "sm:col-span-2",
        unavailable && "opacity-[0.72]"
      )}
    >
      <Link
        href={`/restoran/${item.slug}`}
        className={cn("flex h-full", featured ? "flex-col sm:flex-row" : "flex-col")}
      >
        <div
          className={cn(
            "relative shrink-0 overflow-hidden",
            featured
              ? "aspect-[2/1] sm:aspect-auto sm:w-[15.5rem]"
              : "aspect-[2/1]"
          )}
        >
          <FoodImage
            seed={item.coverSeed}
            tone={item.tags[0]}
            src={restaurantPhoto(item)}
            alt={item.name}
            rounded="rounded-none"
            className="size-full"
            zoom
            iconClassName={featured ? "size-12" : "size-10"}
            sizes={
              featured
                ? "(min-width: 640px) 248px, 100vw"
                : "(min-width: 1280px) 300px, (min-width: 1024px) 340px, (min-width: 640px) 50vw, 100vw"
            }
          />

          <div className="absolute inset-x-3 top-3 flex flex-wrap gap-1.5 pr-11">
            {item.freeDeliveryOver !== null && (
              <span className="rounded-full bg-pistachio px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
                {item.freeDeliveryOver === 0
                  ? "Teslimat ücretsiz"
                  : `${item.freeDeliveryOver} ₺ üzeri ücretsiz`}
              </span>
            )}
            {item.badges.slice(0, featured ? 2 : 1).map((badge) => (
              <span
                key={badge}
                className="rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm"
              >
                {badge}
              </span>
            ))}
          </div>

          {unavailable && (
            <div className="absolute inset-0 grid place-items-center bg-deep/70 px-3">
              <span className="rounded-lg bg-surface px-3 py-1.5 text-center text-sm font-bold text-ink">
                {!item.deliverable
                  ? "Adresine teslimat yok"
                  : item.temporarilyClosed
                    ? "Geçici olarak kapalı"
                    : `${item.workingHours.open}'de açılıyor`}
              </span>
            </div>
          )}
        </div>

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col p-4",
            featured && "sm:justify-center sm:px-6"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <h3
              className={cn(
                "font-display truncate font-extrabold leading-tight text-ink",
                featured ? "text-lg sm:text-xl" : "text-[15px]"
              )}
            >
              {item.name}
            </h3>
            <span className="tabular flex shrink-0 items-center gap-1 rounded-lg bg-saffron-soft px-1.5 py-0.5 text-xs font-bold text-saffron">
              <Star className="size-3 fill-current" />
              {item.rating.toFixed(1)}
            </span>
          </div>

          <p
            className={cn(
              "mt-1 truncate text-xs text-muted",
              featured && "sm:text-sm"
            )}
          >
            {cuisines} · {item.ratingCount} değerlendirme
          </p>

          {featured && (
            <p className="mt-2 hidden text-sm leading-relaxed text-muted sm:line-clamp-2">
              {item.description}
            </p>
          )}

          <div
            className={cn(
              "tabular mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted",
              featured && "sm:mt-4 sm:text-[13px]"
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" />
              {item.etaText}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {formatDistance(item.distanceKm)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Bike className="size-3.5" />
              {item.deliveryFee === 0 ? "Ücretsiz" : formatPrice(item.deliveryFee)}
            </span>
            <span className="text-muted/80">
              Min. {formatPrice(item.minBasket)}
            </span>
          </div>
        </div>
      </Link>

      {/* Geniş kartta görsel solda: kalp de görselin köşesinde dursun,
          puan rozetinin üstüne binmesin (15.5rem − 0.75rem − 2.25rem) */}
      <FavoriteButton
        restaurantId={item.id}
        initial={item.isFavorite}
        className={featured ? "sm:right-auto sm:left-[12.5rem]" : undefined}
      />
    </article>
  );
}

/* ------------------------------------------------------------------ */

export function FavoriteButton({
  restaurantId,
  initial,
  className,
}: {
  restaurantId: string;
  initial: boolean;
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const status = useSession((s) => s.status);
  const favorites = useSession((s) => s.user?.favoriteRestaurantIds);
  const toggleFavorite = useSession((s) => s.toggleFavorite);
  const [busy, setBusy] = useState(false);

  const isFavorite = favorites ? favorites.includes(restaurantId) : initial;

  return (
    <button
      type="button"
      disabled={busy}
      aria-label={isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}
      aria-pressed={isFavorite}
      onClick={async (e) => {
        e.preventDefault();
        if (status !== "authenticated") {
          toast.show("Favorilere eklemek için giriş yapmalısın.", "info", {
            label: "Giriş yap",
            onClick: () => router.push("/giris"),
          });
          return;
        }
        setBusy(true);
        try {
          const next = await toggleFavorite(restaurantId);
          toast.success(next ? "Favorilere eklendi." : "Favorilerden çıkarıldı.");
        } catch (err) {
          toast.error(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
      className={cn(
        "absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-surface/85 backdrop-blur transition-transform active:scale-90 disabled:opacity-60",
        className
      )}
    >
      <Heart
        className={cn(
          "size-[18px] transition-colors",
          isFavorite ? "fill-brand text-brand" : "text-muted"
        )}
      />
    </button>
  );
}
