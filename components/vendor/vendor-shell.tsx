"use client";

import {
  BellOff,
  BellRing,
  ClipboardList,
  History,
  LogOut,
  MessageSquare,
  Settings,
  Store,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LogoTile } from "@/components/brand/logo";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { useVendor } from "@/lib/store/vendor";
import type { Restaurant } from "@/lib/types";
import { cn } from "@/lib/utils";
import { unlockAudio, stopAlarm } from "@/lib/vendor/chime";
import { Skeleton } from "@/components/ui/primitives";
import { RestaurantThumb } from "@/components/ui/restaurant-thumb";
import { useToast } from "@/components/ui/toast";

const NAV: { href: Route; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/isletme", label: "Siparişler", icon: ClipboardList, exact: true },
  { href: "/isletme/gecmis", label: "Geçmiş", icon: History },
  { href: "/isletme/menu", label: "Menü & Stok", icon: UtensilsCrossed },
  { href: "/isletme/ayarlar", label: "Mağaza", icon: Settings },
  { href: "/isletme/finans", label: "Finans", icon: Wallet },
  { href: "/isletme/degerlendirmeler", label: "Yorumlar", icon: MessageSquare },
];

/**
 * Restoran paneli kabuğu.
 *
 * Mutfakta tablet üzerinde kullanılır: koyu yan menü, geniş dokunma
 * hedefleri ve her ekranda görünen iki kritik kontrol — siparişe açık/kapalı
 * ve zil. Müşteri uygulamasının başlığı burada yoktur.
 */
export function VendorShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useVendor((s) => s.status);
  const restaurant = useVendor((s) => s.restaurant);
  const bootstrap = useVendor((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (status === "guest") router.replace("/isletme/giris");
  }, [status, router]);

  useEffect(() => () => stopAlarm(), []);

  if (status !== "authenticated" || !restaurant) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper p-6">
        <Skeleton className="h-64 w-full max-w-3xl" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-paper lg:flex-row">
      {/* Yan menü (masaüstü) */}
      <aside className="band-deep hidden w-60 shrink-0 flex-col lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <LogoTile className="size-9" />
          <div className="min-w-0">
            <p className="font-display text-sm font-extrabold leading-tight text-on-deep">
              Sofra İşletme
            </p>
            <p className="truncate text-[11px] text-on-deep-muted">
              {restaurant.name}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                  active
                    ? "bg-white/12 text-on-deep"
                    : "text-on-deep-muted hover:bg-white/8 hover:text-on-deep"
                )}
              >
                <item.icon className="size-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-on-deep-muted transition-colors hover:bg-white/8 hover:text-on-deep"
          >
            <Store className="size-[18px]" />
            Müşteri uygulaması
          </Link>
          <LogoutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <VendorTopBar restaurant={restaurant} />

        {/* Alt gezinme (mobil) */}
        <nav className="band-deep sticky top-0 z-30 flex gap-1 overflow-x-auto px-3 py-2 lg:hidden">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                  active
                    ? "bg-white/15 text-on-deep"
                    : "text-on-deep-muted hover:text-on-deep"
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="min-w-0 flex-1 px-4 py-5 lg:px-7 lg:py-7">{children}</main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function VendorTopBar({ restaurant }: { restaurant: Restaurant }) {
  const toast = useToast();
  const setRestaurant = useVendor((s) => s.setRestaurant);
  const summary = useVendor((s) => s.summary);
  const soundEnabled = useVendor((s) => s.soundEnabled);
  const setSoundEnabled = useVendor((s) => s.setSoundEnabled);
  const [busy, setBusy] = useState(false);

  const open = !restaurant.temporarilyClosed;

  async function toggleOpen() {
    setBusy(true);
    try {
      const data = await api.patch<{ restaurant: Restaurant }>(
        "/vendor/settings",
        { temporarilyClosed: open }
      );
      setRestaurant(data.restaurant);
      toast.success(
        open
          ? "Restoran siparişe kapatıldı."
          : "Restoran yeniden siparişe açıldı."
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleSound() {
    if (soundEnabled) {
      stopAlarm();
      setSoundEnabled(false);
      toast.show("Sipariş zili kapatıldı.", "info");
      return;
    }
    const ok = await unlockAudio();
    if (!ok) {
      toast.error("Tarayıcı ses çalmayı engelledi. Sayfaya tıklayıp tekrar dene.");
      return;
    }
    setSoundEnabled(true);
    toast.success("Sipariş zili açıldı.");
  }

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-3 lg:px-7">
      <div className="flex min-w-0 items-center gap-2.5">
        <RestaurantThumb
          image={restaurant.image}
          tone={restaurant.tags?.[0]}
          className="size-9 rounded-xl"
          iconClassName="size-4"
        />
        <div className="min-w-0">
          <p className="font-display truncate text-base font-extrabold leading-tight text-ink">
            {restaurant.name}
          </p>
          <p className="truncate text-xs text-muted">
            {restaurant.district} · {restaurant.workingHours.open}–
            {restaurant.workingHours.close}
          </p>
        </div>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {summary && summary.pendingCount > 0 && (
          <span className="tabular inline-flex items-center gap-1.5 rounded-xl bg-brand-soft px-3 py-2 text-sm font-bold text-brand">
            <span className="relative flex size-2">
              <span className="animate-pulse-ring absolute inset-0 rounded-full bg-brand" />
              <span className="relative size-2 rounded-full bg-brand" />
            </span>
            {summary.pendingCount} yeni sipariş
          </span>
        )}

        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={soundEnabled}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors",
            soundEnabled
              ? "border-pistachio/40 bg-pistachio-soft text-pistachio"
              : "border-border bg-surface-2 text-muted hover:text-ink"
          )}
        >
          {soundEnabled ? (
            <BellRing className="size-4" />
          ) : (
            <BellOff className="size-4" />
          )}
          <span className="hidden sm:inline">
            {soundEnabled ? "Zil açık" : "Zili aç"}
          </span>
        </button>

        <button
          type="button"
          onClick={toggleOpen}
          disabled={busy}
          aria-pressed={open}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-bold text-white transition-opacity disabled:opacity-60",
            open ? "bg-pistachio" : "bg-danger"
          )}
        >
          <span className="size-2 rounded-full bg-white/80" />
          {open ? "Siparişe açık" : "Siparişe kapalı"}
        </button>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */

function LogoutButton() {
  const router = useRouter();
  const logout = useVendor((s) => s.logout);

  return (
    <button
      type="button"
      onClick={async () => {
        stopAlarm();
        await logout();
        router.replace("/isletme/giris");
      }}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-on-deep-muted transition-colors hover:bg-white/8 hover:text-on-deep"
    >
      <LogOut className="size-[18px]" />
      Çıkış yap
    </button>
  );
}
