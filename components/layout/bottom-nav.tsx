"use client";

import { Heart, Home, Receipt, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMounted } from "@/lib/hooks";
import { cartCount, useCart } from "@/lib/store/cart";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Keşfet", icon: Home, exact: true },
  { href: "/hesabim/siparislerim", label: "Siparişler", icon: Receipt },
  { href: "/sepet", label: "Sepet", icon: ShoppingBag, badge: true },
  { href: "/hesabim/favorilerim", label: "Favoriler", icon: Heart },
  { href: "/hesabim", label: "Hesabım", icon: User, exact: true },
];

/** Mobil alt gezinme çubuğu — mobil uygulamadaki tab bar ile aynı yapı. */
export function BottomNav() {
  const pathname = usePathname();
  const mounted = useMounted();
  const count = useCart(cartCount);

  // Ödeme akışında dikkat dağıtmamak için gizle
  if (pathname === "/odeme" || pathname === "/giris") return null;

  return (
    <nav
      data-bottom-nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-lg lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors",
                  active ? "text-brand" : "text-muted hover:text-text"
                )}
              >
                <span className="relative">
                  <item.icon className="size-[22px]" />
                  {item.badge && mounted && count > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-extrabold text-brand-contrast">
                      {count}
                    </span>
                  )}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
