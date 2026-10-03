"use client";

import { BarChart3, Bike, LogOut, Power, Wallet } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { currentPosition } from "@/lib/courier-location";
import { useCourier } from "@/lib/store/courier";
import type { CourierSummaryStats } from "@/lib/services/courier";
import type { PublicCourier } from "@/lib/store/courier";
import { cn, formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

const NAV: { href: Route; label: string; icon: typeof Bike; exact?: boolean }[] =
  [
    { href: "/kurye", label: "Teslimat", icon: Bike, exact: true },
    { href: "/kurye/kazanc", label: "Kazanç", icon: Wallet },
    { href: "/kurye/performans", label: "Performans", icon: BarChart3 },
  ];

/**
 * Kurye uygulaması kabuğu.
 *
 * Telefonda tek elle, çoğu zaman hareket hâlinde kullanılır: tek sütun,
 * büyük dokunma hedefleri, alt sekme çubuğu. Masaüstünde telefon genişliğinde
 * ortalanır — gerçek kullanım biçimi bu.
 */
export function CourierShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useCourier((s) => s.status);
  const courier = useCourier((s) => s.courier);
  const bootstrap = useCourier((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (status === "guest") router.replace("/kurye/giris");
  }, [status, router]);

  if (status !== "authenticated" || !courier) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper p-6">
        <Skeleton className="h-64 w-full max-w-md" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh justify-center bg-deep">
      <div className="flex min-h-dvh w-full max-w-md flex-col bg-paper shadow-float">
        <CourierTopBar courier={courier} />

        <main className="min-w-0 flex-1 px-4 pb-24 pt-4">{children}</main>

        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md border-t border-border bg-surface/95 backdrop-blur">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors",
                  active ? "text-brand" : "text-muted hover:text-ink"
                )}
              >
                <item.icon className="size-[22px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CourierTopBar({ courier }: { courier: PublicCourier }) {
  const router = useRouter();
  const toast = useToast();
  const stats = useCourier((s) => s.stats);
  const setCourier = useCourier((s) => s.setCourier);
  const applyBoardCourier = useCourier((s) => s.setCourier);
  const logout = useCourier((s) => s.logout);
  const [busy, setBusy] = useState(false);

  async function toggleShift() {
    setBusy(true);
    try {
      // Mesai konumla başlar: en yakın kurye seçimi bu konuma göre yapılır
      const goingOnline = !courier.online;
      const point = goingOnline ? await currentPosition() : undefined;
      const data = await api.post<{
        courier: PublicCourier;
        stats: CourierSummaryStats;
      }>("/courier/shift", { online: goingOnline, point });
      setCourier(data.courier);
      applyBoardCourier(data.courier);
      toast.success(
        data.courier.online ? "Mesai başladı." : "Mesai kapatıldı."
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="band-deep sticky top-0 z-30">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/12 text-xl">
          {courier.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display truncate text-[15px] font-extrabold leading-tight text-on-deep">
            {courier.name}
          </p>
          <p className="tabular truncate text-xs text-on-deep-muted">
            ⭐ {courier.rating.toFixed(1)} ·{" "}
            {courier.vehicle === "moto"
              ? "Motosiklet"
              : courier.vehicle === "bisiklet"
                ? "Bisiklet"
                : "Araç"}
            {stats ? ` · bugün ${formatPrice(stats.todayEarnings)}` : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void logout().then(() => router.replace("/kurye/giris"));
          }}
          aria-label="Çıkış yap"
          className="rounded-lg p-2 text-on-deep-muted transition-colors hover:bg-white/10 hover:text-on-deep"
        >
          <LogOut className="size-[18px]" />
        </button>
      </div>

      {/* Mesai anahtarı — uygulamanın en kritik kontrolü */}
      <button
        type="button"
        onClick={toggleShift}
        disabled={busy}
        aria-pressed={courier.online}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors disabled:opacity-60",
          courier.online ? "bg-pistachio" : "bg-white/8"
        )}
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            courier.online ? "bg-white/25 text-white" : "bg-white/10 text-on-deep-muted"
          )}
        >
          <Power className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-sm font-extrabold",
              courier.online ? "text-white" : "text-on-deep"
            )}
          >
            {courier.online ? "Mesaidesin" : "Mesai kapalı"}
          </span>
          <span
            className={cn(
              "block text-xs",
              courier.online ? "text-white/75" : "text-on-deep-muted"
            )}
          >
            {courier.online
              ? "Yakındaki siparişler sana gönderiliyor"
              : "Sipariş almak için mesaiyi başlat"}
          </span>
        </span>
        <span
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors",
            courier.online ? "bg-white/30" : "bg-white/15"
          )}
        >
          <span
            className={cn(
              "absolute top-1 size-5 rounded-full bg-white transition-all",
              courier.online ? "left-[26px]" : "left-1"
            )}
          />
        </span>
      </button>
    </header>
  );
}
