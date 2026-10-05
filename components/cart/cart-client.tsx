"use client";

import { ArrowLeft, ArrowRight, ShoppingBag, Store, Trash2 } from "lucide-react";
import Link from "next/link";
import { SERVICE_FEE } from "@/lib/constants";
import { useMounted } from "@/lib/hooks";
import { deliveryFeeFor } from "@/lib/pricing";
import { useCart } from "@/lib/store/cart";
import { useSession } from "@/lib/store/session";
import { cartSubtotal, formatPrice } from "@/lib/utils";
import { Button, EmptyState, Skeleton } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/modal";
import { RestaurantThumb } from "@/components/ui/restaurant-thumb";
import { useState } from "react";
import { CartLineRow } from "./cart-line-row";

/** Sepet sayfası: ürünleri düzenle, tutarı gör, ödemeye geç. */
export function CartClient() {
  const mounted = useMounted();
  const restaurant = useCart((s) => s.restaurant);
  const lines = useCart((s) => s.lines);
  const clear = useCart((s) => s.clear);
  const status = useSession((s) => s.status);
  const [confirmClear, setConfirmClear] = useState(false);

  if (!mounted) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-6 lg:px-6 lg:pt-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  }

  if (!lines.length || !restaurant) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-6 lg:px-6 lg:pt-8">
        <h1 className="mb-6 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Sepetim
        </h1>
        <EmptyState
          icon={ShoppingBag}
          title="Sepetin henüz boş"
          description="Çevrendeki restoranları keşfet, favori lezzetlerini sepete ekle."
          action={
            <Link href="/">
              <Button size="lg">Restoranları keşfet</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const subtotal = cartSubtotal(lines);
  const deliveryFee = deliveryFeeFor(restaurant, subtotal);
  const missing = Math.max(0, restaurant.minBasket - subtotal);
  const total = subtotal + deliveryFee + SERVICE_FEE;

  const checkoutHref = status === "authenticated" ? "/odeme" : "/giris?devam=/odeme";

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 lg:px-6 lg:pt-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Sepetim
        </h1>
        <button
          type="button"
          onClick={() => setConfirmClear(true)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 className="size-4" />
          Sepeti boşalt
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
        <div className="min-w-0 space-y-4">
          <div className="card overflow-hidden">
            <Link
              href={`/restoran/${restaurant.slug}`}
              className="flex items-center gap-3 border-b border-border p-4 transition-colors hover:bg-surface-2"
            >
              <RestaurantThumb
                image={restaurant.image}
                className="size-11 rounded-xl"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-text">
                  {restaurant.name}
                </span>
                <span className="block text-xs text-muted">
                  Menüye dön, ürün eklemeye devam et
                </span>
              </span>
              <Store className="size-5 shrink-0 text-muted" />
            </Link>

            <div className="divide-y divide-border">
              {lines.map((line) => (
                <CartLineRow key={line.lineId} line={line} />
              ))}
            </div>
          </div>

          <Link
            href={`/restoran/${restaurant.slug}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline"
          >
            <ArrowLeft className="size-4" />
            Menüye geri dön
          </Link>
        </div>

        {/* Özet */}
        <aside>
          <div className="card sticky top-24 p-5 sm:p-6">
            <h2 className="text-base font-extrabold text-text">Sipariş özeti</h2>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Ara toplam</dt>
                <dd className="font-semibold text-text">{formatPrice(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Teslimat ücreti</dt>
                <dd className="font-semibold text-text">
                  {deliveryFee === 0 ? (
                    <span className="text-success">Ücretsiz</span>
                  ) : (
                    formatPrice(deliveryFee)
                  )}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Hizmet bedeli</dt>
                <dd className="font-semibold text-text">
                  {formatPrice(SERVICE_FEE)}
                </dd>
              </div>
            </dl>

            <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
              <span className="font-bold text-text">Toplam</span>
              <span className="text-xl font-extrabold text-text">
                {formatPrice(total)}
              </span>
            </div>

            <p className="mt-1 text-xs text-muted">
              İndirim kodun varsa ödeme adımında uygulayabilirsin.
            </p>

            {missing > 0 && (
              <div className="mt-4 rounded-xl border border-accent/30 bg-accent-soft p-3">
                <p className="text-sm font-bold text-text">
                  Minimum sepet tutarına {formatPrice(missing)} kaldı
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {restaurant.name} için minimum sepet tutarı{" "}
                  {formatPrice(restaurant.minBasket)}.
                </p>
              </div>
            )}

            <Link
              href={missing > 0 ? `/restoran/${restaurant.slug}` : checkoutHref}
              className="mt-4 block"
            >
              <Button block size="lg" disabled={missing > 0}>
                {missing > 0 ? "Ürün eklemeye devam et" : "Ödemeye geç"}
                {missing === 0 && <ArrowRight className="size-4" />}
              </Button>
            </Link>

            {status !== "authenticated" && missing === 0 && (
              <p className="mt-2 text-center text-xs text-muted">
                Siparişi tamamlamak için giriş yapman gerekiyor.
              </p>
            )}
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clear}
        title="Sepeti boşalt"
        description="Sepetindeki tüm ürünler silinecek. Emin misin?"
        confirmLabel="Evet, boşalt"
      />
    </div>
  );
}
