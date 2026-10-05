"use client";

import {
  Bike,
  Clock,
  Info,
  MapPin,
  MessageSquare,
  ShoppingBasket,
  Star,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PAYMENT_METHOD_ICONS } from "@sofra/core";
import { CATEGORIES, PAYMENT_METHODS } from "@/lib/constants";
import { restaurantPhoto } from "@/lib/photos";
import { deliveryPoint, useSession } from "@/lib/store/session";
import { toCartMeta } from "@/lib/store/cart";
import type { Product, Restaurant, Review } from "@/lib/types";
import {
  distanceKm,
  etaForDistance,
  formatDistance,
  formatPrice,
  isRestaurantOpen,
} from "@/lib/utils";
import { CartSummaryCard, MiniCartBar } from "@/components/cart/cart-summary-card";
import { FavoriteButton } from "@/components/discovery/restaurant-card";
import { StaticMap } from "@/components/map";
import { FoodImage } from "@/components/ui/food-image";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/primitives";
import { MenuBrowser } from "./menu-browser";
import { ProductModal } from "./product-modal";
import { ReviewList } from "./reviews";

export function RestaurantClient({
  restaurant,
  reviews,
}: {
  restaurant: Restaurant;
  reviews: Review[];
}) {
  const point = useSession(deliveryPoint);
  const [selected, setSelected] = useState<Product | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  const km = useMemo(
    () => distanceKm(point, restaurant.location),
    [point, restaurant.location]
  );
  const eta = etaForDistance(restaurant, km);
  const deliverable = km <= restaurant.deliveryRadiusKm;
  const open = isRestaurantOpen(restaurant);
  const orderable = deliverable && open;

  const cartMeta = useMemo(() => toCartMeta(restaurant), [restaurant]);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4 sm:pt-6 lg:px-6 lg:pt-8">
      {/* Kapak */}
      <header className="card relative overflow-hidden">
        <div className="relative">
          <FoodImage
            seed={restaurant.coverSeed}
            tone={restaurant.tags[0]}
            src={restaurantPhoto(restaurant)}
            alt={restaurant.name}
            rounded="rounded-none"
            className="h-52 w-full sm:h-72"
            iconClassName="size-14"
            sizes="(min-width: 1280px) 1232px, 100vw"
            eager
          />
          {/* Alt kenarda yumuşak gölge: fotoğraf karta sert bir çizgiyle değil, ışıkla bağlansın */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/25 to-transparent"
          />
        </div>
        <FavoriteButton restaurantId={restaurant.id} initial={false} />

        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            {restaurant.badges.map((badge) => (
              <Badge key={badge} tone="brand">
                {badge}
              </Badge>
            ))}
            {restaurant.courierMode === "platform" ? (
              <Badge tone="info">
                <Bike className="size-3" />
                Sofra kuryesi · canlı takip
              </Badge>
            ) : (
              <Badge>Restoran kuryesi</Badge>
            )}
          </div>

          <h1 className="font-display mt-3 text-[1.75rem] font-extrabold leading-none text-ink sm:text-4xl">
            {restaurant.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {restaurant.description}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="tabular inline-flex items-center gap-1.5 font-bold text-ink">
              <Star className="size-4 fill-accent text-accent" />
              {restaurant.rating.toFixed(1)}
              <span className="font-medium text-muted">
                ({restaurant.ratingCount} değerlendirme)
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted">
              <Clock className="size-4" />
              {eta.min}-{eta.max} dk
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted">
              <MapPin className="size-4" />
              {formatDistance(km)} · {restaurant.district}
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted">
              <ShoppingBasket className="size-4" />
              Min. {formatPrice(restaurant.minBasket)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted">
              <Bike className="size-4" />
              {restaurant.deliveryFee === 0
                ? "Ücretsiz teslimat"
                : `${formatPrice(restaurant.deliveryFee)} teslimat`}
            </span>
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline"
            >
              <Info className="size-4" />
              Bilgiler
            </button>
          </div>

          <p className="mt-3 text-xs text-muted">
            {restaurant.tags
              .map((t) => CATEGORIES.find((c) => c.id === t)?.name ?? t)
              .join(" · ")}
          </p>
        </div>
      </header>

      {/* Uyarı şeritleri */}
      {!open && (
        <StatusBanner
          tone="danger"
          title={
            restaurant.temporarilyClosed
              ? "Restoran yoğunluk nedeniyle siparişe kapalı"
              : "Restoran şu anda kapalı"
          }
          description={`Çalışma saatleri: ${restaurant.workingHours.open} - ${restaurant.workingHours.close}. Menüyü inceleyebilirsin ama şimdilik sipariş veremezsin.`}
        />
      )}
      {open && !deliverable && (
        <StatusBanner
          tone="accent"
          title="Bu restoran adresine teslimat yapmıyor"
          description={`Teslimat yarıçapı ${restaurant.deliveryRadiusKm} km; seçili adresin ${formatDistance(km)} uzaklıkta. Üstteki adres alanından farklı bir adres seçebilirsin.`}
        />
      )}

      {/* Menü + sepet */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
        <div className="min-w-0">
          <MenuBrowser
            menu={restaurant.menu}
            onSelect={setSelected}
            disabled={!orderable}
            tone={restaurant.tags[0]}
          />

          <section className="mt-12">
            <h2 className="font-display flex items-center gap-2 text-lg font-extrabold text-ink sm:text-xl">
              <MessageSquare className="size-5 text-brand" />
              Değerlendirmeler
            </h2>
            <div className="mt-4">
              <ReviewList
                reviews={reviews}
                rating={restaurant.rating}
                ratingCount={restaurant.ratingCount}
              />
            </div>
          </section>
        </div>

        <aside className="hidden lg:block">
          {/* Menü çubuğuyla aynı hizada yapışır */}
          <div className="sticky top-20">
            <CartSummaryCard minBasket={restaurant.minBasket} />
          </div>
        </aside>
      </div>

      <MiniCartBar minBasket={restaurant.minBasket} />

      <ProductModal
        product={selected}
        restaurant={cartMeta}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        tone={restaurant.tags[0]}
      />

      <Modal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title={restaurant.name}
        description={`${restaurant.district} · ${restaurant.tags.length} mutfak`}
        size="md"
      >
        <div className="space-y-5">
          <div className="overflow-hidden rounded-2xl border border-border">
            <StaticMap
              point={restaurant.location}
              radiusKm={restaurant.deliveryRadiusKm}
              zone={restaurant.deliveryZone}
              className="h-48 w-full"
            />
          </div>

          <InfoRow label="Çalışma saatleri">
            {restaurant.workingHours.open} - {restaurant.workingHours.close}
          </InfoRow>
          <InfoRow label="Teslimat bölgesi">
            {restaurant.deliveryZone && restaurant.deliveryZone.length >= 3
              ? "Haritada işaretli alan"
              : `${restaurant.deliveryRadiusKm} km yarıçap`}
          </InfoRow>
          <InfoRow label="Minimum sepet tutarı">
            {formatPrice(restaurant.minBasket)}
          </InfoRow>
          <InfoRow label="Teslimat ücreti">
            {formatPrice(restaurant.deliveryFee)}
            {restaurant.freeDeliveryOver !== null &&
              ` · ${formatPrice(restaurant.freeDeliveryOver)} üzeri ücretsiz`}
          </InfoRow>
          <InfoRow label="Teslimat">
            {restaurant.courierMode === "platform"
              ? "Sofra kuryesi (canlı harita takibi)"
              : "Restoranın kendi kuryesi"}
          </InfoRow>
          <InfoRow label="Ödeme yöntemleri">
            <div className="flex flex-wrap gap-1.5">
              {restaurant.paymentMethods.map((method) => (
                <Badge key={method}>
                  <Icon name={PAYMENT_METHOD_ICONS[method]} className="size-3" />
                  {PAYMENT_METHODS[method].name}
                </Badge>
              ))}
            </div>
          </InfoRow>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StatusBanner({
  tone,
  title,
  description,
}: {
  tone: "danger" | "accent";
  title: string;
  description: string;
}) {
  return (
    <div
      className={`mt-4 rounded-2xl border p-4 sm:px-5 ${
        tone === "danger"
          ? "border-danger/30 bg-danger-soft"
          : "border-accent/30 bg-accent-soft"
      }`}
    >
      <p className="text-sm font-bold text-ink">{title}</p>
      <p className="mt-0.5 text-sm text-muted">{description}</p>
    </div>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-right text-sm font-semibold text-ink">
        {children}
      </span>
    </div>
  );
}
