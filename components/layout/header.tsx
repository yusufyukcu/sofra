"use client";

import {
  ChevronDown,
  Heart,
  LogOut,
  Moon,
  Receipt,
  Search,
  ShoppingBag,
  Store,
  Sun,
  User as UserIcon,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { APP_NAME } from "@/lib/constants";
import { useMounted } from "@/lib/hooks";
import { cartCount, useCart } from "@/lib/store/cart";
import { useSession } from "@/lib/store/session";
import { formatPrice } from "@/lib/utils";
import { AddressSelector } from "./address-selector";

/**
 * Üst bant. Patlıcan koyusu her sayfada sabit durur: sıcak kâğıt zemin
 * üzerinde markanın çapası olur ve altındaki içerikten net ayrılır.
 */
export function Header() {
  const pathname = usePathname();
  const hideSearch = pathname === "/odeme";

  return (
    <header className="band-deep sticky top-0 z-40 border-b border-white/5">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-3 lg:px-6">
        <Logo />

        <span className="hidden h-7 w-px bg-white/12 sm:block" />

        <AddressSelector onDeep compact />

        {!hideSearch && <HeaderSearch />}

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <ThemeToggle />
          <AccountMenu />
          <CartButton />
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */

function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-brand text-lg shadow-brand">
        🍽️
      </span>
      <span className="font-display hidden text-[1.35rem] font-extrabold leading-none tracking-tight text-on-deep sm:block">
        {APP_NAME}
      </span>
    </Link>
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
      <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/8 px-3 transition-colors focus-within:border-white/25 focus-within:bg-white/12">
        <Search className="size-4 shrink-0 text-on-deep-muted" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Restoran veya mutfak ara"
          className="min-w-0 flex-1 bg-transparent text-sm text-on-deep placeholder:text-on-deep-muted focus:outline-none"
          aria-label="Restoran ara"
        />
      </label>
    </form>
  );
}

/* ------------------------------------------------------------------ */

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
      className="hidden size-10 items-center justify-center rounded-xl text-on-deep-muted transition-colors hover:bg-white/10 hover:text-on-deep sm:flex"
    >
      {mounted && dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}

/* ------------------------------------------------------------------ */

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
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (status !== "authenticated" || !user) {
    return (
      <Link
        href="/giris"
        className="hidden h-10 items-center rounded-xl border border-white/15 px-3.5 text-sm font-semibold text-on-deep transition-colors hover:bg-white/10 sm:inline-flex"
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
        className="flex h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-on-deep transition-colors hover:bg-white/10"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-white/12 text-base">
          {user.avatarEmoji}
        </span>
        <span className="max-w-24 truncate">{user.name.split(" ")[0]}</span>
        <ChevronDown className="size-4 text-on-deep-muted" />
      </button>

      {open && (
        <div className="animate-fade-up absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border border-border bg-surface shadow-float">
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-bold text-ink">{user.name}</p>
            <p className="truncate text-xs text-muted">
              {user.phone ? `0${user.phone}` : user.email}
            </p>
          </div>
          <nav className="p-1.5">
            {[
              { href: "/hesabim", label: "Hesabım", icon: UserIcon },
              { href: "/hesabim/siparislerim", label: "Siparişlerim", icon: Receipt },
              { href: "/hesabim/favorilerim", label: "Favorilerim", icon: Heart },
              { href: "/hesabim/cuzdan", label: "Cüzdanım", icon: Wallet },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
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
            <Link
              href="/isletme"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-2"
            >
              <Store className="size-4 text-muted" />
              Restoran paneli
            </Link>
            <button
              type="button"
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
      className="relative flex h-10 items-center gap-2 rounded-xl bg-brand px-3.5 text-sm font-bold text-brand-contrast transition-colors hover:bg-brand-hover"
      aria-label={`Sepetim${mounted && count ? `, ${count} ürün` : ""}`}
    >
      <ShoppingBag className="size-[18px]" />
      <span className="hidden sm:inline">Sepetim</span>
      {mounted && count > 0 && (
        <span className="tabular flex min-w-5 items-center justify-center rounded-full bg-black/20 px-1.5 text-xs font-extrabold">
          {count}
        </span>
      )}
    </Link>
  );
}
