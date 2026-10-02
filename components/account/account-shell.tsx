"use client";

import { Heart, LogOut, MapPin, Receipt, User, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/lib/store/session";
import { cn, formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/primitives";

const NAV: { href: Route; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/hesabim", label: "Profilim", icon: User, exact: true },
  { href: "/hesabim/siparislerim", label: "Siparişlerim", icon: Receipt },
  { href: "/hesabim/adreslerim", label: "Adreslerim", icon: MapPin },
  { href: "/hesabim/favorilerim", label: "Favorilerim", icon: Heart },
  { href: "/hesabim/cuzdan", label: "Cüzdanım", icon: Wallet },
];

/**
 * Hesap bölümü kabuğu: yan menü + oturum koruması.
 * Giriş yapılmamışsa giriş sayfasına yönlendirir ve geri dönüş adresini taşır.
 */
export function AccountShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useSession((s) => s.status);
  const user = useSession((s) => s.user);
  const logout = useSession((s) => s.logout);

  useEffect(() => {
    if (status === "guest") {
      router.replace(`/giris?devam=${encodeURIComponent(pathname)}` as never);
    }
  }, [status, router, pathname]);

  if (status !== "authenticated" || !user) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-6 lg:px-6 lg:pt-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
          <Skeleton className="hidden h-72 lg:block" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  // `grid-cols-1` = minmax(0, 1fr): mobilde yatay kayan menü sütunu
  // genişletip sayfayı ekrandan taşırmasın
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 lg:px-6 lg:pt-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        <aside className="min-w-0">
          <div className="card mb-3 flex items-center gap-3 p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xl">
              {user.avatarEmoji}
            </span>
            <div className="min-w-0">
              <p className="truncate font-bold text-text">{user.name}</p>
              <p className="truncate text-xs text-muted">
                {user.phone ? `0${user.phone}` : user.email}
              </p>
            </div>
          </div>

          <nav className="card no-scrollbar flex gap-1 overflow-x-auto p-1.5 lg:flex-col">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                    active
                      ? "bg-brand-soft text-brand"
                      : "text-muted hover:bg-surface-2 hover:text-text"
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="card mt-3 hidden p-4 lg:block">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Cüzdan bakiyesi
            </p>
            <p className="mt-1 text-xl font-extrabold text-success">
              {formatPrice(user.walletBalance)}
            </p>
            <button
              type="button"
              onClick={() => void logout()}
              className="mt-4 flex w-full items-center gap-2 rounded-lg px-1 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
            >
              <LogOut className="size-4" />
              Çıkış yap
            </button>
          </div>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
