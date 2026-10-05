"use client";

import {
  ChevronDown,
  Bell,
  Bike,
  Heart,
  LogOut,
  Moon,
  Receipt,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  Sun,
  User as UserIcon,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMounted } from "@/lib/hooks";
import { cartCount, useCart } from "@/lib/store/cart";
import { useSession } from "@/lib/store/session";
import { formatPrice } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import { AddressSelector } from "./address-selector";
import { NotificationBell } from "./notification-bell";

/**
 * Üst çubuk. Beyaz ve sakin: sayfanın yıldızı yemek fotoğrafları, başlık
 * onların önüne geçmez. Marka rengi yalnızca logoda ve sepet düğmesinde.
 */
export function Header() {
  const pathname = usePathname();
  const hideSearch = pathname === "/odeme";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-3 lg:px-6">
        <Link href="/" aria-label="Sofra ana sayfa" className="shrink-0 rounded-lg">
          <Logo size="md" wordmarkClassName="hidden sm:inline" />
        </Link>

        <span className="hidden h-7 w-px bg-border sm:block" />

        <AddressSelector compact />

        {!hideSearch && <HeaderSearch />}

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <ThemeToggle />
          <NotificationBell />
          <AccountMenu />
          <CartButton />
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */

function HeaderSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        router.push(q ? `/?q=${encodeURIComponent(q)}` : "/");
      }}
      className="ml-2 hidden min-w-0 flex-1 lg:block"
    >
      <label className="flex h-11 items-center gap-2.5 rounded-full border border-transparent bg-surface-2 px-4 transition-colors focus-within:border-brand focus-within:bg-surface">
        <Search className="size-[18px] shrink-0 text-muted" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Restoran, yemek ya da mutfak ara"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-text placeholder:text-muted focus:outline-none"
          aria-label="Restoran ara"
        />
      </label>
    </form>
  );
}

/* ------------------------------------------------------------------ */

const ICON_BUTTON =
  "flex size-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink";

function ThemeToggle() {
  const mounted = useMounted();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("sofra:theme", next ? "dark" : "light");
    } catch {
      /* depolama kapalı olabilir */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Aydınlık temaya geç" : "Karanlık temaya geç"}
      className={`${ICON_BUTTON} hidden sm:flex`}
    >
      {mounted && dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Menüde "Yönetim paneli" kısayolunu gören telefonlar (başında 0 olmadan,
 * virgülle ayrılmış). Numara repoya girmesin diye ortam değişkeninden okunur.
 * Kısayol yetki vermez: panel yine yönetici girişi ister.
 */
const ADMIN_PANEL_PHONES = (process.env.NEXT_PUBLIC_SOFRA_ADMIN_PHONES ?? "")
  .split(",")
  .map((phone) => phone.trim())
  .filter(Boolean);

function AccountMenu() {
  const user = useSession((s) => s.user);
  const status = useSession((s) => s.status);
  const logout = useSession((s) => s.logout);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (status !== "authenticated" || !user) {
    return (
      <Link
        href="/giris"
        className="hidden h-10 items-center rounded-full border border-border-strong px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-2 sm:inline-flex"
      >
        Giriş yap
      </Link>
    );
  }

  return (
    <div className="relative hidden lg:block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-10 items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
      >
        <Avatar name={user.name} className="size-8 text-xs" />
        <span className="max-w-24 truncate">{user.name.split(" ")[0]}</span>
        <ChevronDown className="size-4 text-muted" />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-fade-up absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-surface shadow-float"
        >
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Avatar name={user.name} className="size-10 text-sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{user.name}</p>
              <p className="truncate text-xs text-muted">
                {user.phone ? `0${user.phone}` : user.email}
              </p>
            </div>
          </div>
          <nav className="p-1.5">
            {[
              { href: "/hesabim", label: "Hesabım", icon: UserIcon },
              { href: "/hesabim/siparislerim", label: "Siparişlerim", icon: Receipt },
              { href: "/hesabim/favorilerim", label: "Favorilerim", icon: Heart },
              { href: "/hesabim/cuzdan", label: "Cüzdanım", icon: Wallet },
              { href: "/hesabim/bildirimler", label: "Bildirimler", icon: Bell },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-2"
              >
                <item.icon className="size-4 text-muted" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-border p-1.5">
            <div className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm">
              <span className="text-muted">Cüzdan</span>
              <span className="tabular font-bold text-pistachio">
                {formatPrice(user.walletBalance)}
              </span>
            </div>
            {[
              { href: "/isletme", label: "Restoran paneli", icon: Store },
              { href: "/kurye", label: "Kurye uygulaması", icon: Bike },
              ...(user.phone && ADMIN_PANEL_PHONES.includes(user.phone)
                ? [{ href: "/yonetim", label: "Yönetim paneli", icon: ShieldCheck }]
                : []),
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-2"
              >
                <item.icon className="size-4 text-muted" />
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger-soft"
            >
              <LogOut className="size-4" />
              Çıkış yap
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CartButton() {
  const mounted = useMounted();
  const count = useCart(cartCount);

  return (
    <Link
      href="/sepet"
      className="relative flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-sm font-bold text-brand-contrast shadow-brand transition-colors hover:bg-brand-hover"
      aria-label={`Sepetim${mounted && count ? `, ${count} ürün` : ""}`}
    >
      <ShoppingBag className="size-[18px]" />
      <span className="hidden sm:inline">Sepetim</span>
      {mounted && count > 0 && (
        <span className="tabular flex min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-extrabold text-brand">
          {count}
        </span>
      )}
    </Link>
  );
}
