"use client";

import { ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMounted } from "@/lib/hooks";
import { useCart } from "@/lib/store/cart";
import { cn, cartSubtotal, formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/primitives";
import { RestaurantThumb } from "@/components/ui/restaurant-thumb";
import { CartLineRow } from "./cart-line-row";

/**
 * Restoran sayfasındaki sağ sütun sepeti (masaüstü).
 * Minimum sepet tutarına ne kadar kaldığını ilerleme çubuğuyla gösterir.
 */
export function CartSummaryCard({ minBasket }: { minBasket: number }) {
  const mounted = useMounted();
  const restaurant = useCart((s) => s.restaurant);
  const lines = useCart((s) => s.lines);
  const clear = useCart((s) => s.clear);

  const subtotal = cartSubtotal(lines);
  const missing = Math.max(0, minBasket - subtotal);
  const progress = minBasket > 0 ? Math.min(1, subtotal / minBasket) : 1;

  if (!mounted) return <div className="skeleton h-64 rounded-2xl" />;

  if (!lines.length) {
    return (
      <div className="card p-6 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-surface-2 text-2xl">
          <ShoppingBag className="size-6 text-muted" />
        </span>
        <h3 className="mt-3 font-bold text-text">Sepetin boş</h3>
        <p className="mt-1 text-sm text-muted">
          Menüden ürün seçerek siparişini oluşturmaya başla.
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {restaurant && (
            <RestaurantThumb
              image={restaurant.image}
              emoji={restaurant.emoji}
              className="size-8 rounded-lg"
              emojiClassName="text-base"
            />
          )}
          <h3 className="truncate text-sm font-bold text-text">
            {restaurant?.name}
          </h3>
        </div>
        <button
          type="button"
          onClick={clear}
          aria-label="Sepeti boşalt"
          className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="max-h-80 divide-y divide-border overflow-y-auto">
        {lines.map((line) => (
          <CartLineRow key={line.lineId} line={line} compact />
        ))}
      </div>

      <div className="space-y-3 border-t border-border p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Ara toplam</span>
          <span className="font-extrabold text-text">{formatPrice(subtotal)}</span>
        </div>

        {missing > 0 ? (
          <div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted">
              Minimum sepet tutarına{" "}
              <span className="font-bold text-brand">{formatPrice(missing)}</span>{" "}
              kaldı.
            </p>
          </div>
        ) : (
          <p className="text-xs font-semibold text-success">
            ✓ Minimum sepet tutarını karşıladın
          </p>
        )}

        <Link href="/sepet" className="block">
          <Button block size="lg" disabled={missing > 0}>
            Sepete git
          </Button>
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Mobilde ekranın altına yapışan sepet çubuğu. */
export function MiniCartBar({ minBasket }: { minBasket: number }) {
  const mounted = useMounted();
  const lines = useCart((s) => s.lines);
  const subtotal = cartSubtotal(lines);
  const count = lines.reduce((sum, l) => sum + l.quantity, 0);
  const missing = Math.max(0, minBasket - subtotal);

  if (!mounted || !lines.length) return null;

  return (
    <div
      data-mini-cart
      className="safe-bottom fixed inset-x-0 bottom-16 z-30 px-4 lg:hidden"
    >
      <Link
        href="/sepet"
        className={cn(
          "flex items-center gap-3 rounded-2xl px-4 py-3 shadow-float transition-colors",
          missing > 0
            ? "bg-surface-3 text-text"
            : "bg-brand text-brand-contrast"
        )}
      >
        <span className="flex size-9 items-center justify-center rounded-xl bg-black/15 text-sm font-extrabold">
          {count}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold">
            {missing > 0 ? `${formatPrice(missing)} daha ekle` : "Sepete git"}
          </span>
          <span className="block text-xs opacity-80">
            {missing > 0 ? `Min. sepet ${formatPrice(minBasket)}` : "Siparişini tamamla"}
          </span>
        </span>
        <span className="shrink-0 text-base font-extrabold">
          {formatPrice(subtotal)}
        </span>
      </Link>
    </div>
  );
}
