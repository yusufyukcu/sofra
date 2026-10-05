"use client";

import {
  Activity,
  Headset,
  Images,
  LogOut,
  Megaphone,
  ReceiptText,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import { useAdmin } from "@/lib/store/admin";
import { cn } from "@/lib/utils";
import { LogoTile } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/primitives";

/** Yan menü sayaçları bu aralıkla tazelenir (restoranlar her an talep gönderebilir). */
const KPI_REFRESH_MS = 30_000;

const NAV: {
  href: Route;
  label: string;
  icon: typeof Activity;
  exact?: boolean;
  badge?:
    | "pendingRestaurants"
    | "pendingMedia"
    | "pendingCouriers"
    | "pendingPayouts"
    | "lateOrders"
    | "waitingSupport";
}[] = [
  {
    href: "/yonetim",
    label: "Canlı operasyon",
    icon: Activity,
    exact: true,
    badge: "lateOrders",
  },
  { href: "/yonetim/siparisler", label: "Siparişler & iade", icon: ReceiptText },
  {
    href: "/yonetim/destek",
    label: "Canlı destek",
    icon: Headset,
    badge: "waitingSupport",
  },
  {
    href: "/yonetim/restoranlar",
    label: "Restoranlar",
    icon: Store,
    badge: "pendingRestaurants",
  },
  {
    href: "/yonetim/gorseller",
    label: "Görsel onayları",
    icon: Images,
    badge: "pendingMedia",
  },
  {
    href: "/yonetim/kullanicilar",
    label: "Kullanıcılar",
    icon: Users,
    badge: "pendingCouriers",
  },
  { href: "/yonetim/pazarlama", label: "Pazarlama", icon: Megaphone },
  {
    href: "/yonetim/finans",
    label: "Finans",
    icon: Wallet,
    badge: "pendingPayouts",
  },
];

/**
 * Yönetici paneli kabuğu.
 *
 * Masaüstü kontrol masası: sabit koyu yan menü, geniş çalışma alanı ve
 * yan menüde bekleyen iş sayaçları (onay kuyruğu, geciken sipariş,
 * onay bekleyen hakediş). Sayaçlar canlı operasyon akışından beslenir.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAdmin((s) => s.status);
  const admin = useAdmin((s) => s.admin);
  const kpi = useAdmin((s) => s.kpi);
  const bootstrap = useAdmin((s) => s.bootstrap);
  const logout = useAdmin((s) => s.logout);
  const setKpi = useAdmin((s) => s.setKpi);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (status === "guest") router.replace("/yonetim/giris");
  }, [status, router]);

  // Bekleyen iş sayaçları: yeni fotoğraf talebi, başvuru, hakediş…
  useEffect(() => {
    if (status !== "authenticated") return;
    const timer = setInterval(() => {
      api
        .get<{ kpi: Parameters<typeof setKpi>[0] }>("/admin/auth/me")
        .then((me) => setKpi(me.kpi))
        .catch(() => undefined);
    }, KPI_REFRESH_MS);
    return () => clearInterval(timer);
  }, [status, setKpi]);

  if (status !== "authenticated" || !admin) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper p-6">
        <Skeleton className="h-64 w-full max-w-4xl" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-paper lg:flex-row">
      <aside className="band-deep flex shrink-0 flex-col lg:w-60">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <LogoTile className="size-9" />
          <div className="min-w-0">
            <p className="font-display text-sm font-extrabold leading-tight text-on-deep">
              Sofra Yönetim
            </p>
            <p className="truncate text-[11px] text-on-deep-muted">
              {admin.name}
            </p>
          </div>
        </div>

        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const count = item.badge && kpi ? kpi[item.badge] : 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                  active
                    ? "bg-white/12 text-on-deep"
                    : "text-on-deep-muted hover:bg-white/8 hover:text-on-deep"
                )}
              >
                <item.icon className="size-[18px]" />
                <span className="whitespace-nowrap">{item.label}</span>
                {count > 0 && (
                  <span className="tabular ml-auto flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-extrabold text-brand-contrast">
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden border-t border-white/10 p-3 lg:block">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-on-deep-muted transition-colors hover:bg-white/8 hover:text-on-deep"
          >
            <Store className="size-[18px]" />
            Müşteri uygulaması
          </Link>
          <button
            type="button"
            onClick={() => {
              void logout().then(() => router.replace("/yonetim/giris"));
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-on-deep-muted transition-colors hover:bg-white/8 hover:text-on-deep"
          >
            <LogOut className="size-[18px]" />
            Çıkış yap
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-5 lg:px-7 lg:py-7">{children}</main>
    </div>
  );
}
